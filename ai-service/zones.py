"""Finds disaster areas from the reports people send.

One report is just an incident. Several reports of trouble in the same small area within
a few hours is a disaster: a flood, a landslide, an earthquake. This groups reports by
place (DBSCAN clustering), works out what kind of hazard the words describe, and rates
how serious it is, so the backend can warn people and route them around the area.
"""
import re
from datetime import datetime, timedelta, timezone

import numpy as np
from sklearn.cluster import DBSCAN

EARTH_RADIUS_KM = 6371.0088

# How close reports must be to count as the same area, and how many make an area.
CLUSTER_RADIUS_KM = 5.0
MIN_REPORTS = 2
# Only recent reports count, so an area stops being "active" once reports stop coming.
DEFAULT_WINDOW_HOURS = 12

# Reports about people being safe don't say anything about a hazard.
HAZARD_TYPES = {"rescue", "injured", "incident", "missing"}

# What kind of hazard the words describe. The first match wins.
HAZARD_PATTERNS = [
    ("flood", r"\b(?:flood\w*|water (?:\w+ )?rising|inundat\w*|swollen river|burst bank|dam (?:burst|break)\w*)\b"),
    ("landslide", r"\b(?:landslides?|mudslides?|rockfalls?|slope (?:failure|collapse)|debris flow)\b"),
    ("earthquake", r"\b(?:earthquakes?|quake|aftershocks?|tremors?|building collapsed?)\b"),
    ("avalanche", r"\b(?:avalanche|snow slide|icefall collapse|serac)\b"),
    ("fire", r"\b(?:wildfire|forest fire|bush fire|fire (?:spread|broke out)|burning)\b"),
    ("storm", r"\b(?:storm|blizzard|cyclone|typhoon|hurricane|heavy (?:rain|snow)|whiteout|lightning)\b"),
]

# How much each kind of report adds to how serious an area looks.
TYPE_WEIGHT = {"rescue": 2.0, "injured": 1.5, "incident": 1.0, "missing": 0.5}


def _parse_time(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _hazard_kind(text: str):
    for hazard, pattern in HAZARD_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return hazard
    return None


def _distance_km(lat_a, lon_a, lat_b, lon_b) -> float:
    lat1, lon1, lat2, lon2 = map(np.radians, (lat_a, lon_a, lat_b, lon_b))
    inner = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return float(2 * EARTH_RADIUS_KM * np.arcsin(np.sqrt(inner)))


def _severity(members: list) -> tuple[str, float]:
    # Rescues weigh most, then injuries, then hazards themselves, plus the people involved.
    urgency = sum(TYPE_WEIGHT.get(str(r.get("type", "")).lower(), 0.5) for r in members)
    people = sum(int(r.get("people_count") or 0) for r in members)
    score = urgency + people / 4
    if score >= 8:
        return "critical", score
    if score >= 4:
        return "warning", score
    return "watch", score


def detect_zones(reports: list, now=None, window_hours: float = DEFAULT_WINDOW_HOURS) -> list:
    """Group recent reports into disaster areas. Each area needs at least MIN_REPORTS
    reports within CLUSTER_RADIUS_KM of each other."""
    now = _parse_time(now) or datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=window_hours)

    usable = []
    for report in reports:
        latitude, longitude = report.get("latitude"), report.get("longitude")
        if latitude is None or longitude is None:
            continue
        if str(report.get("type", "")).lower() not in HAZARD_TYPES:
            continue
        reported_at = _parse_time(report.get("time"))
        if reported_at is not None and reported_at < cutoff:
            continue
        usable.append({**report, "latitude": float(latitude), "longitude": float(longitude), "_time": reported_at})

    if len(usable) < MIN_REPORTS:
        return []

    coordinates = np.radians([[r["latitude"], r["longitude"]] for r in usable])
    labels = DBSCAN(
        eps=CLUSTER_RADIUS_KM / EARTH_RADIUS_KM,
        min_samples=MIN_REPORTS,
        metric="haversine",
    ).fit_predict(coordinates)

    zones = []
    for label in sorted(set(labels)):
        if label == -1:  # reports that stand alone are not an area
            continue
        members = [report for report, member_label in zip(usable, labels) if member_label == label]
        center_latitude = float(np.mean([r["latitude"] for r in members]))
        center_longitude = float(np.mean([r["longitude"] for r in members]))
        spread_km = max(_distance_km(center_latitude, center_longitude, r["latitude"], r["longitude"]) for r in members)
        severity, score = _severity(members)

        hazards = [h for h in (_hazard_kind(str(r.get("message", ""))) for r in members) if h]
        hazard = max(set(hazards), key=hazards.count) if hazards else "unknown"

        times = [r["_time"] for r in members if r["_time"] is not None]
        places = [str(r.get("location")) for r in members if r.get("location")]
        place = max(set(places), key=places.count) if places else None
        counts = {}
        for report in members:
            kind = str(report.get("type", "")).lower()
            counts[kind] = counts.get(kind, 0) + 1
        breakdown = ", ".join(f"{count} {kind}" for kind, count in sorted(counts.items(), key=lambda kv: -kv[1]))

        zones.append({
            "hazard": hazard,
            "severity": severity,
            # More reports, spread over a small area, means a clearer picture.
            "confidence": round(min(0.95, 0.4 + 0.12 * len(members) + (0.15 if spread_km <= 3 else 0)), 2),
            "center_latitude": round(center_latitude, 6),
            "center_longitude": round(center_longitude, 6),
            # The area covers the reports plus a short buffer around them.
            "radius_km": round(min(50.0, max(2.0, spread_km + 1.5)), 2),
            "report_ids": [str(r.get("id")) for r in members],
            "report_count": len(members),
            "people_count": sum(int(r.get("people_count") or 0) for r in members),
            "score": round(score, 2),
            "place": place,
            "latest_report_at": max(times).isoformat() if times else None,
            "summary": f"{len(members)} reports in this area ({breakdown}).",
        })

    zones.sort(key=lambda zone: zone["score"], reverse=True)
    return zones
