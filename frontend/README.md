# TRAC frontend

Next.js app for TRAC. It has two pages:

- `/`: send a report (type, details, location, and optionally the phone's GPS position)
- `/dashboard`: every report on a map and in a list, with filters. It refreshes every 10 seconds.

## Run it

The frontend needs the FastAPI backend running on http://localhost:8000. From the repo root, set up Python once:

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
```

Start the backend (it also needs the PostgreSQL database from `database.py`):

```bash
.venv/Scripts/python -m fastapi dev main.py
```

In a second terminal, start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:3000.

## How it talks to the backend

The browser calls `/api/...` on the Next.js server, and `next.config.ts` forwards those requests to the backend. That's why the backend needs no CORS settings.

To use a different backend, such as a teammate's laptop on the same Wi-Fi, create `frontend/.env.local` with:

```
API_URL=http://192.168.1.20:8000
```

and restart `npm run dev`.

## API the frontend uses

| Request | Body or response |
| --- | --- |
| `POST /reports` | `{ type, message, location, latitude, longitude }` |
| `GET /reports` | a list of `{ id, type, message, location }`, plus `latitude` and `longitude` when the backend stores them |

`type` is one of `rescue`, `missing`, `injured`, `safe` or `incident`, in lowercase. The map only shows reports that have `latitude` and `longitude`.

## Where things are

- `app/page.tsx` and `components/ReportForm.tsx`: the report page
- `app/dashboard/page.tsx` and `components/Dashboard.tsx`: the dashboard
- `components/ReportMap.tsx`: the Leaflet map, which loads only in the browser
- `lib/reports.ts`: report types, colors, and the API calls
