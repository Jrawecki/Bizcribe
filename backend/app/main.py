# backend/app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base

# ✅ Import models BEFORE create_all so tables are registered
from . import models                 # SmallBusiness
from . import models_user            # User, memberships, reviews, etc. (make sure this file exists)

# Routers
from .routers import businesses
from .routers.auth import router as auth_router  # make sure routers/auth.py exists

# ✅ Create tables (idempotent) — DO NOT drop on startup in dev
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Bizcribe Backend")

# CORS for Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router)          # /api/auth/*
app.include_router(businesses.router)    # /api/businesses

@app.get("/health")
def health():
    return {"status": "ok"}
