import asyncio
import sqlite3
from datetime import datetime, timezone
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DB_PATH = "recon.db"
MAX_CONCURRENT = 20
CRT_SH_URL = "https://crt.sh/?q=%25.{domain}&output=json"
TIMEOUT = 8


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS scans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            domain TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_id INTEGER NOT NULL,
            subdomain TEXT NOT NULL,
            alive INTEGER NOT NULL DEFAULT 0,
            status_code INTEGER,
            server_header TEXT,
            FOREIGN KEY (scan_id) REFERENCES scans(id)
        );
    """)
    conn.commit()
    conn.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Recon Dashboard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScanRequest(BaseModel):
    domain: str


class SubdomainResult(BaseModel):
    subdomain: str
    alive: bool
    status_code: int | None = None
    server_header: str | None = None


class ScanResponse(BaseModel):
    scan_id: int
    domain: str
    created_at: str
    results: list[SubdomainResult]


class ScanSummary(BaseModel):
    id: int
    domain: str
    created_at: str
    subdomain_count: int


@app.get("/")
def root():
    return {"status": "ok"}


async def fetch_subdomains(domain: str) -> list[str]:
    url = CRT_SH_URL.format(domain=domain)
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            return []

    seen = set()
    subdomains = []
    for entry in data:
        name = entry.get("name_value", "")
        for line in name.split("\n"):
            line = line.strip().lower()
            if line and line not in seen:
                seen.add(line)
                subdomains.append(line)
    return subdomains


async def check_alive(subdomain: str) -> SubdomainResult:
    result = SubdomainResult(subdomain=subdomain, alive=False)
    for scheme in ("https", "http"):
        url = f"{scheme}://{subdomain}"
        try:
            async with httpx.AsyncClient(
                timeout=TIMEOUT,
                follow_redirects=True,
                verify=False,
            ) as client:
                resp = await client.head(url)
                result.alive = True
                result.status_code = resp.status_code
                server = resp.headers.get("server")
                result.server_header = server if server else None
                return result
        except Exception:
            continue
    return result


async def run_scan(domain: str) -> tuple[int, str, list[SubdomainResult]]:
    subdomains = await fetch_subdomains(domain)
    if not subdomains:
        return 0, "", []

    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    async def limited_check(sub: str):
        async with semaphore:
            return await check_alive(sub)

    tasks = [limited_check(s) for s in subdomains]
    results = await asyncio.gather(*tasks)

    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    cursor = conn.execute("INSERT INTO scans (domain, created_at) VALUES (?, ?)", (domain, now))
    scan_id = cursor.lastrowid
    for r in results:
        conn.execute(
            "INSERT INTO results (scan_id, subdomain, alive, status_code, server_header) VALUES (?, ?, ?, ?, ?)",
            (scan_id, r.subdomain, int(r.alive), r.status_code, r.server_header),
        )
    conn.commit()
    conn.close()

    return scan_id, now, results


@app.post("/scan", response_model=ScanResponse)
async def start_scan(req: ScanRequest):
    domain = req.domain.strip().lower()
    if not domain or "." not in domain:
        raise HTTPException(status_code=400, detail="Invalid domain")

    scan_id, created_at, results = await run_scan(domain)
    if scan_id == 0:
        raise HTTPException(status_code=404, detail="No subdomains found for this domain")

    return ScanResponse(
        scan_id=scan_id,
        domain=domain,
        created_at=created_at,
        results=results,
    )


@app.get("/scan/{scan_id}")
def get_scan(scan_id: int):
    conn = get_db()
    scan = conn.execute("SELECT * FROM scans WHERE id = ?", (scan_id,)).fetchone()
    if not scan:
        conn.close()
        raise HTTPException(status_code=404, detail="Scan not found")

    rows = conn.execute(
        "SELECT * FROM results WHERE scan_id = ? ORDER BY id", (scan_id,)
    ).fetchall()
    conn.close()

    return {
        "scan_id": scan["id"],
        "domain": scan["domain"],
        "created_at": scan["created_at"],
        "results": [
            {
                "subdomain": r["subdomain"],
                "alive": bool(r["alive"]),
                "status_code": r["status_code"],
                "server_header": r["server_header"],
            }
            for r in rows
        ],
    }


@app.get("/scans")
def list_scans():
    conn = get_db()
    rows = conn.execute("""
        SELECT s.id, s.domain, s.created_at, COUNT(r.id) as subdomain_count
        FROM scans s
        LEFT JOIN results r ON r.scan_id = s.id
        GROUP BY s.id
        ORDER BY s.id DESC
    """).fetchall()
    conn.close()
    return [
        {"id": r["id"], "domain": r["domain"], "created_at": r["created_at"], "subdomain_count": r["subdomain_count"]}
        for r in rows
    ]
