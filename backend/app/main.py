from .ai import generate_plant_name
from pydantic import BaseModel
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import os

from . import models, database, schemas

# Load environment variables
load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to your frontend URL(s) in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=database.engine)

API_KEY = os.getenv("API_KEY")

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

def verify_api_key(x_api_key: str = Header(default="secret")):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key")

@app.get("/", dependencies=[Depends(verify_api_key)])
def root():
    return {"message": "Welcome to the Rooted API"}


@app.post("/generate-name", dependencies=[Depends(verify_api_key)])
def ai_plant_name(desc: schemas.Chat):
    name = generate_plant_name(desc.description)
    return {"suggested_name": name}

@app.get("/plants", dependencies=[Depends(verify_api_key)])
def read_plants(db: Session = Depends(get_db)):
    return db.query(models.Plant).all()

@app.post("/plants", dependencies=[Depends(verify_api_key)])
def create_plant(plant: schemas.PlantCreate, db: Session = Depends(get_db)):
    new_plant = models.Plant(name=plant.name, PlantDescription=plant.PlantDescription)
    db.add(new_plant)
    db.commit()
    db.refresh(new_plant)
    return new_plant
