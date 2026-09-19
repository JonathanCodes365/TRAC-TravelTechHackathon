from sqlalchemy import create_engine
#after creating the models; we want to make sure to tell PostgreSQL to create corresponding tables
from models import Base

from sqlalchemy.orm import sessionmaker

#create_engine is a SQLAlchemy mechanism that allows for creating a database engine.
DATABASE_URL = "postgresql+psycopg://ngawangtharchinsherpa@localhost:5432/trac"
#it means Use postgresql through psycopg driver.
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
#SessionLocal creates a session factory using sessionmaker...
#bind = engine means whenever you create a session use this engine to communicate with the database
def get_db():
    db = SessionLocal()

    try:
        yield db #yield allows us to pause for a moment. #this pause is taken by FastAPI to work with session.
    finally:
        db.close() #when it is unpaused... session is closed.


Base.metadata.create_all(bind=engine)
#bind = engine means whenever you create a session use this engine to comms with the DB.