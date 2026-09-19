from typing import Optional
from enum import Enum

from fastapi import FastAPI
from pydantic import BaseModel


class ReportType(Enum):
    RESCUE = "rescue"
    MISSING = "missing"
    INJURED = "injured"
    SAFE = "safe"
    INCIDENT = "incident"


app = FastAPI()


class Report(BaseModel):
    type: ReportType
    message: str
    location: Optional[str] = None


@app.get("/about")
def about():
    return {"message": "TRAC disaster coordination API"}


@app.post("/reports")
def receive_reports(report: Report):
    # FastAPI receives the request body,
    # validates it using the Report model,
    # and gives us the validated data in `report`.

    if report.type == ReportType.RESCUE:
        print("This is a rescue alert!")
    else:
        print("XYZ")

    return {"message": "Report received"}