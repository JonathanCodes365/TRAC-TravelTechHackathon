"""Turning a typed place name into coordinates, for the route planner's From and To boxes.

Three sources, best first:
- coordinates typed straight in ("27.7172, 85.3240");
- places TRAC already knows: the danger areas being tracked and the locations people have
  written on their reports, so the name of an area on the dashboard just works;
- OpenStreetMap's Nominatim geocoder for everywhere else. It needs no API key, but its
  terms ask callers to identify themselves and to stay under one request a second.

Matching ignores capitals everywhere.
"""

import os
import re
import threading
import time

import httpx
from sqlalchemy import func

from backend.models import DangerZoneModel, ReportModel

GEOCODER_URL = os.getenv("GEOCODER_URL", "https://nominatim.openstreetmap.org/search")
GEOCODER_ENABLED = os.getenv("GEOCODER", "on").strip().lower() not in {"off", "0", "false", "no"}
GEOCODER_TIMEOUT = httpx.Timeout(8.0, connect=4.0)
USER_AGENT = os.getenv(
    "GEOCODER_USER_AGENT", "TRAC-TravelTechHackathon (travel disaster coordination)"
)
SECONDS_BETWEEN_CALLS = 1.0

# "27.7172, 85.3240" or "27.7172 85.3240"
COORDINATES = re.compile(r"^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$")

_geocoder_lock = threading.Lock()
_last_call = 0.0
_cache: dict[str, list[dict]] = {}


def _typed_coordinates(query: str) -> list[dict]:
    match = COORDINATES.match(query)
    if not match:
        return []
    latitude, longitude = float(match.group(1)), float(match.group(2))
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return []
    return [{
        "name": f"{latitude:.5f}, {longitude:.5f}",
        "detail": "The coordinates you typed",
        "latitude": latitude,
        "longitude": longitude,
        "source": "coordinates",
    }]


def _from_zones(db, needle: str, hazards: dict[str, str]) -> list[dict]:
    rows = (
        db.query(DangerZoneModel)
        .filter(DangerZoneModel.active.is_(True))
        .filter(func.lower(DangerZoneModel.title).like(needle))
        .order_by(DangerZoneModel.report_count.desc())
        .limit(5)
        .all()
    )
    return [{
        "name": zone.title,
        "detail": f"{hazards.get(zone.severity, zone.severity)} · danger area TRAC is tracking",
        "latitude": zone.center_latitude,
        "longitude": zone.center_longitude,
        "source": "zone",
    } for zone in rows if zone.center_latitude is not None and zone.center_longitude is not None]


def _from_reports(db, needle: str) -> list[dict]:
    rows = (
        db.query(
            ReportModel.location,
            func.count(ReportModel.id),
            func.avg(ReportModel.incident_latitude),
            func.avg(ReportModel.incident_longitude),
        )
        .filter(ReportModel.location.isnot(None))
        .filter(ReportModel.incident_latitude.isnot(None))
        .filter(func.lower(ReportModel.location).like(needle))
        .group_by(ReportModel.location)
        .order_by(func.count(ReportModel.id).desc())
        .limit(5)
        .all()
    )
    return [{
        "name": location,
        "detail": f"{count} report{'s' if count != 1 else ''} from here",
        "latitude": float(latitude),
        "longitude": float(longitude),
        "source": "report",
    } for location, count, latitude, longitude in rows]


def _geocode(query: str, limit: int) -> list[dict]:
    """Ask Nominatim, at most once a second, and remember what it said."""
    global _last_call
    key = query.lower()
    if key in _cache:
        return _cache[key]

    with _geocoder_lock:
        if key in _cache:  # another request may have fetched it while we waited
            return _cache[key]
        wait = SECONDS_BETWEEN_CALLS - (time.monotonic() - _last_call)
        if wait > 0:
            time.sleep(min(wait, SECONDS_BETWEEN_CALLS))
        try:
            response = httpx.get(
                GEOCODER_URL,
                params={"q": query, "format": "jsonv2", "limit": limit, "addressdetails": 0},
                headers={"User-Agent": USER_AGENT, "Accept-Language": "en"},
                timeout=GEOCODER_TIMEOUT,
                follow_redirects=True,
            )
            response.raise_for_status()
            found = response.json()
        except Exception as error:  # a place search is never worth failing the request over
            print(f"[places] couldn't reach the geocoder ({error})")
            return []
        finally:
            _last_call = time.monotonic()

    results = []
    for place in found if isinstance(found, list) else []:
        try:
            latitude, longitude = float(place["lat"]), float(place["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        # Nominatim's display_name is "Malekhu, Dhading, Bagmati, Nepal": the first part
        # is the place, the rest is enough to tell two places of the same name apart.
        parts = [part.strip() for part in str(place.get("display_name", "")).split(",") if part.strip()]
        if not parts:
            continue
        results.append({
            "name": parts[0],
            "detail": ", ".join(parts[1:]) or None,
            "latitude": latitude,
            "longitude": longitude,
            "source": "map",
        })

    if len(_cache) > 256:
        _cache.clear()
    _cache[query.lower()] = results
    return results


def search(db, query: str, limit: int = 8) -> list[dict]:
    """Places matching what someone typed, ignoring capitals."""
    query = (query or "").strip()
    if len(query) < 2:
        return []

    hazards = {"critical": "Critical", "warning": "Warning", "watch": "Watch"}
    needle = f"%{query.lower()}%"
    results = _typed_coordinates(query)
    if not results:
        results = _from_zones(db, needle, hazards) + _from_reports(db, needle)
        # Only go out to the map when TRAC doesn't know the place itself. Somewhere it has
        # reports from comes back at once, and the geocoder is left for everywhere else.
        if GEOCODER_ENABLED and not results:
            results = _geocode(query, limit)

    # Two sources often know the same place; keep the first mention of each spot.
    seen: set[tuple] = set()
    unique = []
    for place in results:
        spot = (round(place["latitude"], 3), round(place["longitude"], 3))
        if spot in seen:
            continue
        seen.add(spot)
        unique.append(place)
    return unique[:limit]
