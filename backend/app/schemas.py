# backend/app/schemas.py

from pydantic import BaseModel

class SmallBusinessBase(BaseModel):
    name: str
    description: str | None = None
    phone_number: str | None = None
    location: str | None = None
    address1: str | None = None
    lat: float | None = None
    lng: float | None = None

class SmallBusinessCreate(SmallBusinessBase):
    pass

class SmallBusiness(SmallBusinessBase):
    id: int

    class Config:
        from_attributes = True  # Pydantic v2
