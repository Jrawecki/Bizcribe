# backend/app/models.py
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, Float, ForeignKey, Boolean, DateTime, JSON
from sqlalchemy.orm import relationship
from .database import Base


class Business(Base):
    __tablename__ = "businesses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String)
    phone_number = Column(String)
    location = Column(String)
    lat = Column(Float)
    lng = Column(Float)
    address1 = Column(String)
    city = Column(String)
    state = Column(String)
    zip = Column(String)
    is_approved = Column(Boolean, default=False, nullable=False)
    approved_at = Column(DateTime, nullable=True)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_by = relationship("User", back_populates="businesses_created", foreign_keys=[created_by_id])
    approved_by = relationship("User", back_populates="businesses_approved", foreign_keys=[approved_by_id])
    memberships = relationship("BusinessMembership", back_populates="business", cascade="all,delete-orphan")


class BusinessSubmission(Base):
    __tablename__ = "business_submissions"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(String)
    phone_number = Column(String)
    location = Column(String)
    lat = Column(Float)
    lng = Column(Float)
    address1 = Column(String)
    city = Column(String)
    state = Column(String)
    zip = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    # Review workflow fields
    class SubmissionStatus(str, Enum):
        PENDING = "PENDING"
        APPROVED = "APPROVED"
        REJECTED = "REJECTED"

    status = Column(String, default=SubmissionStatus.PENDING.value, nullable=False)
    review_notes = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    # Optional link to created business when approved
    created_business_id = Column(Integer, ForeignKey("businesses.id"), nullable=True)

    owner = relationship("User", back_populates="business_submissions", foreign_keys=[owner_id])
    reviewed_by = relationship("User", back_populates="business_submissions_reviewed", foreign_keys=[reviewed_by_id])
    created_business = relationship("Business", foreign_keys=[created_business_id])
    vetting = relationship("BusinessVetting", back_populates="submission", uselist=False, cascade="all,delete-orphan")


class BusinessVetting(Base):
    __tablename__ = "business_vetting"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("business_submissions.id"), unique=True, nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id"), unique=True, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    version = Column(Integer, default=1, nullable=False)
    answers = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    submission = relationship("BusinessSubmission", back_populates="vetting", foreign_keys=[submission_id])
    business = relationship("Business", foreign_keys=[business_id])
    user = relationship("User", foreign_keys=[user_id])
