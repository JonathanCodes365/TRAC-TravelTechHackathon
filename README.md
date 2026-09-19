# TRAC

Disaster coordination for travelers. People in trouble send a report from their phone, coordinators see it on a live map and update its status, and the person who reported it can follow along.

Built for the Travel Tech Hackathon.

## What's in the repo

- `backend/`: FastAPI + SQLAlchemy API for reports (create, list with filters, read, update, delete).
- `frontend/`: Next.js app with the report page, the coordinator dashboard and a tracking page for each report.
- `ai-service/`: work in progress.

## Run it locally

You need Python 3.10 or newer and Node.js 20.9 or newer.

**1. Backend.** From the repo root, set up Python once:

```bash
python -m venv .venv
```

```bash
.venv/Scripts/python -m pip install -r requirements.txt
```

Then start the API (on macOS or Linux, use `.venv/bin/python` instead of `.venv/Scripts/python`):

```bash
.venv/Scripts/python -m uvicorn backend.main:app --reload
```

It runs on http://localhost:8000, with interactive docs at http://localhost:8000/docs. By default it stores data in a local SQLite file, `backend/trac.db`, so there's no database to set up. To use PostgreSQL instead, copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL`.

**2. Frontend.** In a second terminal:

```bash
cd frontend
```

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000.

## API

| Request | What it does |
| --- | --- |
| `GET /` | Health check |
| `GET /reports` | All reports, newest first. Optional filters: `?type=`, `?status=`, `?location=` (matches part of the name, any case) |
| `GET /reports/{id}` | One report |
| `POST /reports` | Create a report (returns 201) |
| `PUT /reports/{id}` | Replace a report's type, message, location and coordinates |
| `PATCH /reports/{id}` | Change only the fields you send, for example `{"status": "resolved"}` |
| `DELETE /reports/{id}` | Delete a report |

A report looks like this:

```json
{
  "id": 1,
  "type": "rescue",
  "message": "Family of four trapped on a rooftop.",
  "location": "Lakeside, Pokhara",
  "latitude": 28.2096,
  "longitude": 83.9595,
  "status": "open",
  "created_at": "2026-09-19T12:35:52Z"
}
```

- `type` is one of `rescue`, `injured`, `missing`, `incident` or `safe`.
- `status` is one of `open`, `in_progress` or `resolved`. New reports start as `open`.
- `latitude` and `longitude` are optional, but must be sent together.

When the backend starts, it creates any missing tables and adds any missing columns to existing ones, so a database created by an older version keeps working.
