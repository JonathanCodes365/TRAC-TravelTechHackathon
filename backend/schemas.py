from datetime import datetime, timezone

from pydantic import BaseModel, Field, field_validator, model_validator
#for validation
from typing import Literal, Optional
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
    incident_latitude:Optional[float]= Field(default=None, ge=-90, le=90)
    incident_longitude:Optional[float]= Field(default=None, ge=-180, le=180)
    reporter_latitude:Optional[float]= Field(default=None, ge=-90, le=90)
    reporter_longitude:Optional[float]= Field(default=None, ge=-180, le=180)
    # Trim spaces around text, so "   " doesn't count as a message.
    model_config = {"str_strip_whitespace": True}

    @field_validator("location")
    @classmethod
    def blank_location_is_none(cls, value):
        return value or None

    @model_validator(mode="after")
    def coordinates_come_in_pairs(self):
        # A latitude without a longitude (or the other way round) isn't a place.
        if (self.incident_latitude is None) != (self.incident_longitude is None):
            raise ValueError("incident latitude and longitude must be sent together")
        if (self.reporter_latitude is None) != (self.reporter_longitude is None):
            raise ValueError("incident latitude and longitude must be sent together")

        return self
class ReportUpdate(BaseModel):
    # Body for PATCH /reports/{id}: send only the fields you want to change,
    # for example {"status": "resolved"}.
    type: Optional[Reporttype] = None
    message: Optional[str] = Field(default=None, min_length=1, max_length=2000)
    location: Optional[str] = Field(default=None, max_length=200)
    incident_latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    incident_longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    reporter_latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    reporter_longitude: Optional[float] = Field(default=None, ge=-180, le=180)

    status: Optional[ReportStatus] = None
    # A coordinator's answer to the AI's duplicate suggestion.
    duplicate_state: Optional[Literal["confirmed", "dismissed"]] = None

    model_config = {"str_strip_whitespace": True}

    @field_validator("location")
    @classmethod
    def blank_location_is_none(cls, value):
        return value or None

    @model_validator(mode="after")
    def check_changes(self):
        sent = self.model_fields_set
        for name in ("type", "message", "status", "duplicate_state"):
            if name in sent and getattr(self, name) is None:
                raise ValueError(f"{name} can't be empty")
        if ("incident_latitude" in sent) != ("incident_longitude" in sent) or (self.incident_latitude is None) != (self.incident_longitude is None):
            raise ValueError("incident latitude and longitude must be changed together")
        if ("reporter_latitude" in sent) != ("reporter_longitude" in sent) or (self.reporter_latitude is None) != (self.reporter_longitude is None):
                raise ValueError("reporter latitude and longitude must be changed together")
        return self


class ReportResponse(BaseModel):
    id: int
    type:Reporttype
    message:str
    location:Optional[str] = None

    #adding functionality of latitude and longitude
    incident_latitude:Optional[float]=None
    incident_longitude:Optional[float]=None

    reporter_latitude:Optional[float]=None
    reporter_longitude:Optional[float]=None


    status: ReportStatus = ReportStatus.OPEN
    created_at: Optional[datetime] = None

    # What the AI found (see backend/ai.py). Empty until the AI has checked the report.
    ai_state: Optional[Literal["pending", "done", "failed"]] = None
    people_count: Optional[int] = None
    person_name: Optional[str] = None
    ai_suggested_type: Optional[Reporttype] = None
    ai_source: Optional[str] = None
    duplicate_of: Optional[int] = None
    duplicate_score: Optional[float] = None
    duplicate_state: Optional[Literal["suggested", "confirmed", "dismissed"]] = None

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


class DangerZone(BaseModel):
    # An area where something dangerous is happening (see backend/zones.py).
    id: int
    source: Literal["reports", "usgs"]
    hazard: str
    severity: Literal["watch", "warning", "critical"]
    title: str
    summary: Optional[str] = None
    center_latitude: float
    center_longitude: float
    radius_km: float
    report_count: int = 0
    people_count: Optional[int] = None
    confidence: Optional[float] = None
    magnitude: Optional[float] = None
    external_url: Optional[str] = None
    event_time: Optional[datetime] = None
    first_seen: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    active: bool = True

    model_config = {"from_attributes": True}

    @field_validator("event_time", "first_seen", "updated_at")
    @classmethod
    def times_are_utc(cls, value):
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class Point(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class RouteRequest(BaseModel):
    # Where someone is and where they want to go, to find a way around the danger areas.
    start: Point
    end: Point


class RouteOption(BaseModel):
    label: str  # "Safest route", "Fastest route", ...
    distance_km: float
    duration_min: float
    # The line to draw on the map, as [latitude, longitude] pairs.
    geometry: list[list[float]]
    # Ids of the danger areas this route goes through; empty means it stays clear of them.
    zones: list[int] = []
    # How far the route travels inside danger areas, in kilometres.
    zone_km: float = 0
    risk: Literal["clear", "passes_zone"]
    recommended: bool = False


class RouteResponse(BaseModel):
    routes: list[RouteOption]
    zones: list[DangerZone]
    advice: str
    # Areas around the start or the destination: no route can avoid these.
    start_zones: list[int] = []
    end_zones: list[int] = []