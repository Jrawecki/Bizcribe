# backend/app/models_user.py
from typing import Optional
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, DateTime, Enum as SAEnum, ForeignKey, UniqueConstraint, Text, Boolean
from sqlalchemy.orm import relationship, Mapped, mapped_column
from .database import Base


# === Global user role (RBAC) ===
class UserRole(str, Enum):
    ADMIN = "ADMIN"
    BUSINESS = "BUSINESS"
    USER = "USER"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(SAEnum(UserRole), default=UserRole.USER, nullable=False)
    email_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # relationships (lazy optional)
    memberships = relationship("BusinessMembership", back_populates="user", cascade="all,delete-orphan")
    reviews = relationship("Review", back_populates="user", cascade="all,delete-orphan")
    favorites = relationship("Favorite", back_populates="user", cascade="all,delete-orphan")
    checkins = relationship("CheckIn", back_populates="user", cascade="all,delete-orphan")
    businesses_created = relationship(
        "Business",
        back_populates="created_by",
        cascade="all,delete-orphan",
        foreign_keys="Business.created_by_id",
    )
    business_submissions = relationship(
        "BusinessSubmission",
        back_populates="owner",
        cascade="all,delete-orphan",
        foreign_keys="BusinessSubmission.owner_id",
    )
    # Reverse relations for approvals/reviews
    businesses_approved = relationship(
        "Business",
        back_populates="approved_by",
        foreign_keys="Business.approved_by_id",
    )
    business_submissions_reviewed = relationship(
        "BusinessSubmission",
        back_populates="reviewed_by",
        foreign_keys="BusinessSubmission.reviewed_by_id",
    )


# Per-business membership (owner/manager/staff)
class MembershipRole(str, Enum):
    OWNER = "OWNER"
    MANAGER = "MANAGER"
    STAFF = "STAFF"


class BusinessMembership(Base):
    __tablename__ = "business_memberships"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), index=True, nullable=False)
    membership_role: Mapped[str] = mapped_column(SAEnum(MembershipRole), default=MembershipRole.OWNER, nullable=False)

    user = relationship("User", back_populates="memberships")
    business = relationship("Business", back_populates="memberships")

    __table_args__ = (UniqueConstraint("user_id", "business_id", name="uq_user_business"),)


# Reviews / Favorites / Check-ins
class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), index=True, nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1..5
    title: Mapped[Optional[str]] = mapped_column(String(200))
    body: Mapped[Optional[str]] = mapped_column(Text)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="reviews")


class Favorite(Base):
    __tablename__ = "favorites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="favorites")
    __table_args__ = (UniqueConstraint("user_id", "business_id", name="uq_fav_user_business"),)


class CheckIn(Base):
    __tablename__ = "checkins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), index=True, nullable=False)
    visited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    note: Mapped[Optional[str]] = mapped_column(String(300))

    user = relationship("User", back_populates="checkins")
