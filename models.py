from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
#ensuring we can use Base to point that whoever inherits from Base will be a model.
from sqlalchemy import String,Integer
#postgresql has many types of column such as VARCHAR, TEXT, Integer, boolean etc.
#we need to make sure that the column uses String


class Base(DeclarativeBase):
    pass

class Report(Base):
    #here we are saying Report = database model and it represent a postgresql table 
    #called reports.
    __tablename__ = "reports"

    id : Mapped[int] = mapped_column(primary_key=True)

    #id:Mapped[int] means this model has an id and it is expected to be int.
    #mapped_column means make it a database column
    #primary_key = True means make it a primary key....
    message:Mapped[str] =mapped_column(String)
    location:Mapped[str | None] = mapped_column(String,nullable = True)