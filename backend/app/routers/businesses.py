from typing import List
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
    db: Session = Depends(get_db),
):
    """Public listing of approved businesses."""
    return crud.get_businesses(db, skip=skip, limit=limit, approved_only=True)


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
