"""Disaster areas, and routes that keep people out of them.

Two things feed the areas:
- Reports people send. The AI service groups recent reports that are close together into
  an area, with a hazard kind and a severity (see ai-service/zones.py).
- A public feed of real earthquakes from the USGS, which needs no account.

While the server runs, both are refreshed on a timer, so the map is current. Routes are
planned with a public routing service and then checked against the areas: any route that
passes through one is marked, and the clearest route is recommended.
"""
import asyncio
import os
import time
from datetime import datetime, timedelta, timezone
from math import asin, atan2, cos, degrees, radians, sin, sqrt

import httpx
from dotenv import load_dotenv
from sqlalchemy import or_

from backend import ai
from backend.database import SessionLocal, engine
from backend.models import DangerZoneModel, ReportModel

load_dotenv()

# How far back reports count as current, and how often everything is refreshed.
REPORT_WINDOW_HOURS = float(os.getenv("ZONE_WINDOW_HOURS", "12"))
REFRESH_SECONDS = float(os.getenv("ZONE_REFRESH_SECONDS", "60"))
FEED_REFRESH_SECONDS = float(os.getenv("DISASTER_FEED_SECONDS", "600"))

# Real earthquakes, magnitude 4.5 and up in the last day. No account needed.
FEED_URL = os.getenv(
    "DISASTER_FEED_URL",
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson",
)
FEED_ENABLED = (os.getenv("DISASTER_FEED", "on") or "").strip().lower() not in ("off", "0", "false", "no")

# Public routing service (OpenStreetMap roads). Swap it with your own with ROUTING_URL.
ROUTING_URL = (os.getenv("ROUTING_URL") or "https://router.project-osrm.org").rstrip("/")
ROUTING_TIMEOUT = httpx.Timeout(20.0, connect=5.0)

SEVERITY_RANK = {"watch": 1, "warning": 2, "critical": 3}
# How much a kilometre inside a danger area is "worth" in extra travel minutes, so safety
# and time can be weighed against each other: 10 minutes for a watch area, 30 for a critical
# one. A big detour that barely reduces the danger is not an improvement.
DANGER_MINUTES_PER_KM = 10.0
# A detour we steer ourselves is only offered if it cuts at least this much danger
# (severity rank x kilometres). Where one road is the only way through, a detour just
# rejoins it further along and gains nothing, so it is not worth showing.
DETOUR_MUST_SAVE = 0.5
EARTH_RADIUS_KM = 6371.0088


class RoutingUnavailable(Exception):
    """The routing service couldn't be reached or had no route to offer."""


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def distance_km(lat_a: float, lon_a: float, lat_b: float, lon_b: float) -> float:
    lat1, lon1, lat2, lon2 = map(radians, (lat_a, lon_a, lat_b, lon_b))
    inner = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_KM * asin(sqrt(inner))


# ---------------------------------------------------------------- areas from reports


def _same(current, value) -> bool:
    # SQLite hands times back without a timezone while the AI service sends them with one,
    # so compare the moments themselves rather than the two representations.
    if isinstance(current, datetime) and isinstance(value, datetime):
        current = current if current.tzinfo else current.replace(tzinfo=timezone.utc)
        value = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return current == value


def _apply(zone: DangerZoneModel, fields: dict) -> bool:
    """Set only the fields that really differ, and say whether anything did. Areas are
    re-detected every minute, so updated_at has to move only when the area itself moves:
    the dashboard and the route planner watch it to know something has changed."""
    changed = False
    for name, value in fields.items():
        if not _same(getattr(zone, name), value):
            setattr(zone, name, value)
            changed = True
    return changed


def _title_for(hazard: str, place: str | None) -> str:
    name = "Incident cluster" if hazard == "unknown" else hazard.replace("_", " ").capitalize()
    return f"{name} near {place}" if place else f"{name} area"


def refresh_from_reports(db) -> list[DangerZoneModel]:
    """Re-detect areas from the reports of the last few hours and save the result."""
    cutoff = _utcnow() - timedelta(hours=REPORT_WINDOW_HOURS)
    if engine.dialect.name == "sqlite":
        cutoff = cutoff.replace(tzinfo=None)  # SQLite keeps times without a timezone
    reports = (
        db.query(ReportModel)
        .filter(ReportModel.incident_latitude.isnot(None), ReportModel.incident_longitude.isnot(None))
        # Reports already merged into another one would count the same event twice.
        .filter(or_(ReportModel.duplicate_state.is_(None), ReportModel.duplicate_state != "confirmed"))
        .filter(or_(ReportModel.created_at.is_(None), ReportModel.created_at >= cutoff))
        .order_by(ReportModel.id.desc())
        .limit(500)
        .all()
    )

    payload = [
        {
            "id": str(report.id),
            "type": report.type.value,
            "message": report.message,
            "location": report.location,
            "latitude": report.incident_latitude,
            "longitude": report.incident_longitude,
            "people_count": report.people_count,
            "time": ai.utc_iso(report.created_at),
        }
        for report in reports
    ]

    detected = ai.detect_zones(payload, REPORT_WINDOW_HOURS) if payload else []
    existing = db.query(DangerZoneModel).filter(DangerZoneModel.source == "reports").all()
    kept: set[int] = set()

    for zone in detected:
        hazard = str(zone.get("hazard") or "unknown")
        match = _matching_zone(existing, zone, hazard, kept)
        if match is None:
            match = DangerZoneModel(source="reports", first_seen=_utcnow())
            db.add(match)
            existing.append(match)

        if _apply(match, {
            "hazard": hazard,
            "severity": str(zone.get("severity") or "watch"),
            "title": _title_for(hazard, zone.get("place")),
            "summary": zone.get("summary"),
            "center_latitude": float(zone["center_latitude"]),
            "center_longitude": float(zone["center_longitude"]),
            "radius_km": float(zone["radius_km"]),
            "report_count": int(zone.get("report_count") or 0),
            "people_count": int(zone.get("people_count") or 0),
            "confidence": zone.get("confidence"),
            "event_time": ai.parse_iso(zone.get("latest_report_at")),
            "active": True,
        }):
            match.updated_at = _utcnow()
        db.flush()  # gives new areas an id, so the next match can tell them apart
        kept.add(match.id)

    # Areas whose reports have stopped coming in are no longer active.
    for zone in existing:
        if zone.id not in kept and zone.active:
            zone.active = False
            zone.updated_at = _utcnow()

    db.commit()
    return db.query(DangerZoneModel).filter(DangerZoneModel.active.is_(True)).all()


def _matching_zone(existing: list[DangerZoneModel], zone: dict, hazard: str, used: set[int]):
    # The same area detected again: same hazard, centers close enough to overlap.
    for candidate in existing:
        if candidate.id in used or candidate.hazard != hazard:
            continue
        gap = distance_km(
            candidate.center_latitude, candidate.center_longitude,
            float(zone["center_latitude"]), float(zone["center_longitude"]),
        )
        if gap <= max(candidate.radius_km, float(zone["radius_km"])):
            return candidate
    return None


# ------------------------------------------------------------------ areas from a feed


def fetch_feed(url: str = FEED_URL) -> list[dict]:
    """Earthquakes from the USGS feed, as plain dictionaries."""
    response = httpx.get(url, timeout=httpx.Timeout(15.0, connect=5.0))
    response.raise_for_status()
    return response.json().get("features", [])


def _earthquake_zone(feature: dict) -> dict | None:
    properties = feature.get("properties") or {}
    coordinates = (feature.get("geometry") or {}).get("coordinates") or []
    magnitude = properties.get("mag")
    if magnitude is None or len(coordinates) < 2:
        return None
    magnitude = float(magnitude)
    # Bigger quakes are felt further away. This is a rough area of concern, not a science model.
    radius_km = round(min(300.0, max(10.0, 15.0 * (magnitude - 3.5))), 1)
    severity = "critical" if magnitude >= 6.5 else "warning" if magnitude >= 5.5 else "watch"
    milliseconds = properties.get("time")
    return {
        "external_id": str(feature.get("id")),
        "hazard": "earthquake",
        "severity": severity,
        "title": f"Magnitude {magnitude} earthquake",
        "summary": properties.get("place"),
        "center_latitude": float(coordinates[1]),
        "center_longitude": float(coordinates[0]),
        "radius_km": radius_km,
        "magnitude": magnitude,
        "external_url": properties.get("url"),
        "event_time": datetime.fromtimestamp(milliseconds / 1000, tz=timezone.utc) if milliseconds else None,
    }


def refresh_from_feed(db) -> int:
    """Save the earthquakes currently in the feed, and retire the ones that have dropped out."""
    if not FEED_ENABLED:
        return 0
    features = fetch_feed()
    existing = {z.external_id: z for z in db.query(DangerZoneModel).filter(DangerZoneModel.source == "usgs").all()}
    seen = set()

    for feature in features:
        zone = _earthquake_zone(feature)
        if zone is None:
            continue
        seen.add(zone["external_id"])
        record = existing.get(zone["external_id"])
        if record is None:
            record = DangerZoneModel(source="usgs", external_id=zone["external_id"], first_seen=_utcnow())
            db.add(record)
        fields = {field: zone[field] for field in
                  ("hazard", "severity", "title", "summary", "center_latitude", "center_longitude",
                   "radius_km", "magnitude", "external_url", "event_time")}
        if _apply(record, {**fields, "report_count": 0, "active": True}):
            record.updated_at = _utcnow()

    for external_id, record in existing.items():
        if external_id not in seen and record.active:
            record.active = False
            record.updated_at = _utcnow()

    db.commit()
    return len(seen)


# --------------------------------------------------------------------- keeping it live


def refresh_all(db, include_feed: bool = True) -> None:
    try:
        refresh_from_reports(db)
    except ai.AIUnavailable as error:
        print(f"[zones] the AI service is unavailable, areas not updated ({error})")
    except Exception as error:
        db.rollback()
        print(f"[zones] couldn't update areas from reports ({error})")
    if include_feed:
        try:
            refresh_from_feed(db)
        except Exception as error:
            db.rollback()
            print(f"[zones] couldn't read the disaster feed ({error})")


def refresh_in_new_session(include_feed: bool = True) -> None:
    db = SessionLocal()
    try:
        refresh_all(db, include_feed)
    finally:
        db.close()


def refresh_after_report() -> None:
    """Background job after a report is saved, so a new area shows up straight away."""
    refresh_in_new_session(include_feed=False)


async def keep_zones_updated() -> None:
    """Runs for as long as the server does: re-detects areas from reports every minute
    and refreshes the earthquake feed every ten minutes."""
    next_feed = 0.0
    while True:
        include_feed = FEED_ENABLED and time.monotonic() >= next_feed
        try:
            await asyncio.to_thread(refresh_in_new_session, include_feed)
            if include_feed:
                next_feed = time.monotonic() + FEED_REFRESH_SECONDS
        except asyncio.CancelledError:
            raise
        except Exception as error:  # never let the loop die
            print(f"[zones] refresh loop error ({error})")
        await asyncio.sleep(REFRESH_SECONDS)


def active_zones(db) -> list[DangerZoneModel]:
    return (
        db.query(DangerZoneModel)
        .filter(DangerZoneModel.active.is_(True))
        .order_by(DangerZoneModel.updated_at.desc())
        .all()
    )


# ------------------------------------------------------------------------- safe routes


def fetch_routes(start: tuple[float, float], end: tuple[float, float], via: tuple[float, float] | None = None) -> list[dict]:
    """Ask the routing service for ways to drive from start to end, optionally through a
    waypoint that steers the route away from somewhere."""
    stops = [start, via, end] if via else [start, end]
    path = ";".join(f"{point[1]},{point[0]}" for point in stops)
    url = f"{ROUTING_URL}/route/v1/driving/{path}"
    try:
        response = httpx.get(
            url,
            params={"alternatives": "false" if via else "3", "overview": "full", "geometries": "geojson"},
            timeout=ROUTING_TIMEOUT,
        )
        response.raise_for_status()
        answer = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise RoutingUnavailable(str(error)) from error
    if answer.get("code") != "Ok" or not answer.get("routes"):
        raise RoutingUnavailable(answer.get("message") or "no route found")
    return answer["routes"]


def _inside(point: tuple[float, float], zone: DangerZoneModel) -> bool:
    return distance_km(point[0], point[1], zone.center_latitude, zone.center_longitude) <= zone.radius_km


def _exposure_km(points: list[list[float]], zone: DangerZoneModel) -> float:
    """How far a route travels inside an area. Clipping the edge of a flood area is not the
    same as driving through the middle of it, so each leg is walked in steps of about a
    kilometre and the steps inside the area are added up."""
    inside_km = 0.0
    for (lat_a, lon_a), (lat_b, lon_b) in zip(points, points[1:]):
        length = distance_km(lat_a, lon_a, lat_b, lon_b)
        if length <= 0:
            continue
        steps = min(400, max(1, int(length)))
        step_km = length / steps
        for step in range(steps):
            middle = (step + 0.5) / steps
            latitude = lat_a + (lat_b - lat_a) * middle
            longitude = lon_a + (lon_b - lon_a) * middle
            if _inside((latitude, longitude), zone):
                inside_km += step_km
    return inside_km


def _point_at(latitude: float, longitude: float, bearing_degrees: float, distance: float) -> tuple[float, float]:
    """The point `distance` km away in the given compass direction."""
    angular = distance / EARTH_RADIUS_KM
    bearing = radians(bearing_degrees)
    lat1, lon1 = radians(latitude), radians(longitude)
    lat2 = asin(sin(lat1) * cos(angular) + cos(lat1) * sin(angular) * cos(bearing))
    lon2 = lon1 + atan2(sin(bearing) * sin(angular) * cos(lat1), cos(angular) - sin(lat1) * sin(lat2))
    return degrees(lat2), (degrees(lon2) + 540) % 360 - 180


def _bearing(lat_a: float, lon_a: float, lat_b: float, lon_b: float) -> float:
    lat1, lat2 = radians(lat_a), radians(lat_b)
    delta = radians(lon_b - lon_a)
    return (degrees(atan2(sin(delta) * cos(lat2),
                          cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(delta))) + 360) % 360


def _detour_waypoints(start: tuple[float, float], end: tuple[float, float], zone: DangerZoneModel) -> list[tuple[float, float]]:
    """Points to steer through to get around an area: one to each side of it, just outside
    its edge, measured across the direction of travel."""
    across = _bearing(*start, *end)
    reach = zone.radius_km * 1.8 + 5
    return [
        _point_at(zone.center_latitude, zone.center_longitude, (across + 90) % 360, reach),
        _point_at(zone.center_latitude, zone.center_longitude, (across - 90) % 360, reach),
    ]


def plan_safe_route(db, start: tuple[float, float], end: tuple[float, float]) -> dict:
    """Routes from start to end, marked with the danger areas they pass through,
    with the clearest one recommended."""
    zones = active_zones(db)
    # An area around the start or the destination can't be avoided by any route.
    at_start = [zone for zone in zones if _inside(start, zone)]
    at_end = [zone for zone in zones if _inside(end, zone)]
    unavoidable = {zone.id for zone in at_start + at_end}

    def as_option(route: dict, label: str) -> dict:
        points = [[point[1], point[0]] for point in route["geometry"]["coordinates"]]  # OSRM gives lon,lat
        crossed, danger, inside_total = [], 0.0, 0.0
        for zone in zones:
            inside_km = _exposure_km(points, zone)
            if inside_km <= 0:
                continue
            crossed.append(zone)
            inside_total += inside_km
            danger += SEVERITY_RANK.get(zone.severity, 1) * inside_km
        return {
            "label": label,
            "distance_km": round(route["distance"] / 1000, 2),
            "duration_min": round(route["duration"] / 60, 1),
            "geometry": points,
            "zones": [zone.id for zone in crossed],
            # How far this route travels inside danger areas.
            "zone_km": round(inside_total, 1),
            "risk": "passes_zone" if crossed else "clear",
            "recommended": False,
            "_danger": round(danger, 3),
        }

    options = [
        as_option(route, "Fastest route" if index == 0 else f"Alternative {index}")
        for index, route in enumerate(fetch_routes(start, end))
    ]

    # The routing service often has only one road to offer. If it goes through an area,
    # steer a route around that area ourselves and see whether it works out better.
    closest = min(options, key=lambda option: option["_danger"])
    blocking = [zone for zone in zones if zone.id in closest["zones"] and zone.id not in unavoidable]
    if blocking:
        worst = max(blocking, key=lambda zone: SEVERITY_RANK.get(zone.severity, 1) * zone.radius_km)
        safest_so_far = closest["_danger"]
        for waypoint in _detour_waypoints(start, end, worst):
            try:
                detour = fetch_routes(start, end, via=waypoint)
            except RoutingUnavailable:
                continue
            if not detour:
                continue
            option = as_option(detour[0], f"Detour around the {worst.hazard}")
            if option["_danger"] > safest_so_far - DETOUR_MUST_SAVE:
                continue
            if all(option["geometry"] != existing["geometry"] for existing in options):
                safest_so_far = option["_danger"]
                options.append(option)

    # Rank by danger and travel time together (see DANGER_MINUTES_PER_KM).
    options.sort(key=lambda option: option["duration_min"] + DANGER_MINUTES_PER_KM * option["_danger"])
    best = options[0]
    best["recommended"] = True
    fastest = min(options, key=lambda option: option["duration_min"])
    # A detour already says what it avoids; only the plain alternatives need renaming.
    if best is not fastest and best["_danger"] < fastest["_danger"] and best["label"].startswith("Alternative"):
        best["label"] = "Safest route"

    longer = round(best["duration_min"] - fastest["duration_min"])
    delay = f" It takes about {longer} minutes longer." if longer > 0 else ""

    if at_start or at_end:
        where = "starting point" if at_start else "destination"
        area = (at_start or at_end)[0]
        advice = (
            f"Your {where} is inside a danger area: {area.title}. "
            "No route can avoid it, so get clear of that area first. "
            + (f"The recommended route spends about {best['zone_km']} km inside danger areas."
               if best["risk"] == "passes_zone" else "The recommended route stays clear after that.")
        )
    elif best["risk"] == "clear" and fastest["risk"] == "passes_zone":
        count = len(fastest["zones"])
        advice = (
            f"The fastest route goes through {count} danger {'area' if count == 1 else 'areas'}. "
            f"The recommended route avoids {'it' if count == 1 else 'them'} completely.{delay}"
        )
    elif best["risk"] == "passes_zone":
        advice = (
            "Every route we found passes through a danger area. The recommended one travels "
            f"about {best['zone_km']} km inside it{delay.rstrip('.').replace(' It takes', ' and takes')}. "
            "Take extra care, and check with local responders before setting off."
        )
    elif not zones:
        advice = "No danger areas are active right now, so the usual route is fine."
    else:
        advice = "This route stays clear of the danger areas."

    for option in options:
        option.pop("_danger", None)

    return {
        "routes": options,
        "zones": zones,
        "advice": advice,
        "start_zones": [zone.id for zone in at_start],
        "end_zones": [zone.id for zone in at_end],
    }
