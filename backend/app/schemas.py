# backend/app/schemas.py
from datetime import datetime
from pydantic import BaseModel, EmailStr
from typing import List, Optional


class SmallBusinessBase(BaseModel):
    name: str
    description: str | None = None
    phone_number: str | None = None
    location: str | None = None
    address1: str | None = None
    city: str | None = None
    state: str | None = None
    zip: str | None = None
    lat: float | None = None
    lng: float | None = None


class SmallBusinessCreate(SmallBusinessBase):
    pass


class SmallBusiness(SmallBusinessBase):
    id: int
    is_approved: bool
    created_by_id: int | None = None
    approved_at: datetime | None = None
    approved_by_id: int | None = None

    class Config:
        from_attributes = True  # Pydantic v2


class BusinessSubmission(SmallBusinessBase):
    id: int
    owner_id: int
    created_at: datetime
    status: str
    review_notes: str | None = None
    reviewed_at: datetime | None = None
    reviewed_by_id: int | None = None
    created_business_id: int | None = None

    class Config:
        from_attributes = True


class BusinessSubmissionDetail(BusinessSubmission):
    class OwnerOut(BaseModel):
        id: int
        email: EmailStr
        display_name: Optional[str] = None
        role: str

        class Config:
            from_attributes = True

    owner: Optional[OwnerOut] = None


class SubmissionPage(BaseModel):
    items: List[BusinessSubmission]
    total: int


class SubmissionRejectRequest(BaseModel):
    notes: str | None = None
