# backend/app/schemas_auth.py
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field
from .models_user import UserRole
from .schemas import SmallBusinessCreate


# === Requests ===
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: Optional[str] = None
    business: Optional[SmallBusinessCreate] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


# === Responses ===
class UserOut(BaseModel):
    id: int
    email: EmailStr
    display_name: Optional[str] = None
    role: UserRole

    class Config:
        from_attributes = True  # pydantic v2


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class AdminUserListItem(BaseModel):
    id: int
    email: EmailStr
    display_name: Optional[str] = None
    role: UserRole
    created_at: datetime

    class Config:
        from_attributes = True


class AdminUserListResponse(BaseModel):
    items: List[AdminUserListItem]
    total: int
    skip: int
    limit: int
