from sqlalchemy import create_engine
#after creating the models; we want to make sure to tell PostgreSQL to create corresponding tables
from models import Base

#create_engine is a SQLAlchemy mechanism that allows for creating a database engine.
DATABASE_URL = "postgresql+psycopg://ngawangtharchinsherpa@localhost:5432/trac"
#it means Use postgresql through psycopg driver.
engine = create_engine(DATABASE_URL)

Base.metadata.create_all(bind=engine)