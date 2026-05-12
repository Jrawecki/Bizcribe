# backend/app/crud_user.py
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from typing import List, Optional, Tuple
from .models import BusinessSubmission
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


def search_pure_consumers(
    db: Session,
    *,
    query: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
) -> Tuple[List[User], int]:
    """Users with role=USER who have never submitted a business."""
    base = (
        db.query(User)
        .outerjoin(BusinessSubmission, BusinessSubmission.owner_id == User.id)
        .filter(User.role == UserRole.USER)
        .filter(BusinessSubmission.id.is_(None))
    )
    if query:
        like = f"%{query.strip()}%"
        base = base.filter(or_(User.email.ilike(like), User.display_name.ilike(like)))
    total = base.with_entities(func.count(func.distinct(User.id))).scalar() or 0
    items = (
        base.order_by(User.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return items, total
