# Recon Dashboard

A lightweight recon tool that takes a domain name, discovers its subdomains via [crt.sh](https://crt.sh), checks which ones are alive, and reports basic exposure info (status codes and server headers).

## Demo

Enter a domain → get a table of every subdomain, whether it's alive, its HTTP status code, and the `Server` header it exposes.

## Tech Stack

- **Backend:** Python 3.14, FastAPI, SQLite, httpx (async HTTP)
- **Frontend:** React 18, Vite, plain CSS (dark mode)

## Project Structure

```
ReconDashboard/
├── backend/
│   ├── main.py            # FastAPI app — all endpoints and scan logic
│   ├── requirements.txt   # Python dependencies
│   └── README.md          # Backend-specific run instructions
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.jsx        # Main component — scan form, results, past scans
│   │   ├── App.css        # Dark mode styles, animations, skeleton loader
│   │   └── main.jsx       # React root mount
│   ├── index.html
│   ├── package.json       # Vite + React dependencies
│   ├── vite.config.js
│   └── .env               # VITE_API_URL (defaults to localhost:8000)
└── README.md
```

## Getting Started

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

API runs at `http://localhost:8000`. Interactive docs at `/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## API Endpoints

| Method | Endpoint       | Description                              |
|--------|----------------|------------------------------------------|
| GET    | `/`            | Health check — returns `{"status":"ok"}` |
| POST   | `/scan`        | Start a scan — body: `{"domain":"..."}`  |
| GET    | `/scan/{id}`   | Get results for a specific scan          |
| GET    | `/scans`       | List all past scans with subdomain counts|

## How It Works

1. You enter a domain (e.g. `example.com`)
2. The backend queries crt.sh for all subdomains matching `%.example.com`
3. Results are deduplicated
4. Each subdomain is probed with an async HEAD/GET request (max 20 concurrent)
5. Alive status, HTTP status code, and `Server` header are captured
6. Everything is saved to SQLite and returned to the frontend
7. The frontend displays a color-coded table (green = alive, red = dead)
8. Past scans appear in a sidebar — click one to reload its results

## Environment Variables

### Frontend

| Variable      | Default                  | Description         |
|---------------|--------------------------|---------------------|
| `VITE_API_URL`| `http://localhost:8000`  | Backend API base URL|

## License

MIT
