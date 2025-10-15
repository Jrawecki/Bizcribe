from typing import List, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..auth import get_current_user, require_role
from ..database import get_db
from ..models_user import User, UserRole

router = APIRouter(
    prefix="/api/businesses",
    tags=["businesses"],
)


@router.get("/", response_model=List[schemas.SmallBusiness])
def read_businesses(
    skip: int = 0,
    limit: int = 100,
    bbox: Optional[str] = None,  # "west,south,east,north"
    near: Optional[str] = None,  # "lat,lng"
    radius_km: Optional[float] = None,
    db: Session = Depends(get_db),
):
    """Public listing of approved businesses with optional spatial filters.

    - bbox: filter by viewport rectangle (comma-separated: west,south,east,north)
    - near + radius_km: filter by distance and sort nearest-first
    """

    parsed_bbox: Optional[Tuple[float, float, float, float]] = None
    if bbox:
        try:
            parts = [float(x.strip()) for x in bbox.split(",")]
            if len(parts) != 4:
                raise ValueError
            parsed_bbox = (parts[0], parts[1], parts[2], parts[3])
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid bbox format. Use 'west,south,east,north'.")

    near_lat = near_lng = None
    if near:
        try:
            n = [float(x.strip()) for x in near.split(",")]
            if len(n) != 2:
                raise ValueError
            near_lat, near_lng = n[0], n[1]
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid near format. Use 'lat,lng'.")

    return crud.search_businesses(
        db,
        skip=skip,
        limit=limit,
        approved_only=True,
        bbox=parsed_bbox,
        near_lat=near_lat,
        near_lng=near_lng,
        radius_km=radius_km,
    )


@router.get("/pending", response_model=List[schemas.SmallBusiness])
def read_pending_businesses(
    _: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Admin-only listing of businesses waiting for approval."""
    return crud.get_pending_businesses(db)


@router.get("/mine", response_model=List[schemas.SmallBusiness])
def read_my_businesses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the businesses associated with the logged-in owner."""
    return crud.get_businesses_for_owner(db, current_user)


@router.get("/{business_id}", response_model=schemas.SmallBusiness)
def read_business(business_id: int, db: Session = Depends(get_db)):
    """Public detail for a single approved business."""
    biz = crud.get_business(db, business_id)
    if not biz or not biz.is_approved:
        raise HTTPException(status_code=404, detail="Business not found")
    return biz


@router.post(
    "/",
    response_model=schemas.SmallBusiness,
    status_code=status.HTTP_201_CREATED,
)
def create_business(
    business: schemas.SmallBusinessCreate,
    _: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Admin-only direct business creation (skips submission workflow)."""
    return crud.create_business(db, business, owner=None, approved=True)


@router.post("/{business_id}/approve", response_model=schemas.SmallBusiness)
def approve_business(
    business_id: int,
    reviewer: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Mark a pending business as approved."""
    biz = crud.approve_business(db, business_id, acting_user=reviewer)
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    return biz


@router.delete(
    "/{business_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_business(
    business_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a business if you are its owner or an admin."""
    biz = crud.get_business(db, business_id)
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")

    deleted = crud.delete_business(db, business_id, acting_user=current_user)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to delete this business")
    return
