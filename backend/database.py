import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
#after creating the models; we want to make sure to tell PostgreSQL to create corresponding tables
from backend.models import Base

from sqlalchemy.orm import sessionmaker
from sqlalchemy.schema import CreateColumn

# Read settings from a .env file (backend/.env or the repo root) if there is one.
load_dotenv()

#create_engine is a SQLAlchemy mechanism that allows for creating a database engine.
# The database comes from the DATABASE_URL setting. Without it, the backend uses a
# local SQLite file (backend/trac.db) so it runs on any machine with no setup.
# For PostgreSQL, put a line like this in backend/.env:
# DATABASE_URL=postgresql+psycopg://ngawangtharchinsherpa@localhost:5432/trac
#("postgresql+psycopg" means: use postgresql through the psycopg driver.)
DEFAULT_DATABASE_URL = "sqlite:///" + (Path(__file__).resolve().parent / "trac.db").as_posix()
DATABASE_URL = os.getenv("DATABASE_URL") or DEFAULT_DATABASE_URL

# SQLite only lets one thread use a connection unless we allow it; FastAPI uses several.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine)
#SessionLocal creates a session factory using sessionmaker...
#bind = engine means whenever you create a session use this engine to communicate with the database
def get_db():
    db = SessionLocal()

    try:
        yield db #yield allows us to pause for a moment. #this pause is taken by FastAPI to work with session.
    finally:
        db.close() #when it is unpaused... session is closed.


def add_missing_columns():
    # create_all only creates tables that don't exist yet; it never changes an existing table.
    # So when we add a column to a model (like latitude/longitude), a reports table that was
    # created earlier won't have it, and saving a report fails. This adds any missing columns.
    inspector = inspect(engine)
    for table in Base.metadata.sorted_tables:
        if not inspector.has_table(table.name):
            continue
        existing_columns = {column["name"] for column in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in existing_columns:
                continue
            column_sql = CreateColumn(column).compile(dialect=engine.dialect)
            with engine.begin() as connection:
                connection.execute(text(f"ALTER TABLE {table.name} ADD COLUMN {column_sql}"))


# Columns that were renamed as the project grew. Renaming a column in the model adds a new,
# empty column to an existing database and leaves the old one behind with all the data, so
# the values are copied across once. (latitude/longitude became the incident's position.)
RENAMED_COLUMNS = {
    "reports": [("latitude", "incident_latitude"), ("longitude", "incident_longitude")],
}


def copy_renamed_columns():
    inspector = inspect(engine)
    for table_name, renames in RENAMED_COLUMNS.items():
        if not inspector.has_table(table_name):
            continue
        columns = {column["name"] for column in inspector.get_columns(table_name)}
        for old_name, new_name in renames:
            if old_name not in columns or new_name not in columns:
                continue
            with engine.begin() as connection:
                connection.execute(
                    text(
                        f"UPDATE {table_name} SET {new_name} = {old_name} "
                        f"WHERE {new_name} IS NULL AND {old_name} IS NOT NULL"
                    )
                )


Base.metadata.create_all(bind=engine)
#bind = engine means whenever you create a session use this engine to comms with the DB.
add_missing_columns()
copy_renamed_columns()
