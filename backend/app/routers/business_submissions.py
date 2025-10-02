from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..auth import get_current_user, require_role
from ..database import get_db
from ..models_user import User, UserRole

router = APIRouter(
    prefix="/api/businesses/submissions",
    tags=["business submissions"],
)


@router.post(
    "",
    response_model=schemas.BusinessSubmission,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/",
    response_model=schemas.BusinessSubmission,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def submit_business(
    payload: schemas.SmallBusinessCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Allow any authenticated user to submit a business for approval."""
    return crud.create_business_submission(db, payload, owner=current_user)


@router.get("/mine", response_model=List[schemas.BusinessSubmission])
def read_my_submissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return crud.get_submissions_for_owner(db, current_user)


@router.get("/pending", response_model=List[schemas.BusinessSubmission])
def read_pending_submissions(
    _: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    return crud.get_pending_submissions(db)


@router.post("/{submission_id}/approve", response_model=schemas.SmallBusiness)
def approve_submission(
    submission_id: int,
    reviewer: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    business = crud.approve_business_submission(db, submission_id, reviewer=reviewer)
    if not business:
        raise HTTPException(status_code=404, detail="Submission not found")
    return business


@router.delete("/{submission_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_submission(
    submission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ok = crud.delete_submission(db, submission_id, acting_user=current_user)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found or not permitted")
    return


@router.get("/search", response_model=schemas.SubmissionPage)
def search_submissions(
    status: Optional[str] = None,
    query: Optional[str] = None,
    owner_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    _: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    items, total = crud.search_submissions(
        db,
        status=status,
        query=query,
        owner_id=owner_id,
        skip=skip,
        limit=limit,
    )
    return schemas.SubmissionPage(items=items, total=total)


@router.get("/{submission_id}", response_model=schemas.BusinessSubmissionDetail)
def read_submission_detail(
    submission_id: int,
    _: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    sub = crud.get_submission(db, submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    return sub


@router.post("/{submission_id}/reject", response_model=schemas.BusinessSubmission)
def reject_submission(
    submission_id: int,
    payload: schemas.SubmissionRejectRequest,
    reviewer: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    sub = crud.reject_submission(db, submission_id, reviewer=reviewer, notes=payload.notes)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    return sub
