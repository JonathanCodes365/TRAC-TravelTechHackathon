# TRAC

Disaster coordination for travelers. People in trouble send a report from their phone, coordinators see it on a live map and update its status, and the person who reported it can follow along. An AI service reads each report, counts the people mentioned, suggests the report type and flags reports that repeat an earlier one.

TRAC also works out **where a disaster is happening right now**, by grouping reports that describe the same trouble in the same place and by watching a live earthquake feed. Anyone travelling nearby can ask for a route and get told how far it runs inside a danger area, with a way around it when one exists.

Built for the Travel Tech Hackathon.

## How the parts connect

```
Phone / browser ──► Frontend (Next.js, port 3000)
                        │  /api/...
                        ▼
                    Backend (FastAPI, port 8000) ──► Database (SQLite by default, or PostgreSQL)
                        │                       └──► USGS earthquake feed, OSRM routing
                        ▼
                    AI service (FastAPI, port 8001)
```

- The frontend only talks to the backend. Its `/api/...` requests are forwarded to the backend, so no CORS setup is needed.
- Only the backend talks to the database and the AI service.
- The AI is a helper, not a requirement. If it's down, reports still save right away and show that the AI check didn't run. Coordinators can retry it later. Danger areas already found stay on the map.
- The two outside services need no API key. If either can't be reached, the rest of the app carries on: no earthquake feed just means fewer areas, and no routing means the route planner says so instead of guessing.

What happens when someone sends a report:

1. The backend saves it (status `open`, `ai_state: "pending"`) and answers immediately.
2. In the background, it asks the AI what the message says: people count, names, and a suggested type.
3. It then asks the AI whether the report repeats an earlier one, and saves the best match (40% or higher).
4. The dashboard shows the results. For a possible duplicate, a coordinator clicks **Merge** (closes it as a copy) or **Not a duplicate**.
5. It re-checks the danger areas, so a new report can raise a new area or widen one within seconds.

## Finding disaster areas, and routes around them

Nobody declares a disaster by hand. The backend keeps the map of danger areas up to date from two sources:

- **The reports themselves.** Every minute (and right after each new report) the backend sends the recent reports to the AI service, which groups the ones that sit close together — DBSCAN over the distance between them, at least 2 reports within 5 km of each other, from the last 12 hours. Reports that say people are safe, and ones a coordinator has confirmed as duplicates, are left out so they can't inflate an area. The words in the grouped reports decide the kind of hazard (flood, landslide, earthquake, avalanche, fire, storm), and how many reports, how urgent they are and how many people they mention decide the severity: **watch**, **warning** or **critical**.
- **The USGS earthquake feed**, polled every ten minutes for quakes of magnitude 4.5 and up. The area's radius comes from the magnitude.

An area grows, moves, changes severity or quietens down on its own as reports come in and get old. Areas that stop being reported become inactive but stay on record.

You say where you are and where you're going either by typing the name — which matches the danger areas and the places on existing reports first, whatever the capitals, then OpenStreetMap for everywhere else — or by tapping the map. Coordinates pasted straight in work as well.

For a route, the backend asks OSRM for the ways from A to B, then measures how far each one runs **inside** each danger area, in steps of about a kilometre. Routes are ranked on time and danger together: a kilometre inside a watch area counts like 10 extra minutes of driving, and a critical one like 30. If every road on offer goes through an area, the backend steers its own detours around the worst one and keeps them only when they genuinely cut the distance spent in danger — on a road with no alternative, it says so plainly rather than inventing a longer route that rejoins the same road.

## What's in the repo

- `frontend/`: Next.js app with the report page, the coordinator dashboard, a tracking page for each report and the safe route planner.
- `backend/`: FastAPI + SQLAlchemy API. `backend/ai.py` connects it to the AI service; `backend/zones.py` keeps the danger areas up to date and plans routes around them.
- `ai-service/`: FastAPI service that extracts details from report text (with keyword rules, or a language model if you add an API key), scores duplicates with a logistic regression model, and groups reports into disaster areas in `ai-service/zones.py`.
- `scripts/`: `setup.mjs` and `dev.mjs`, used by `npm run setup` and `npm run dev`.

## Run it locally

You need Python 3.10 or newer and Node.js 20.9 or newer. From the repo root:

```bash
npm run setup
```

This creates a Python environment in `.venv`, installs the backend's and the AI service's packages, and installs the frontend's packages. You only need to run it once, and again when requirements change.

Then start everything:

```bash
npm run dev
```

This starts the AI service (port 8001), the backend (port 8000) and the frontend (port 3000) in one terminal. Open http://localhost:3000. Ctrl+C stops all three.

The backend's interactive API docs are at http://localhost:8000/docs.

<details>
<summary>Starting the parts one by one instead</summary>

Use three terminals, all starting in the repo root. On macOS or Linux, use `.venv/bin/python` instead of `.venv/Scripts/python`.

```bash
cd ai-service
```

```bash
../.venv/Scripts/python -m uvicorn service:app --port 8001 --reload
```

```bash
.venv/Scripts/python -m uvicorn backend.main:app --port 8000 --reload
```

```bash
cd frontend
```

```bash
npm run dev
```

</details>

## Settings

All settings are optional. Copy the example files and edit them:

- `backend/.env` (from `backend/.env.example`):
  - `DATABASE_URL`: use PostgreSQL instead of the local SQLite file (`backend/trac.db`).
  - `AI_SERVICE_URL`: where the AI service runs (default `http://127.0.0.1:8001`).
  - `ZONE_WINDOW_HOURS`: how far back reports count towards a danger area (default `12`).
  - `ZONE_REFRESH_SECONDS`: how often areas are worked out again (default `60`).
  - `DISASTER_FEED`: set to `off` to ignore the earthquake feed.
  - `DISASTER_FEED_URL` and `DISASTER_FEED_SECONDS`: which feed to read and how often (default: USGS magnitude 4.5+, every 600 seconds).
  - `ROUTING_URL`: the OSRM server used for routes (default: the public demo server, which is rate limited — point this at your own OSRM for anything real).
  - `GEOCODER`: set to `off` to look places up only among the ones TRAC already knows.
  - `GEOCODER_URL` and `GEOCODER_USER_AGENT`: which geocoder turns typed place names into coordinates (default: OpenStreetMap's Nominatim, which asks callers to identify themselves and to stay under one request a second).
- `ai-service/.env` (from `ai-service/.env.example`): `AI_PROVIDER` and an API key, to read reports with a language model instead of keyword rules.
- `frontend/.env.local`: `API_URL`, to use a backend somewhere else (default `http://localhost:8000`).

The `.env` files stay out of git.

## Backend API

| Request | What it does |
| --- | --- |
| `GET /health` | Whether the API, the database and the AI service are working |
| `GET /reports` | All reports, newest first. Optional filters: `?type=`, `?status=`, `?location=` (matches part of the name, any case) |
| `GET /reports/{id}` | One report |
| `POST /reports` | Create a report (201). The AI check runs in the background. |
| `PUT /reports/{id}` | Replace a report's type, message, location and coordinates |
| `PATCH /reports/{id}` | Change only the fields you send, e.g. `{"status": "resolved"}` or `{"duplicate_state": "confirmed"}` |
| `DELETE /reports/{id}` | Delete a report |
| `POST /reports/analyze` | Ask the AI about a message before sending it: `{"report_text": "..."}`. Returns a suggested type, people count and place, or 503 if the AI is down. |
| `POST /reports/{id}/analyze` | Run the AI check on a saved report again (202) |
| `GET /zones` | The disaster areas being tracked. `?active=false` includes the ones that have quietened down. |
| `POST /zones/refresh` | Work the areas out again straight away. `?feed=false` skips the earthquake feed. |
| `POST /routes/safe` | Routes from A to B, marked with the danger areas they cross: `{"start": {"latitude": 27.71, "longitude": 85.32}, "end": {...}}`. 503 if the routing service can't be reached. |
| `GET /places?q=` | Find a place by name for the route planner. Capitals don't matter, and typed coordinates ("27.7172, 85.3240") work too. |

A report looks like this:

```json
{
  "id": 9,
  "type": "rescue",
  "message": "Four people trapped on a rooftop by the lake in Pokhara, flood water rising",
  "location": "Lakeside, Pokhara",
  "incident_latitude": 28.2101,
  "incident_longitude": 83.9582,
  "status": "open",
  "created_at": "2026-09-19T17:47:02Z",
  "ai_state": "done",
  "people_count": 4,
  "person_name": null,
  "ai_suggested_type": "rescue",
  "ai_source": "rules",
  "duplicate_of": 8,
  "duplicate_score": 0.931,
  "duplicate_state": "suggested"
}
```

- `type` is one of `rescue`, `injured`, `missing`, `incident` or `safe`.
- `status` is one of `open`, `in_progress` or `resolved`. New reports start as `open`.
- `incident_latitude` and `incident_longitude` are where the trouble is; `reporter_latitude` and `reporter_longitude` are where the person sending the report is. Both are optional, and each pair must be sent together.
- `ai_state` is `pending` while the AI checks the report, then `done`, or `failed` if the AI couldn't be reached.
- `duplicate_state` is `suggested` by the AI, then `confirmed` or `dismissed` by a coordinator. Confirming also resolves the report.

When the backend starts, it creates any missing tables and adds any missing columns to existing ones, so a database created by an older version keeps working.

## AI service API

| Request | What it does |
| --- | --- |
| `GET /health` | `{"status": "ok", "extraction": "rules"}` (or the language model provider) |
| `POST /extract` | Details from report text: name, location, status, time, people count, report type |
| `POST /check-report-duplicate` | Duplicate scores between a new report and earlier ones |
| `POST /check-duplicate` | Duplicate scores between person records |
| `POST /detect-zones` | Groups reports that describe the same trouble in the same place into disaster areas |

To retrain the duplicate models, run `python train_report_model.py` or `python train_model.py` in `ai-service/`.
