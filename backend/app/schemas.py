# app/schemas.py

from pydantic import BaseModel

class PlantCreate(BaseModel):
    name: str
    PlantDescription: str

class Chat(BaseModel):
    description: str