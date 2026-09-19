from datetime import datetime, timezone

from pydantic import BaseModel, Field, field_validator, model_validator
#for validation
from typing import Optional
#for optional data.
from enum import Enum
#this is to make sure that the user can only select from a few range of type we specify.


#note schemas is for pydantic schemas.



class Reporttype(Enum):
    RESCUE = "rescue"
    MISSING = "missing"
    INJURED = "injured"
    SAFE = "safe"
    INCIDENT = "incident"


class ReportStatus(Enum):
    # Where a report is in the response workflow. New reports start as open.
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"


class Report(BaseModel):
    type:Reporttype
    # min_length=1 (after trimming spaces) means an empty message is rejected.
    message:str = Field(min_length=1, max_length=2000)
    location:Optional[str]= Field(default=None, max_length=200)
    #we are adding latitude and longitude here... 
    #we are making sure these are additional as well.. cause if there is no location
    #there might be no latitude and longitude to work with.
    # ge/le keep them on the map: latitude is -90..90 and longitude is -180..180.
    latitude:Optional[float]= Field(default=None, ge=-90, le=90)
    longitude:Optional[float]= Field(default=None, ge=-180, le=180)

    # Trim spaces around text, so "   " doesn't count as a message.
    model_config = {"str_strip_whitespace": True}

    @field_validator("location")
    @classmethod
    def blank_location_is_none(cls, value):
        return value or None

    @model_validator(mode="after")
    def coordinates_come_in_pairs(self):
        # A latitude without a longitude (or the other way round) isn't a place.
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be sent together")
        return self


class ReportUpdate(BaseModel):
    # Body for PATCH /reports/{id}: send only the fields you want to change,
    # for example {"status": "resolved"}.
    type: Optional[Reporttype] = None
    message: Optional[str] = Field(default=None, min_length=1, max_length=2000)
    location: Optional[str] = Field(default=None, max_length=200)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    status: Optional[ReportStatus] = None

    model_config = {"str_strip_whitespace": True}

    @field_validator("location")
    @classmethod
    def blank_location_is_none(cls, value):
        return value or None

    @model_validator(mode="after")
    def check_changes(self):
        sent = self.model_fields_set
        for name in ("type", "message", "status"):
            if name in sent and getattr(self, name) is None:
                raise ValueError(f"{name} can't be empty")
        if ("latitude" in sent) != ("longitude" in sent) or (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be changed together")
        return self


class ReportResponse(BaseModel):
    id: int
    type:Reporttype
    message:str
    location:Optional[str] = None

    #adding functionality of latitude and longitude
    latitude:Optional[float]=None
    longitude:Optional[float]=None

    status: ReportStatus = ReportStatus.OPEN
    created_at: Optional[datetime] = None

    model_config = {
        "from_attributes":True
    }

    @field_validator("status", mode="before")
    @classmethod
    def missing_status_is_open(cls, value):
        return value or ReportStatus.OPEN

    @field_validator("created_at")
    @classmethod
    def times_are_utc(cls, value):
        # SQLite doesn't keep the timezone. We always save UTC, so mark it as UTC again.
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

#here we create our pydantic checking for the incoming info: