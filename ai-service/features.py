from difflib import SequenceMatcher
from datetime import datetime


def name_similarity(name_a: str, name_b: str) -> float:
    if not name_a or not name_b:
        return 0.3
    a, b = name_a.strip().lower(), name_b.strip().lower()
    return SequenceMatcher(None, a, b).ratio()


def location_match(loc_a: str, loc_b: str) -> float:
    if not loc_a or not loc_b:
        return 0.3
    a, b = loc_a.strip().lower(), loc_b.strip().lower()
    if a == b:
        return 1.0
    if a in b or b in a:
        return 0.7
    return 0.0


def time_closeness(time_a: str, time_b: str) -> float:
    try:
        ta = datetime.fromisoformat(time_a)
        tb = datetime.fromisoformat(time_b)
    except (ValueError, TypeError):
        return 0.3

    gap_minutes = abs((ta - tb).total_seconds()) / 60.0
    score = max(0.0, 1.0 - (gap_minutes / 180.0))
    return round(score, 3)


def status_compatible(status_a: str, status_b: str) -> float:
    if not status_a or not status_b:
        return 0.5
    a, b = status_a.strip().lower(), status_b.strip().lower()
    if a == b:
        return 1.0
    plausible_progressions = {
        ("missing", "rescued"), ("rescued", "missing"),
        ("missing", "injured"), ("injured", "missing"),
        ("injured", "rescued"), ("rescued", "injured"),
        ("missing", "safe"), ("safe", "missing"),
    }
    if (a, b) in plausible_progressions:
        return 0.7
    return 0.2


def people_count_match(count_a: int, count_b: int) -> float:
    if count_a is None or count_b is None:
        return 0.5
    if count_a == count_b:
        return 1.0
    diff = abs(count_a - count_b)
    return max(0.0, 1.0 - diff * 0.3)


def build_feature_vector(record_a: dict, record_b: dict) -> list:
    return [
        name_similarity(record_a.get("name"), record_b.get("name")),
        location_match(record_a.get("location"), record_b.get("location")),
        time_closeness(record_a.get("time"), record_b.get("time")),
        status_compatible(record_a.get("status"), record_b.get("status")),
        people_count_match(record_a.get("people_count"), record_b.get("people_count")),
    ]


FEATURE_NAMES = [
    "name_similarity",
    "location_match",
    "time_closeness",
    "status_compatible",
    "people_count_match",
]