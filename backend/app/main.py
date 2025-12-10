# backend/app/main.py

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base

# Ensure models are imported before create_all
from . import models                 # SmallBusiness
from . import models_user            # User, memberships, reviews, etc.

# Routers
from .routers import businesses
from .routers import business_submissions
from .routers.auth import router as auth_router

# Create tables (idempotent)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Bizcribe Backend")

# CORS for Vite / production frontend
default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://192.168.1.135:5173",
    "https://bizcribe.net",
    "https://www.bizcribe.net",
    "https://bizcribe.pages.dev",
    "https://bizscribe.net",
    "https://www.bizscribe.net",
    "https://bizscribe.pages.dev",
]
env_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
allow_origins = list(dict.fromkeys(default_origins + env_origins))  # dedupe while preserving order

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router)                 # /api/auth/*
app.include_router(business_submissions.router) # /api/businesses/submissions
app.include_router(businesses.router)           # /api/businesses


@app.get("/health")
def health():
    return {"status": "ok"}
