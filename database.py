from sqlalchemy import create_engine

#create_engine is a SQLAlchemy mechanism that allows for creating a database engine.
DATABASE_URL = "postgresql+psycopg://ngawangtharchinsherpa@localhost:5432/trac"
#it means Use postgresql through psycopg driver.
engine = create_engine(DATABASE_URL)

with engine.connect() as connection:
    print("Database Connected")