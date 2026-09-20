import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
import joblib

from extraction import extract as run_extraction, extraction_mode
from features import build_feature_vector
from report_features import build_report_feature_vector
from zones import detect_zones

app = FastAPI(title="TRAC AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the models from this folder, whichever folder the service is started from.
HERE = os.path.dirname(os.path.abspath(__file__))
duplicate_model = joblib.load(os.path.join(HERE, "model.pkl"))
report_duplicate_model = joblib.load(os.path.join(HERE, "report_model.pkl"))

MERGE_THRESHOLD = 0.80
REVIEW_THRESHOLD = 0.40


class ExtractRequest(BaseModel):
    # min_length=1: an empty report has nothing to extract.
    report_text: str = Field(min_length=1, max_length=5000)


class PersonRecord(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    time: Optional[str] = None
    people_count: Optional[int] = None


class DuplicateCheckRequest(BaseModel):
    new_record: PersonRecord
    existing_records: List[PersonRecord]


class ReportRecord(BaseModel):
    id: Optional[str] = None
    message: Optional[str] = None
    type: Optional[str] = None
    location: Optional[str] = None
    time: Optional[str] = None


class ReportDuplicateCheckRequest(BaseModel):
    new_record: ReportRecord
    existing_records: List[ReportRecord]


@app.post("/extract")
def extract_endpoint(req: ExtractRequest):
    result = run_extraction(req.report_text)
    return result


@app.post("/check-duplicate")
def check_duplicate_endpoint(req: DuplicateCheckRequest):
    new_record = req.new_record.model_dump()
    results = []

    for existing in req.existing_records:
        existing_dict = existing.model_dump()
        feature_vector = build_feature_vector(new_record, existing_dict)
        probability = duplicate_model.predict_proba([feature_vector])[0][1]

        if probability >= MERGE_THRESHOLD:
            decision = "merge"
        elif probability >= REVIEW_THRESHOLD:
            decision = "review"
        else:
            decision = "new_entry"

        results.append({
            "existing_id": existing.id,
            "probability": round(float(probability), 3),
            "decision": decision,
        })

    results.sort(key=lambda r: r["probability"], reverse=True)
    return {"matches": results}


@app.post("/check-report-duplicate")
def check_report_duplicate_endpoint(req: ReportDuplicateCheckRequest):
    new_record = req.new_record.model_dump()
    results = []

    for existing in req.existing_records:
        existing_dict = existing.model_dump()
        feature_vector = build_report_feature_vector(new_record, existing_dict)
        probability = report_duplicate_model.predict_proba([feature_vector])[0][1]

        if probability >= MERGE_THRESHOLD:
            decision = "merge"
        elif probability >= REVIEW_THRESHOLD:
            decision = "review"
        else:
            decision = "new_entry"

        results.append({
            "existing_id": existing.id,
            "probability": round(float(probability), 3),
            "decision": decision,
        })

    results.sort(key=lambda r: r["probability"], reverse=True)
    return {"matches": results}


class ZoneReport(BaseModel):
    id: Optional[str] = None
    type: Optional[str] = None
    message: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    people_count: Optional[int] = None
    time: Optional[str] = None


class DetectZonesRequest(BaseModel):
    reports: List[ZoneReport]
    # "now" and the window decide which reports still count as current.
    now: Optional[str] = None
    window_hours: float = Field(default=12, gt=0, le=168)


@app.post("/detect-zones")
def detect_zones_endpoint(req: DetectZonesRequest):
    # Group recent reports into disaster areas: where, what kind, and how serious (zones.py).
    zones = detect_zones([report.model_dump() for report in req.reports], now=req.now, window_hours=req.window_hours)
    return {"zones": zones}


@app.get("/health")
def health():
    # "extraction" says how /extract works right now: "rules" (keywords) or a provider like "openai".
    return {"status": "ok", "extraction": extraction_mode()}