from sqlalchemy import create_engine
#after creating the models; we want to make sure to tell PostgreSQL to create corresponding tables
from models import Base

from sqlalchemy.orm import sessionmaker

#create_engine is a SQLAlchemy mechanism that allows for creating a database engine.
DATABASE_URL = "postgresql+psycopg://ngawangtharchinsherpa@localhost:5432/trac"
#it means Use postgresql through psycopg driver.
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
#bind = engine means whenever you create a session use this engine to communicate with the database

Base.metadata.create_all(bind=engine)
#bind = engine means whenever you create a session use this engine to comms with the DB.