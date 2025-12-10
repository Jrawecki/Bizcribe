# backend/app/crud.py
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import and_, or_
from . import models, schemas
from .models_user import BusinessMembership, MembershipRole, User, UserRole
from datetime import datetime
import math


def get_businesses(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    *,
    approved_only: bool = True,
) -> List[models.Business]:
    """List businesses with optional approval filtering and pagination."""
    query = db.query(models.Business)
    if approved_only:
        query = query.filter(models.Business.is_approved.is_(True))
    return query.offset(skip).limit(limit).all()


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute great-circle distance between two lat/lon pairs in kilometers."""
    R = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def search_businesses(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 100,
    approved_only: bool = True,
    bbox: Optional[Tuple[float, float, float, float]] = None,  # (west, south, east, north)
    near_lat: Optional[float] = None,
    near_lng: Optional[float] = None,
    radius_km: Optional[float] = None,
) -> List[models.Business]:
    """Search approved businesses with optional bbox and/or radius filters.

    - bbox: filters by viewport rectangle (simple between conditions; no anti-meridian handling).
    - near_lat/lng + radius_km: post-filters and sorts by distance using Haversine.
    """
    q = db.query(models.Business)
    if approved_only:
        q = q.filter(models.Business.is_approved.is_(True))

    if bbox is not None:
        west, south, east, north = bbox
        q = q.filter(
            and_(
                models.Business.lat.isnot(None),
                models.Business.lng.isnot(None),
                models.Business.lng >= west,
                models.Business.lng <= east,
                models.Business.lat >= south,
                models.Business.lat <= north,
            )
        )

    # Pull a reasonable superset before Python-side distance filter/sort
    base_items = q.offset(skip).limit(max(limit, 1000) if (bbox or radius_km) else limit).all()

    # Apply radius/distance if requested
    if near_lat is not None and near_lng is not None and radius_km is not None:
        enriched = []
        for b in base_items:
            if b.lat is None or b.lng is None:
                continue
            d = _haversine_km(near_lat, near_lng, float(b.lat), float(b.lng))
            if d <= radius_km:
                enriched.append((d, b))
        enriched.sort(key=lambda x: x[0])
        return [b for _, b in enriched][:limit]

    return base_items[:limit]


def get_business(db: Session, business_id: int) -> Optional[models.Business]:
    """Retrieve a single business by ID. Returns None if not found."""
    return db.query(models.Business).filter(models.Business.id == business_id).first()


def get_pending_businesses(db: Session) -> List[models.Business]:
    """Return businesses that are waiting on admin approval."""
    return (
        db.query(models.Business)
        .filter(models.Business.is_approved.is_(False))
        .order_by(models.Business.id.desc())
        .all()
    )


def create_business(
    db: Session,
    biz: schemas.SmallBusinessCreate,
    *,
    owner: Optional[User] = None,
    approved: bool = False,
    approved_by: Optional[User] = None,
) -> models.Business:
    """Create a new Business and optionally link it to an owner."""
    db_obj = models.Business(
        name=biz.name,
        description=biz.description,
        phone_number=biz.phone_number,
        location=biz.location,
        hide_address=bool(biz.hide_address) if biz.hide_address is not None else False,
        address1=biz.address1,
        city=biz.city,
        state=biz.state,
        zip=biz.zip,
        lat=biz.lat,
        lng=biz.lng,
        is_approved=approved,
        approved_at=datetime.utcnow() if approved else None,
        approved_by_id=approved_by.id if approved and approved_by else None,
        created_by_id=owner.id if owner else None,
    )
    db.add(db_obj)
    db.flush()

    if owner:
        membership = BusinessMembership(
            user_id=owner.id,
            business_id=db_obj.id,
            membership_role=MembershipRole.OWNER,
        )
        db.add(membership)

    db.commit()
    db.refresh(db_obj)
    return db_obj


def delete_business(
    db: Session,
    business_id: int,
    *,
    acting_user: Optional[User] = None,
) -> Optional[models.Business]:
    """Delete a business by ID if the acting user has permission."""
    obj = db.query(models.Business).filter(models.Business.id == business_id).first()
    if not obj:
        return None

    if acting_user and acting_user.role != UserRole.ADMIN:
        allowed_roles = (MembershipRole.OWNER, MembershipRole.MANAGER)
        membership = (
            db.query(BusinessMembership)
            .filter(
                and_(
                    BusinessMembership.business_id == business_id,
                    BusinessMembership.user_id == acting_user.id,
                    BusinessMembership.membership_role.in_(allowed_roles),
                )
            )
            .first()
        )
        if not membership:
            return None

    db.delete(obj)
    db.commit()
    return obj


def approve_business(db: Session, business_id: int, *, acting_user: Optional[User] = None) -> Optional[models.Business]:
    """Mark a business as approved and return it. None if not found."""
    biz = db.query(models.Business).filter(models.Business.id == business_id).first()
    if not biz:
        return None
    if biz.is_approved:
        return biz
    biz.is_approved = True
    biz.approved_at = datetime.utcnow()
    biz.approved_by_id = acting_user.id if acting_user else None
    db.commit()
    db.refresh(biz)
    return biz


def get_businesses_for_owner(db: Session, owner: User) -> List[models.Business]:
    """Return businesses linked to the given owner via membership."""
    return (
        db.query(models.Business)
        .join(BusinessMembership, BusinessMembership.business_id == models.Business.id)
        .filter(BusinessMembership.user_id == owner.id)
        .all()
    )


def create_business_submission(
    db: Session,
    payload: schemas.SmallBusinessCreate,
    *,
    owner: User,
) -> models.BusinessSubmission:
    """Persist a pending business submission that awaits admin approval."""
    submission = models.BusinessSubmission(
        owner_id=owner.id,
        name=payload.name,
        description=payload.description,
        phone_number=payload.phone_number,
        location=payload.location,
        hide_address=bool(payload.hide_address) if payload.hide_address is not None else False,
        address1=payload.address1,
        city=payload.city,
        state=payload.state,
        zip=payload.zip,
        lat=payload.lat,
        lng=payload.lng,
    )
    db.add(submission)
    db.flush()

    if payload.vetting:
        answers = payload.vetting.answers or {}
        vet = models.BusinessVetting(
          submission_id=submission.id,
          user_id=owner.id,
          version=payload.vetting.version,
          answers=answers,
        )
        db.add(vet)

    db.commit()
    db.refresh(submission)
    return submission


def get_pending_submissions(db: Session) -> List[models.BusinessSubmission]:
    """Legacy helper: all PENDING submissions ordered by newest."""
    return (
        db.query(models.BusinessSubmission)
        .options(selectinload(models.BusinessSubmission.vetting))
        .filter(models.BusinessSubmission.status == models.BusinessSubmission.SubmissionStatus.PENDING.value)
        .order_by(models.BusinessSubmission.created_at.desc())
        .all()
    )


def get_submission(db: Session, submission_id: int) -> Optional[models.BusinessSubmission]:
    return (
        db.query(models.BusinessSubmission)
        .options(selectinload(models.BusinessSubmission.vetting))
        .filter(models.BusinessSubmission.id == submission_id)
        .first()
    )


def search_submissions(
    db: Session,
    *,
    status: Optional[str] = None,
    query: Optional[str] = None,
    owner_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
) -> Tuple[List[models.BusinessSubmission], int]:
    q = db.query(models.BusinessSubmission).options(selectinload(models.BusinessSubmission.vetting))
    if status:
        q = q.filter(models.BusinessSubmission.status == status)
    if owner_id:
        q = q.filter(models.BusinessSubmission.owner_id == owner_id)
    if query:
        like = f"%{query}%"
        q = q.filter(
            or_(
                models.BusinessSubmission.name.ilike(like),
                models.BusinessSubmission.city.ilike(like),
                models.BusinessSubmission.state.ilike(like),
                models.BusinessSubmission.description.ilike(like),
            )
        )
    total = q.count()
    items = q.order_by(models.BusinessSubmission.created_at.desc()).offset(skip).limit(limit).all()
    return items, total


def get_submissions_for_owner(db: Session, owner: User) -> List[models.BusinessSubmission]:
    return (
        db.query(models.BusinessSubmission)
        .options(selectinload(models.BusinessSubmission.vetting))
        .filter(models.BusinessSubmission.owner_id == owner.id)
        .order_by(models.BusinessSubmission.created_at.desc())
        .all()
    )


def approve_business_submission(db: Session, submission_id: int, *, reviewer: User) -> Optional[models.Business]:
    submission = (
        db.query(models.BusinessSubmission)
        .filter(models.BusinessSubmission.id == submission_id)
        .first()
    )
    if not submission:
        return None

    existing_business = None
    if submission.created_business_id is not None:
        existing_business = (
            db.query(models.Business)
            .filter(models.Business.id == submission.created_business_id)
            .first()
        )

    if existing_business:
        # Idempotent re-approval: ensure business stays approved and update audit trail
        if not existing_business.is_approved:
            existing_business.is_approved = True
        existing_business.approved_at = datetime.utcnow()
        existing_business.approved_by_id = reviewer.id
        # Keep hide_address in sync from submission
        existing_business.hide_address = bool(submission.hide_address)

        if submission.vetting and submission.vetting.business_id is None:
            submission.vetting.business_id = existing_business.id

        submission.status = models.BusinessSubmission.SubmissionStatus.APPROVED.value
        submission.reviewed_at = datetime.utcnow()
        submission.reviewed_by_id = reviewer.id
        submission.review_notes = None

        db.commit()
        db.refresh(existing_business)
        return existing_business

    # Create approved Business
    owner = submission.owner
    payload = schemas.SmallBusinessCreate(
        name=submission.name,
        description=submission.description,
        phone_number=submission.phone_number,
        location=submission.location,
        hide_address=submission.hide_address,
        address1=submission.address1,
        city=submission.city,
        state=submission.state,
        zip=submission.zip,
        lat=submission.lat,
        lng=submission.lng,
    )
    business = create_business(db, payload, owner=owner, approved=True, approved_by=reviewer)

    # Link vetting to approved business if present
    if submission.vetting:
        submission.vetting.business_id = business.id

    # Mark submission as approved and keep for audit
    submission.status = models.BusinessSubmission.SubmissionStatus.APPROVED.value
    submission.reviewed_at = datetime.utcnow()
    submission.reviewed_by_id = reviewer.id
    submission.review_notes = None
    submission.created_business_id = business.id

    db.commit()
    db.refresh(business)
    return business


def delete_submission(db: Session, submission_id: int, *, acting_user: User) -> bool:
    submission = (
        db.query(models.BusinessSubmission)
        .filter(models.BusinessSubmission.id == submission_id)
        .first()
    )
    if not submission:
        return False
    if acting_user.role != UserRole.ADMIN and submission.owner_id != acting_user.id:
        return False
    db.delete(submission)
    db.commit()
    return True


def reject_submission(
    db: Session,
    submission_id: int,
    *,
    reviewer: User,
    notes: Optional[str] = None,
) -> Optional[models.BusinessSubmission]:
    submission = (
        db.query(models.BusinessSubmission)
        .filter(models.BusinessSubmission.id == submission_id)
        .first()
    )
    if not submission:
        return None

    if submission.created_business_id is not None:
        business = (
            db.query(models.Business)
            .filter(models.Business.id == submission.created_business_id)
            .first()
        )
        if business:
            db.delete(business)
        submission.created_business_id = None

    submission.status = models.BusinessSubmission.SubmissionStatus.REJECTED.value
    submission.review_notes = notes
    submission.reviewed_at = datetime.utcnow()
    submission.reviewed_by_id = reviewer.id

    db.commit()
    db.refresh(submission)
    return submission
