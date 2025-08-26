# backend/app/schemas_auth.py
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from enum import Enum

class UserRole(str, Enum):
    ADMIN = "ADMIN"
    BUSINESS = "BUSINESS"
    USER = "USER"

# === Requests ===
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: Optional[str] = None
    role: UserRole = UserRole.USER  # allow creating BUSINESS via admin seed or later UI

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
