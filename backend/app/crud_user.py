# backend/app/crud_user.py
from sqlalchemy.orm import Session
from typing import Optional
from .models_user import User, UserRole
from .security import hash_password, verify_password

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email.lower()).first()

def create_user(db: Session, email: str, password: str, display_name: str | None, role: UserRole = UserRole.USER) -> User:
    u = User(
        email=email.lower(),
        password_hash=hash_password(password),
        display_name=display_name,
        role=role,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u

def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user
