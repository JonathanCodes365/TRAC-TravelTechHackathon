# TRAC

Disaster coordination for travelers. People in trouble send a report from their phone, coordinators see it on a live map and update its status, and the person who reported it can follow along. An AI service reads each report, counts the people mentioned, suggests the report type and flags reports that repeat an earlier one.

Built for the Travel Tech Hackathon.

## How the parts connect

```
Phone / browser ──► Frontend (Next.js, port 3000)
                        │  /api/...
                        ▼
                    Backend (FastAPI, port 8000) ──► Database (SQLite by default, or PostgreSQL)
                        │
                        ▼
                    AI service (FastAPI, port 8001)
```

- The frontend only talks to the backend. Its `/api/...` requests are forwarded to the backend, so no CORS setup is needed.
- Only the backend talks to the database and the AI service.
- The AI is a helper, not a requirement. If it's down, reports still save right away and show that the AI check didn't run. Coordinators can retry it later.

What happens when someone sends a report:

1. The backend saves it (status `open`, `ai_state: "pending"`) and answers immediately.
2. In the background, it asks the AI what the message says: people count, names, and a suggested type.
3. It then asks the AI whether the report repeats an earlier one, and saves the best match (40% or higher).
4. The dashboard shows the results. For a possible duplicate, a coordinator clicks **Merge** (closes it as a copy) or **Not a duplicate**.

## What's in the repo

- `frontend/`: Next.js app with the report page, the coordinator dashboard and a tracking page for each report.
- `backend/`: FastAPI + SQLAlchemy API. `backend/ai.py` connects it to the AI service.
- `ai-service/`: FastAPI service that extracts details from report text (with keyword rules, or a language model if you add an API key) and scores duplicates with a logistic regression model.
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

A report looks like this:

```json
{
  "id": 9,
  "type": "rescue",
  "message": "Four people trapped on a rooftop by the lake in Pokhara, flood water rising",
  "location": "Lakeside, Pokhara",
  "latitude": 28.2101,
  "longitude": 83.9582,
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
- `latitude` and `longitude` are optional, but must be sent together.
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

To retrain the duplicate models, run `python train_report_model.py` or `python train_model.py` in `ai-service/`.
