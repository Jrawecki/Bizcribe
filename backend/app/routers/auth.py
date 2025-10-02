# backend/app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import crud
from ..database import get_db
from ..schemas_auth import (
    UserCreate,
    LoginRequest,
    RefreshRequest,
    TokenPair,
    UserOut,
)
from ..crud_user import create_user, authenticate_user, get_user_by_email
from ..security import create_access_token, create_refresh_token, decode_token
from ..auth import get_current_user
from ..models_user import User as DBUser, UserRole as DBUserRole

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenPair)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = get_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = create_user(db, payload.email, payload.password, payload.display_name, DBUserRole.USER)

    if payload.business:
        crud.create_business_submission(db, payload.business, owner=user)

    access = create_access_token(user.id, user.role)
    refresh = create_refresh_token(user.id, user.role)
    return TokenPair(access_token=access, refresh_token=refresh, user=user)


@router.post("/login", response_model=TokenPair)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    access = create_access_token(user.id, user.role)
    refresh = create_refresh_token(user.id, user.role)
    return TokenPair(access_token=access, refresh_token=refresh, user=user)


@router.get("/me", response_model=UserOut)
def me(user = Depends(get_current_user)):
    return user


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    try:
        data = decode_token(payload.refresh_token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    if data.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = data.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

    user = db.get(DBUser, int(user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    access = create_access_token(user.id, user.role)
    new_refresh = create_refresh_token(user.id, user.role)  # rotate by default
    return TokenPair(access_token=access, refresh_token=new_refresh, user=user)
