# backend/app/database.py
# Database connection and ORM setup

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()  # Load environment variables from .env file


def _is_prod_env() -> bool:
    """Detect if we should use the production/Render database."""
    return os.getenv("APP_ENV", "local").lower() in {"prod", "production", "render", "deploy", "preview"}


def get_database_url() -> str:
    """
    Resolve the active database URL.
    - Local/dev: DATABASE_URL_LOCAL
    - Prod/Render: DATABASE_URL
    """
    url = os.getenv("DATABASE_URL") if _is_prod_env() else os.getenv("DATABASE_URL_LOCAL")
    if not url:
        raise RuntimeError("Set DATABASE_URL_LOCAL for local dev or DATABASE_URL for production (set APP_ENV=prod).")

    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    if not url.lower().startswith("postgresql://"):
        raise RuntimeError("Only PostgreSQL URLs are supported. Update DATABASE_URL/DATABASE_URL_LOCAL.")

    return url


def _require_ssl(url: str) -> bool:
    """
    Decide whether to enforce SSL.
    Default: require in prod/Render; optional locally unless DATABASE_REQUIRE_SSL is set.
    """
    override = os.getenv("DATABASE_REQUIRE_SSL")
    if override is not None:
        return override.lower() in {"1", "true", "yes", "require"}

    return _is_prod_env() or "render.com" in url


def build_engine(url: str):
    connect_args = {}
    if _require_ssl(url):
        connect_args["sslmode"] = os.getenv("DATABASE_SSLMODE", "require")

    return create_engine(url, connect_args=connect_args, pool_pre_ping=True)


DATABASE_URL = get_database_url()
engine = build_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """
    FastAPI dependency that provides a database session,
    then closes it when the request is done.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
