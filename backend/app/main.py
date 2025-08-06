# backend/app/main.py

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import businesses

# Create all database tables (if not already present)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Placeholder Backend")

# Allow Vite dev server to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the businesses router
app.include_router(businesses.router)

# (Optional) root healthcheck
@app.get("/health")
def health():
    return {"status": "ok"}
