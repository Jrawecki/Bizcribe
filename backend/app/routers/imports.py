import csv
import io
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import require_role
from ..database import get_db
from ..geocode import geocode_address
from ..models_user import User, UserRole

router = APIRouter(prefix="/api/imports", tags=["imports"])

REQUIRED_COLUMNS = [
    "name",
    "description",
    "phone_number",
    "location",
    "lat",
    "lng",
    "address1",
    "city",
    "state",
    "zip",
]


def _safe_float(value: Optional[str]) -> Optional[float]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _build_location(address1: Optional[str], city: Optional[str], state: Optional[str], zip_code: Optional[str]) -> str:
    parts = [address1, city, state, zip_code]
    return ", ".join([p for p in parts if p])


def _duplicate_business(
    db: Session,
    *,
    name: str,
    address1: Optional[str],
    city: Optional[str],
    state: Optional[str],
    zip_code: Optional[str],
) -> Optional[models.Business]:
    query = db.query(models.Business).filter(models.Business.name.ilike(name))
    if address1:
        query = query.filter(models.Business.address1.ilike(address1))
    if city:
        query = query.filter(models.Business.city.ilike(city))
    if state:
        query = query.filter(models.Business.state.ilike(state))
    if zip_code:
        query = query.filter(models.Business.zip.ilike(zip_code))
    return query.first()


def _compute_status(
    *,
    duplicate_of: Optional[models.Business],
    lat: Optional[float],
    lng: Optional[float],
    error_message: Optional[str],
) -> str:
    if duplicate_of is not None:
        return models.ImportItemStatus.DUPLICATE_PENDING.value
    if lat is None or lng is None:
        return models.ImportItemStatus.NEEDS_FIX.value if error_message else models.ImportItemStatus.NEEDS_GEOCODE.value
    return models.ImportItemStatus.READY.value


@router.post("/batches", response_model=schemas.ImportBatchSummary, status_code=status.HTTP_201_CREATED)
def create_import_batch(
    file: UploadFile = File(...),
    _: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="CSV files only.")

    raw = file.file.read()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("utf-8-sig")

    reader = csv.DictReader(io.StringIO(text))
    columns = [c.strip() for c in reader.fieldnames or []]
    missing = [c for c in REQUIRED_COLUMNS if c not in columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {', '.join(missing)}")

    batch = models.ImportBatch(
        created_by_id=_.id,
        total_rows=0,
    )
    db.add(batch)
    db.flush()

    seen_keys: Dict[str, int] = {}
    items: List[models.ImportItem] = []

    for row in reader:
        name = _normalize_text(row.get("name"))
        if not name:
            continue

        description = _normalize_text(row.get("description"))
        phone_number = _normalize_text(row.get("phone_number"))
        address1 = _normalize_text(row.get("address1"))
        city = _normalize_text(row.get("city"))
        state = _normalize_text(row.get("state"))
        zip_code = _normalize_text(row.get("zip"))

        location = _normalize_text(row.get("location"))
        if not location:
            location = _build_location(address1, city, state, zip_code)

        lat = _safe_float(row.get("lat"))
        lng = _safe_float(row.get("lng"))

        duplicate_of = _duplicate_business(
            db,
            name=name,
            address1=address1,
            city=city,
            state=state,
            zip_code=zip_code,
        )

        error_message = None
        if lat is None or lng is None:
            geocoded = geocode_address(address1, city, state, zip_code)
            if geocoded:
                lat, lng = geocoded
            else:
                error_message = "Missing or invalid coordinates."

        key = "|".join([name.lower(), (address1 or "").lower(), (city or "").lower(), (state or "").lower(), (zip_code or "").lower()])
        if key in seen_keys:
            error_message = "Duplicate in batch."
            duplicate_of = duplicate_of or None
            status_value = models.ImportItemStatus.DUPLICATE_PENDING.value
        else:
            seen_keys[key] = 1
            status_value = _compute_status(duplicate_of=duplicate_of, lat=lat, lng=lng, error_message=error_message)

        item = models.ImportItem(
            batch_id=batch.id,
            status=status_value,
            error_message=error_message,
            name=name,
            description=description,
            phone_number=phone_number,
            location=location,
            lat=lat,
            lng=lng,
            address1=address1,
            city=city,
            state=state,
            zip=zip_code,
            duplicate_of_business_id=duplicate_of.id if duplicate_of else None,
        )
        items.append(item)

    batch.total_rows = len(items)
    db.add_all(items)
    db.commit()
    db.refresh(batch)

    return _batch_summary(db, batch)


def _batch_summary(db: Session, batch: models.ImportBatch) -> schemas.ImportBatchSummary:
    items = db.query(models.ImportItem).filter(models.ImportItem.batch_id == batch.id).all()
    counts = {
        models.ImportItemStatus.READY.value: 0,
        models.ImportItemStatus.NEEDS_GEOCODE.value: 0,
        models.ImportItemStatus.NEEDS_FIX.value: 0,
        models.ImportItemStatus.DUPLICATE_PENDING.value: 0,
        models.ImportItemStatus.APPROVED.value: 0,
        models.ImportItemStatus.REJECTED.value: 0,
        models.ImportItemStatus.MERGED.value: 0,
    }
    for item in items:
        counts[item.status] = counts.get(item.status, 0) + 1

    return schemas.ImportBatchSummary(
        batch=batch,
        ready=counts[models.ImportItemStatus.READY.value],
        needs_geocode=counts[models.ImportItemStatus.NEEDS_GEOCODE.value],
        needs_fix=counts[models.ImportItemStatus.NEEDS_FIX.value],
        duplicate_pending=counts[models.ImportItemStatus.DUPLICATE_PENDING.value],
        approved=counts[models.ImportItemStatus.APPROVED.value],
        rejected=counts[models.ImportItemStatus.REJECTED.value],
        merged=counts[models.ImportItemStatus.MERGED.value],
    )


@router.get("/batches", response_model=List[schemas.ImportBatchSummary])
def list_batches(
    _: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    batches = db.query(models.ImportBatch).order_by(models.ImportBatch.created_at.desc()).all()
    return [_batch_summary(db, batch) for batch in batches]


@router.get("/batches/{batch_id}", response_model=schemas.ImportBatchDetail)
def get_batch(
    batch_id: int,
    _: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    batch = db.query(models.ImportBatch).filter(models.ImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    items = (
        db.query(models.ImportItem)
        .filter(models.ImportItem.batch_id == batch_id)
        .order_by(models.ImportItem.id.asc())
        .all()
    )
    return schemas.ImportBatchDetail(
        id=batch.id,
        created_at=batch.created_at,
        created_by_id=batch.created_by_id,
        source_name=batch.source_name,
        source_url=batch.source_url,
        total_rows=batch.total_rows,
        items=items,
    )


def _create_business_from_item(
    db: Session,
    item: models.ImportItem,
    reviewer: User,
) -> models.Business:
    business = models.Business(
        name=item.name,
        description=item.description,
        phone_number=item.phone_number,
        location=item.location,
        lat=item.lat,
        lng=item.lng,
        hide_address=False,
        address1=item.address1,
        city=item.city,
        state=item.state,
        zip=item.zip,
        is_approved=True,
        approved_at=datetime.utcnow(),
        approved_by_id=reviewer.id,
        created_by_id=reviewer.id,
    )
    db.add(business)
    db.flush()
    return business


@router.post("/batches/{batch_id}/approve_all", response_model=schemas.ImportBatchSummary)
def approve_all_ready(
    batch_id: int,
    reviewer: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    batch = db.query(models.ImportBatch).filter(models.ImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    items = (
        db.query(models.ImportItem)
        .filter(
            models.ImportItem.batch_id == batch_id,
            models.ImportItem.status == models.ImportItemStatus.READY.value,
        )
        .all()
    )
    for item in items:
        business = _create_business_from_item(db, item, reviewer)
        item.status = models.ImportItemStatus.APPROVED.value
        item.approved_business_id = business.id
        item.error_message = None
    db.commit()

    return _batch_summary(db, batch)


@router.post("/batches/{batch_id}/approve", response_model=schemas.ImportBatchSummary)
def approve_selected(
    batch_id: int,
    payload: schemas.ImportApproveRequest,
    reviewer: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    batch = db.query(models.ImportBatch).filter(models.ImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    if not payload.item_ids:
        return _batch_summary(db, batch)

    items = (
        db.query(models.ImportItem)
        .filter(models.ImportItem.batch_id == batch_id, models.ImportItem.id.in_(payload.item_ids))
        .all()
    )
    for item in items:
        if item.status in {
            models.ImportItemStatus.APPROVED.value,
            models.ImportItemStatus.REJECTED.value,
            models.ImportItemStatus.MERGED.value,
        }:
            continue
        if item.lat is None or item.lng is None:
            item.status = models.ImportItemStatus.NEEDS_FIX.value
            item.error_message = "Missing or invalid coordinates."
            continue
        if item.duplicate_of_business_id:
            item.status = models.ImportItemStatus.DUPLICATE_PENDING.value
            continue
        business = _create_business_from_item(db, item, reviewer)
        item.status = models.ImportItemStatus.APPROVED.value
        item.approved_business_id = business.id
        item.error_message = None
    db.commit()
    return _batch_summary(db, batch)


@router.post("/batches/{batch_id}/reject", response_model=schemas.ImportBatchSummary)
def reject_selected(
    batch_id: int,
    payload: schemas.ImportApproveRequest,
    _: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    batch = db.query(models.ImportBatch).filter(models.ImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    if not payload.item_ids:
        return _batch_summary(db, batch)

    items = (
        db.query(models.ImportItem)
        .filter(models.ImportItem.batch_id == batch_id, models.ImportItem.id.in_(payload.item_ids))
        .all()
    )
    for item in items:
        if item.status in {
            models.ImportItemStatus.APPROVED.value,
            models.ImportItemStatus.MERGED.value,
        }:
            continue
        item.status = models.ImportItemStatus.REJECTED.value
        item.error_message = None

    db.commit()
    return _batch_summary(db, batch)


@router.post("/items/{item_id}/regeocode", response_model=schemas.ImportItem)
def regeocode_item(
    item_id: int,
    _: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    item = db.query(models.ImportItem).filter(models.ImportItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    coords = geocode_address(item.address1, item.city, item.state, item.zip)
    if coords:
        item.lat, item.lng = coords
        dup = _duplicate_business(
            db,
            name=item.name,
            address1=item.address1,
            city=item.city,
            state=item.state,
            zip_code=item.zip,
        )
        item.duplicate_of_business_id = dup.id if dup else None
        item.status = _compute_status(duplicate_of=dup, lat=item.lat, lng=item.lng, error_message=None)
        item.error_message = None
    else:
        item.status = models.ImportItemStatus.NEEDS_FIX.value
        item.error_message = "Geocoding failed."

    db.commit()
    db.refresh(item)
    return item


@router.patch("/items/{item_id}", response_model=schemas.ImportItem)
def update_item(
    item_id: int,
    payload: schemas.ImportItemUpdate,
    _: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    item = db.query(models.ImportItem).filter(models.ImportItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        if field in {"lat", "lng"}:
            value = _safe_float(value)
        elif isinstance(value, str):
            value = value.strip() or None
        setattr(item, field, value)

    if not item.location:
        item.location = _build_location(item.address1, item.city, item.state, item.zip)

    dup = _duplicate_business(
        db,
        name=item.name,
        address1=item.address1,
        city=item.city,
        state=item.state,
        zip_code=item.zip,
    )
    item.duplicate_of_business_id = dup.id if dup else None
    item.status = _compute_status(duplicate_of=dup, lat=item.lat, lng=item.lng, error_message=None)
    item.error_message = None if item.status != models.ImportItemStatus.NEEDS_FIX.value else item.error_message

    db.commit()
    db.refresh(item)
    return item


@router.post("/items/{item_id}/reject", response_model=schemas.ImportItem)
def reject_item(
    item_id: int,
    _: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    item = db.query(models.ImportItem).filter(models.ImportItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.status = models.ImportItemStatus.REJECTED.value
    db.commit()
    db.refresh(item)
    return item


@router.post("/items/{item_id}/merge", response_model=schemas.ImportItem)
def merge_item(
    item_id: int,
    payload: schemas.ImportItemMergeRequest,
    _: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    item = db.query(models.ImportItem).filter(models.ImportItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    target = db.query(models.Business).filter(models.Business.id == payload.target_business_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target business not found")

    def prefer_existing(existing, incoming):
        return existing if existing not in (None, "") else incoming

    target.description = prefer_existing(target.description, item.description)
    target.phone_number = prefer_existing(target.phone_number, item.phone_number)
    target.location = prefer_existing(target.location, item.location)
    target.address1 = prefer_existing(target.address1, item.address1)
    target.city = prefer_existing(target.city, item.city)
    target.state = prefer_existing(target.state, item.state)
    target.zip = prefer_existing(target.zip, item.zip)
    if target.lat is None or target.lng is None:
        target.lat = item.lat if target.lat is None else target.lat
        target.lng = item.lng if target.lng is None else target.lng

    item.status = models.ImportItemStatus.MERGED.value
    item.approved_business_id = target.id
    item.duplicate_of_business_id = target.id
    item.error_message = None

    db.commit()
    db.refresh(item)
    return item
