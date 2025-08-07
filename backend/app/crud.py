from sqlalchemy.orm import Session
from . import models, schemas

def get_businesses(db: Session, skip: int = 0, limit: int = 100):
    """
    Retrieve a list of small businesses.

    - skip: number of records to skip (for paging)
    - limit: maximum number of records to return
    """
    return db.query(models.SmallBusiness).offset(skip).limit(limit).all()

def get_business(db: Session, business_id: int):
    """
    Retrieve a single SmallBusiness by its ID.
    Returns None if not found.
    """
    return db.query(models.SmallBusiness).filter(models.SmallBusiness.id == business_id).first()

def create_business(db: Session, biz: schemas.SmallBusinessCreate):
    """
    Create a new SmallBusiness row from the incoming Pydantic schema.
    """
    db_obj = models.SmallBusiness(
        name=biz.name,
        description=biz.description,
        phone_number=biz.phone_number,
        location=biz.location,
        lat=biz.lat, 
        lng=biz.lng,   
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def delete_business(db: Session, business_id: int):
    """
    Delete a SmallBusiness by ID. Returns the deleted object or None.
    """
    obj = db.query(models.SmallBusiness).filter(models.SmallBusiness.id == business_id).first()
    if obj:
        db.delete(obj)
        db.commit()
    return obj