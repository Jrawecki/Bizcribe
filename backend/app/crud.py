# backend/app/crud.py
from typing import Optional, List
from sqlalchemy.orm import Session
from . import models, schemas

def get_businesses(db: Session, skip: int = 0, limit: int = 100) -> List[models.Business]:
    """
    List businesses with simple pagination.
    """
    return (
        db.query(models.Business)
        .offset(skip)
        .limit(limit)
        .all()
    )

def get_business(db: Session, business_id: int) -> Optional[models.Business]:
    """
    Retrieve a single business by ID. Returns None if not found.
    """
    return db.query(models.Business).filter(models.Business.id == business_id).first()

def create_business(db: Session, biz: schemas.SmallBusinessCreate) -> models.Business:
    """
    Create a new Business from your Pydantic schema.
    Only include columns that exist on the Business model.
    """
    db_obj = models.Business(
        name=biz.name,
        description=biz.description,
        phone_number=biz.phone_number,
        location=biz.location,
        address1=biz.address1,
        lat=biz.lat,
        lng=biz.lng,
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def delete_business(db: Session, business_id: int) -> Optional[models.Business]:
    """
    Delete a business by ID. Returns the deleted object or None.
    """
    obj = db.query(models.Business).filter(models.Business.id == business_id).first()
    if obj:
        db.delete(obj)
        db.commit()
    return obj
