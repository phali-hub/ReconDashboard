# Recon Dashboard

A lightweight domain reconnaissance tool that discovers subdomains via [crt.sh](https://crt.sh), checks which ones are alive, and reports basic exposure info — status codes and server headers.

## What It Does

1. Enter a domain (e.g. `example.com`)
2. Fetches all subdomains from crt.sh certificate transparency logs
3. Deduplicates results
4. Probes each subdomain asynchronously (max 20 concurrent) to check if it responds
5. Captures HTTP status code and `Server` header for each alive subdomain
6. Saves everything to SQLite and displays a color-coded results table
7. Stores scan history — click any past scan to reload its results

**Result:** A table showing subdomain, alive status (green/red dot), HTTP code, and server software.

## Tech Stack

| Layer    | Technology                                    |
|----------|-----------------------------------------------|
| Backend  | Python, FastAPI, SQLite, httpx (async)        |
| Frontend | React 18, Vite, plain CSS                     |
| Hosting  | Render (backend) + Vercel (frontend)          |

## Project Structure

```
ReconDashboard/
├── backend/
│   ├── main.py              # FastAPI app — endpoints, scan logic, DB setup
│   ├── requirements.txt     # Python dependencies (fastapi, uvicorn, httpx)
│   └── README.md            # Backend-specific run instructions
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main UI — scan form, results table, past scans sidebar
│   │   ├── App.css          # Dark theme, skeleton loader, row animations
│   │   └── main.jsx         # React DOM mount
│   ├── index.html           # Vite entry HTML
│   ├── package.json         # Vite + React dependencies
│   ├── vite.config.js       # Vite configuration
│   └── .env                 # VITE_API_URL — backend base URL
├── render.yaml              # Render Blueprint — auto-deploys backend
├── .gitignore
└── README.md                # This file
```

## API Endpoints

| Method | Endpoint       | Description                                    |
|--------|----------------|------------------------------------------------|
| GET    | `/`            | Health check — `{"status":"ok"}`               |
| POST   | `/scan`        | Scan a domain — body: `{"domain":"example.com"}`|
| GET    | `/scan/{id}`   | Retrieve results for a past scan               |
| GET    | `/scans`       | List all scans with subdomain counts           |

## Features

- **Async scanning** — up to 20 concurrent httpx requests per scan
- **Subdomain discovery** — pulls from crt.sh certificate transparency logs
- **Liveness check** — tries HTTPS first, falls back to HTTP
- **Server header capture** — identifies exposed web servers
- **Scan history** — all scans saved to SQLite, browsable via sidebar
- **Dark mode** — default dark theme with clean, minimal UI
- **Animations** — skeleton shimmer loader, fade+slide-up row transitions
- **Error handling** — graceful messages for backend down, invalid domains, no results
- **CORS enabled** — allows all origins (restrict later for production)
- **Web-ready** — PORT env var support for Render, VITE_API_URL for Vercel

## Running Locally

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows (source venv/bin/activate on Mac/Linux)
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

API at `http://localhost:8000` — docs at `/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`

## Deploying

### Backend → Render

1. Push repo to GitHub
2. Go to [render.com](https://render.com) → **New** → **Blueprint**
3. Connect repo — Render detects `render.yaml` and sets everything up
4. Deploy

Or manually: **New Web Service** → root dir `backend` → build: `pip install -r requirements.txt` → start: `python main.py`

> Free tier spins down after inactivity. First request after idle takes ~30-50s.

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import repo → set root directory to `frontend`
3. Add env variable: `VITE_API_URL` = your Render backend URL (e.g. `https://recon-dashboard-api.onrender.com`)
4. Deploy

## Environment Variables

| Variable      | Where    | Default                 | Description                     |
|---------------|----------|-------------------------|---------------------------------|
| `VITE_API_URL`| Frontend | `http://localhost:8000` | Backend API base URL            |
| `PORT`        | Backend  | `8000`                  | Server port (set by Render)     |
| `DB_PATH`     | Backend  | `recon.db`              | SQLite database file path       |

## Limitations

- **SQLite is ephemeral on Render** — scan history resets on every deploy/restart. Fine for a portfolio demo; swap to PostgreSQL or Turso for persistence.
- **No auth** — open API, anyone can scan.
- **crt.sh rate limits** — very aggressive scanning may get temporarily blocked.

## License

MIT
