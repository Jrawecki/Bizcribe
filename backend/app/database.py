# backend/app/database.py
# Database connection and ORM setup

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os
import pathlib

load_dotenv()  # Load environment variables from .env file

# Base directory = backend folder
BASE_DIR = pathlib.Path(__file__).resolve().parent.parent
DEFAULT_SQLITE_PATH = BASE_DIR / "Bizcribe.db"

# Use env var if set, otherwise fall back to Bizcribe.db (SQLite)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    # SQLAlchemy requires three slashes for a relative sqlite file
    f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}"
)

# On Windows, absolute paths like C:\... should be written as sqlite:///C:/...
if DATABASE_URL.lower().startswith("sqlite:///"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

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
