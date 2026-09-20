"""Connection to the TRAC AI service (the FastAPI app in ai-service/).

The AI is a helper, not a requirement: if it's down or slow, reports still save
right away, and the report just shows that the AI check didn't run.
"""
import os
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv
from sqlalchemy import or_

from backend.database import SessionLocal
from backend.models import ReportModel
from backend.schemas import Reporttype

load_dotenv()

# Where the AI service runs. Override with AI_SERVICE_URL in backend/.env.
AI_SERVICE_URL = (os.getenv("AI_SERVICE_URL") or "http://127.0.0.1:8001").rstrip("/")
# Language models can be slow; the AI service itself gives up on them after 15 seconds.
TIMEOUT = httpx.Timeout(25.0, connect=3.0)

# How many earlier reports to compare a new one with, and the lowest duplicate score worth showing.
DUPLICATE_CANDIDATES = 200
REVIEW_THRESHOLD = 0.40

# The AI describes people as missing, injured, rescued or safe, while we use report types.
# Careful with "rescued": it means the people are already out of danger, so it's our "safe".
# Our "rescue" type means someone still needs rescuing.
AI_STATUS_TO_REPORT_TYPE = {
    "rescued": Reporttype.SAFE,
    "injured": Reporttype.INJURED,
    "missing": Reporttype.MISSING,
    "safe": Reporttype.SAFE,
}


class AIUnavailable(Exception):
    """The AI service couldn't be reached, or its answer couldn't be used."""


def _post(path: str, payload: dict) -> dict:
    try:
        response = httpx.post(f"{AI_SERVICE_URL}{path}", json=payload, timeout=TIMEOUT)
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise AIUnavailable(f"{path}: {error}") from error


def health() -> dict | None:
    """The AI service's /health answer, or None if it isn't running."""
    try:
        response = httpx.get(f"{AI_SERVICE_URL}/health", timeout=3.0)
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError):
        return None


def extract(text: str) -> dict:
    """What the AI reads in a message: name, location, status, people_count, report_type..."""
    return _post("/extract", {"report_text": text})


def detect_zones(reports: list[dict], window_hours: float) -> list[dict]:
    """Ask the AI to group recent reports into disaster areas (see ai-service/zones.py)."""
    answer = _post("/detect-zones", {"reports": reports, "window_hours": window_hours})
    return answer.get("zones", [])


def suggested_type(extracted: dict) -> Reporttype | None:
    """The report type the AI suggests: its report_type if it gave a valid one,
    otherwise a translation of the person status it found."""
    try:
        return Reporttype(str(extracted.get("report_type") or "").strip().lower())
    except ValueError:
        return AI_STATUS_TO_REPORT_TYPE.get(str(extracted.get("status") or "").strip().lower())


def people_count(value) -> int | None:
    try:
        count = int(value)
    except (TypeError, ValueError):
        return None
    return count if 0 < count < 10_000 else None


def person_name(value) -> str | None:
    return value.strip()[:120] if isinstance(value, str) and value.strip() else None


def utc_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:  # SQLite drops the timezone; we always store UTC
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def parse_iso(value) -> datetime | None:
    """A time from the AI service (or any ISO text) as a UTC datetime."""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _as_record(report: ReportModel) -> dict:
    # The shape the AI's /check-report-duplicate expects.
    return {
        "id": str(report.id),
        "message": report.message,
        "type": report.type.value,
        "location": report.location,
        "time": utc_iso(report.created_at),
    }


def _best_duplicate(report: ReportModel, db) -> tuple[int, float] | None:
    # Only earlier reports can be the original. Reports already confirmed as duplicates
    # are skipped, so a new duplicate points at the original rather than at a copy.
    candidates = (
        db.query(ReportModel)
        .filter(ReportModel.id < report.id)
        .filter(or_(ReportModel.duplicate_state.is_(None), ReportModel.duplicate_state != "confirmed"))
        .order_by(ReportModel.id.desc())
        .limit(DUPLICATE_CANDIDATES)
        .all()
    )
    if not candidates:
        return None
    answer = _post(
        "/check-report-duplicate",
        {"new_record": _as_record(report), "existing_records": [_as_record(r) for r in candidates]},
    )
    for match in answer.get("matches", []):
        try:
            existing_id, score = int(match["existing_id"]), float(match["probability"])
        except (KeyError, TypeError, ValueError):
            continue
        if score >= REVIEW_THRESHOLD:
            return existing_id, score
    return None


def enrich_report(report_id: int) -> None:
    """Background job after a report is saved or edited: ask the AI what the report says
    and whether it repeats an earlier report, then save the answers on the report."""
    db = SessionLocal()
    try:
        report = db.get(ReportModel, report_id)
        if report is None:
            return
        try:
            extracted = extract(report.message)
            duplicate = _best_duplicate(report, db)
        except AIUnavailable as error:
            print(f"[ai] report #{report_id}: AI service unavailable ({error})")
            report.ai_state = "failed"
            db.commit()
            return

        report.people_count = people_count(extracted.get("people_count"))
        report.person_name = person_name(extracted.get("name"))
        ai_type = suggested_type(extracted)
        report.ai_suggested_type = ai_type.value if ai_type else None
        report.ai_source = "rules" if extracted.get("_mock") else "model"

        # A coordinator's decision (confirmed or dismissed) is kept; only AI suggestions refresh.
        if report.duplicate_state not in ("confirmed", "dismissed"):
            if duplicate:
                report.duplicate_of, report.duplicate_score = duplicate
                report.duplicate_state = "suggested"
            else:
                report.duplicate_of = report.duplicate_score = report.duplicate_state = None

        report.ai_state = "done"
        db.commit()

        # A new or changed report can create or grow a disaster area, so check straight away
        # instead of waiting for the timer. Imported here to avoid a circular import.
        try:
            from backend import zones

            zones.refresh_after_report()
        except Exception as error:
            print(f"[ai] report #{report_id}: couldn't update disaster areas ({error})")
    except Exception as error:  # e.g. the report was deleted while the AI was working
        db.rollback()
        print(f"[ai] report #{report_id}: couldn't save AI results ({error})")
        try:
            report = db.get(ReportModel, report_id)
            if report is not None:
                report.ai_state = "failed"
                db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()
