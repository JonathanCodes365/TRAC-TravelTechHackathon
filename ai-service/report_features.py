from difflib import SequenceMatcher
from datetime import datetime


def message_similarity(msg_a, msg_b):
    if not msg_a or not msg_b:
        return 0.3
    return SequenceMatcher(None, msg_a.strip().lower(), msg_b.strip().lower()).ratio()


def type_match(type_a, type_b):
    if not type_a or not type_b:
        return 0.5
    return 1.0 if type_a.strip().lower() == type_b.strip().lower() else 0.0


def location_match(loc_a, loc_b):
    if not loc_a or not loc_b:
        return 0.3
    a, b = loc_a.strip().lower(), loc_b.strip().lower()
    if a == b:
        return 1.0
    if a in b or b in a:
        return 0.7
    return 0.0


def time_closeness(time_a, time_b):
    try:
        ta = datetime.fromisoformat(time_a)
        tb = datetime.fromisoformat(time_b)
    except (ValueError, TypeError):
        return 0.3
    gap_minutes = abs((ta - tb).total_seconds()) / 60.0
    return round(max(0.0, 1.0 - (gap_minutes / 180.0)), 3)


def build_report_feature_vector(report_a, report_b):
    return [
        message_similarity(report_a.get("message"), report_b.get("message")),
        type_match(report_a.get("type"), report_b.get("type")),
        location_match(report_a.get("location"), report_b.get("location")),
        time_closeness(report_a.get("time"), report_b.get("time")),
    ]


REPORT_FEATURE_NAMES = ["message_similarity", "type_match", "location_match", "time_closeness"]