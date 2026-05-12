# backend/app/routers/admin.py
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth import require_role
from ..crud_user import search_pure_consumers
from ..database import get_db
from ..models_user import User, UserRole
from ..schemas_auth import AdminUserListResponse

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users/search", response_model=AdminUserListResponse)
def search_customers(
    query: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
):
    items, total = search_pure_consumers(db, query=query, skip=skip, limit=limit)
    return AdminUserListResponse(items=items, total=total, skip=skip, limit=limit)
