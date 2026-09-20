from datetime import datetime, timezone

from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
#ensuring we can use Base to point that whoever inherits from Base will be a model.
from sqlalchemy import DateTime, String, Enum
#postgresql has many types of column such as VARCHAR, TEXT, Integer, boolean etc.
#we need to make sure that the column uses String

from backend.schemas import Reporttype, ReportStatus
#we want to make sure our type is pydantic.


class Base(DeclarativeBase):
    pass

class ReportModel(Base):
    #here we are saying Report = database model and it represent a postgresql table 
    #called reports.
    __tablename__ = "reports"
    # SQLite would otherwise give a deleted report's id to the next new one, so an old
    # tracking link (/reports/8) could show someone else's report. PostgreSQL never reuses ids.
    __table_args__ = {"sqlite_autoincrement": True}

    id : Mapped[int] = mapped_column(primary_key=True)

    #id:Mapped[int] means this model has an id and it is expected to be int.
    #mapped_column means make it a database column
    #primary_key = True means make it a primary key....

    type:Mapped[Reporttype] = mapped_column(Enum(Reporttype))
        #ok this is us saying type is a part of this model and it must be of the ReportType
        #next : we prev. did Class ReportType(Enum) now we are saying Enum(ReportType)
        #which means create a SQL Alchemy Enum based on my ReportType Enum.
    
    message:Mapped[str] =mapped_column(String)

    location:Mapped[str | None] = mapped_column(String,nullable = True)

    #adding latitude and longitude of where incident occured.
    incident_latitude: Mapped[float | None] = mapped_column(nullable=True)
    incident_longitude: Mapped[float | None] = mapped_column(nullable=True)

    reporter_latitude: Mapped[float | None] = mapped_column(nullable=True)
    reporter_longitude: Mapped[float | None] = mapped_column(nullable=True)

    # Where the report is in the response workflow: open, in_progress or resolved.
    # It's stored as plain text (not a database enum) so it can be added to an existing table.
    status: Mapped[str] = mapped_column(
        String(20), default=ReportStatus.OPEN.value, server_default=ReportStatus.OPEN.value
    )

    # When the report was received, in UTC. Reports saved before this column existed have none.
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Filled in by the AI service after a report is saved or edited (see backend/ai.py).
    # ai_state is "pending" while the AI checks the report, then "done", or "failed"
    # if the AI couldn't be reached. ai_source is "rules" (keyword rules) or "model" (a language model).
    ai_state: Mapped[str | None] = mapped_column(String(20), nullable=True)
    people_count: Mapped[int | None] = mapped_column(nullable=True)
    person_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    ai_suggested_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    ai_source: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # An earlier report the AI thinks this one repeats, and how sure it is (0 to 1).
    # duplicate_state is "suggested" by the AI, then "confirmed" or "dismissed" by a coordinator.
    duplicate_of: Mapped[int | None] = mapped_column(nullable=True)
    duplicate_score: Mapped[float | None] = mapped_column(nullable=True)
    duplicate_state: Mapped[str | None] = mapped_column(String(20), nullable=True)
