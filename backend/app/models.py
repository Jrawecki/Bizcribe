from sqlalchemy import Column, Integer, String
from .database import Base

class SmallBusiness(Base):
    __tablename__ = "small_businesses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    location = Column(String, nullable=True)

    
    