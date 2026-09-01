import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function App() {
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [scans, setScans] = useState([])
  const [error, setError] = useState(null)
  const [activeScanId, setActiveScanId] = useState(null)

  useEffect(() => {
    fetchScans()
  }, [])

  async function fetchScans() {
    try {
      const resp = await fetch(`${API_URL}/scans`)
      if (resp.ok) setScans(await resp.json())
    } catch { /* backend probably down */ }
  }

  async function handleScan(e) {
    e.preventDefault()
    const d = domain.trim()
    if (!d) return

    setLoading(true)
    setError(null)
    setResults(null)
    setActiveScanId(null)

    try {
      const resp = await fetch(`${API_URL}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: d }),
      })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(body.detail || `Scan failed (${resp.status})`)
      }
      const data = await resp.json()
      setResults(data)
      setActiveScanId(data.scan_id)
      fetchScans()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadScan(scanId) {
    setLoading(true)
    setError(null)
    setResults(null)
    try {
      const resp = await fetch(`${API_URL}/scan/${scanId}`)
      if (!resp.ok) throw new Error('Failed to load scan')
      const data = await resp.json()
      setResults(data)
      setActiveScanId(scanId)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const showWelcome = !results && !loading && !error

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Recon Dashboard</h2>
        </div>
        <div className="sidebar-section">
          <h3>Past Scans</h3>
          {scans.length === 0 && <p className="empty">No scans yet</p>}
          {scans.map((s) => (
            <button
              key={s.id}
              className={`scan-item ${activeScanId === s.id ? 'active' : ''}`}
              onClick={() => loadScan(s.id)}
            >
              <span className="scan-domain">{s.domain}</span>
              <span className="scan-meta">{s.subdomain_count} subs</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="main">
        <form className="scan-form" onSubmit={handleScan}>
          <input
            type="text"
            placeholder="Enter domain (e.g. example.com)"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !domain.trim()}>
            {loading ? 'Scanning…' : 'Scan'}
          </button>
        </form>

        {error && <div className="error-msg">{error}</div>}

        {showWelcome && (
          <div className="welcome">
            <div className="welcome-icon">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="32" cy="32" r="30" stroke="var(--accent)" strokeWidth="2" opacity="0.3"/>
                <circle cx="32" cy="32" r="20" stroke="var(--accent)" strokeWidth="2" opacity="0.5"/>
                <circle cx="32" cy="32" r="10" stroke="var(--accent)" strokeWidth="2" opacity="0.7"/>
                <circle cx="32" cy="32" r="3" fill="var(--accent)"/>
                <line x1="32" y1="2" x2="32" y2="12" stroke="var(--accent)" strokeWidth="1.5" opacity="0.4"/>
                <line x1="32" y1="52" x2="32" y2="62" stroke="var(--accent)" strokeWidth="1.5" opacity="0.4"/>
                <line x1="2" y1="32" x2="12" y2="32" stroke="var(--accent)" strokeWidth="1.5" opacity="0.4"/>
                <line x1="52" y1="32" x2="62" y2="32" stroke="var(--accent)" strokeWidth="1.5" opacity="0.4"/>
              </svg>
            </div>
            <h1 className="welcome-title">Recon Dashboard</h1>
            <p className="welcome-desc">
              Discover subdomains, check liveness, and identify exposed servers — all in one place.
            </p>
            <div className="welcome-features">
              <div className="feature">
                <span className="feature-icon">🔍</span>
                <div>
                  <h3>Subdomain Discovery</h3>
                  <p>Pulls from crt.sh certificate transparency logs to find every subdomain tied to your target.</p>
                </div>
              </div>
              <div className="feature">
                <span className="feature-icon">🟢</span>
                <div>
                  <h3>Liveness Check</h3>
                  <p>Async probes each subdomain to see if it responds — HTTPS first, HTTP fallback.</p>
                </div>
              </div>
              <div className="feature">
                <span className="feature-icon">📡</span>
                <div>
                  <h3>Server Fingerprinting</h3>
                  <p>Captures the Server header to reveal what software is running behind each subdomain.</p>
                </div>
              </div>
            </div>
            <p className="welcome-cta">Enter a domain above to start scanning.</p>
          </div>
        )}

        {loading && (
          <div className="skeleton-table">
            {Array.from({ length: 8 }).map((_, i) => (
              <div className="skeleton-row" key={i}>
                <div className="sk-cell sk-wide" />
                <div className="sk-cell sk-dot" />
                <div className="sk-cell sk-narrow" />
                <div className="sk-cell sk-medium" />
              </div>
            ))}
          </div>
        )}

        {results && !loading && (
          <div className="results">
            <div className="results-header">
              <h2>{results.domain}</h2>
              <span className="results-count">
                {results.results.length} subdomains
              </span>
            </div>
            {results.results.length === 0 ? (
              <p className="empty">No subdomains found.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Subdomain</th>
                      <th>Status</th>
                      <th>Code</th>
                      <th>Server</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.results.map((r, i) => (
                      <tr
                        key={r.subdomain}
                        className="result-row"
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <td className="mono">{r.subdomain}</td>
                        <td>
                          <span
                            className={`dot ${r.alive ? 'alive' : 'dead'}`}
                          />
                        </td>
                        <td>{r.status_code ?? '—'}</td>
                        <td className="mono">{r.server_header ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
