from sqlalchemy import Column, Integer, String
from .database import Base

class Plant(Base):
    __tablename__ = "plants"
     
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    PlantDescription = Column(String)

    
    