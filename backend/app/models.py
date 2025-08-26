# backend/app/models.py
from sqlalchemy import Column, Integer, String, Float
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
    #city = Column(String)
    #state = Column(String)
    #zip = Column(String)
    
    