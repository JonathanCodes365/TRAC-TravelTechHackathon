from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import joblib

from extraction import extract as run_extraction
from features import build_feature_vector
from report_features import build_report_feature_vector

app = FastAPI(title="TRAC AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

duplicate_model = joblib.load("model.pkl")
report_duplicate_model = joblib.load("report_model.pkl")

MERGE_THRESHOLD = 0.80
REVIEW_THRESHOLD = 0.40


class ExtractRequest(BaseModel):
    report_text: str


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


@app.get("/health")
def health():
    return {"status": "ok"}