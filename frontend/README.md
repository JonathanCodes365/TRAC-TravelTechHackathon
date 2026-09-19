# TRAC frontend

Next.js 16 app for TRAC. It has three pages:

- `/`: send a report. Pick a type, describe what's happening, and mark the spot with GPS or by tapping the map. While you type, the AI suggests the report type and picks out the people count and the place.
- `/dashboard`: the coordinator view. Live counts, filters, search, and a map of every report. A side panel lets coordinators change a report's status, edit or delete it, and review the AI's findings, including Merge / Not a duplicate for possible duplicates.
- `/reports/[id]`: the tracking page for one report. It updates by itself when a coordinator changes the status.

Data refreshes every 10 seconds, and every 2 seconds while the AI is still checking a report. The header shows whether the backend, the database and the AI service are working. The layout works on phones and follows the device's light or dark mode.

## Run it

The easiest way is from the repo root: `npm run setup` once, then `npm run dev` starts the AI service, the backend and this app together (see the README in the repo root).

To run only this app (with the backend already running), in this folder:

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000.

## How it talks to the backend

The browser calls `/api/...` on the Next.js server, and `next.config.ts` forwards those requests to the backend at `API_URL` (default `http://localhost:8000`). Because of this, the backend needs no CORS settings. The frontend never calls the AI service directly: the backend does that.

To use a different backend, such as a teammate's laptop on the same Wi-Fi, create `frontend/.env.local` with:

```
API_URL=http://192.168.1.20:8000
```

and restart `npm run dev`.

## Where things are

- `app/`: the pages (`page.tsx`, `dashboard/`, `reports/[id]/`)
- `components/dashboard/`: dashboard parts (stat cards, filters, report list, side panel)
- `components/report/`: report details, AI insights, the status/edit/delete controls, and the tracking page
- `components/map/`: the Leaflet maps, which load only in the browser
- `lib/api.ts`: calls to the backend
- `lib/hooks.ts`: live data (SWR), AI suggestions, system health, and report actions
- `lib/reports.ts`: report types, labels and colors
