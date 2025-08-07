from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from .. import crud, schemas
from .database import get_db

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
    """
    GET /api/businesses
    Returns a paginated list of businesses.
    """
    return crud.get_businesses(db, skip=skip, limit=limit)

@router.get("/{business_id}", response_model=schemas.SmallBusiness)
def read_business(business_id: int, db: Session = Depends(get_db)):
    """
    GET /api/businesses/{business_id}
    Returns one business or 404 if not found.
    """
    biz = crud.get_business(db, business_id)
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    return biz

@router.post(
    "/",
    response_model=schemas.SmallBusiness,
    status_code=status.HTTP_201_CREATED,
)
def create_business(
    business: schemas.SmallBusinessCreate,
    db: Session = Depends(get_db),
):
    """
    POST /api/businesses
    Create a new business from the JSON body.
    """
    return crud.create_business(db, business)

@router.delete(
    "/{business_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_business(business_id: int, db: Session = Depends(get_db)):
    """
    DELETE /api/businesses/{business_id}
    Deletes the business or returns 404.
    """
    deleted = crud.delete_business(db, business_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Business not found")
    # 204 means no content in the response body
    return
