import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

export default function ProxmoxUsersPage() {
  const [csvText, setCsvText] = useState('first_name,last_name,password\n');
  const [csvFileName, setCsvFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState(null); // { type: 'success'|'error', text }

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      (u.email || '').toLowerCase().includes(q) || (u.fullName || '').toLowerCase().includes(q)
    );
  }, [users, query]);

  async function refresh() {
    setLoading(true);
    setMessage(null);
    try {
      // Force a fresh fetch (avoid 304/ETag cached responses).
      const res = await fetch(`/api/proxmox/users?ts=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load users');
      setUsers(data.users || []);
    } catch (e) {
      setMessage({ type: 'error', text: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function importCsv(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/proxmox/import-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvText }),
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Import failed');

      setMessage({
        type: data.failed > 0 ? 'error' : 'success',
        text: `Import done: ${data.success} success, ${data.failed} failed`,
      });
      await refresh();
    } catch (e2) {
      setMessage({ type: 'error', text: String(e2?.message || e2) });
    } finally {
      setLoading(false);
    }
  }

  async function onCsvFilePicked(file) {
    if (!file) return;
    setCsvFileName(file.name);
    const text = await file.text();
    setCsvText(text);
  }

  async function deleteUser(user) {
    const label = user.email || user.userid;
    const ok = confirm(`Are you sure you ${label} want to delete?`);
    if (!ok) return;

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/proxmox/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userid: user.userid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to delete user');
      setMessage({ type: 'success', text: `User deleted: ${data.userid}` });
      await refresh();
    } catch (e) {
      setMessage({ type: 'error', text: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand" href="/">
            Narrekappe<span className="accent">.</span>
          </Link>
          <nav className="main-nav">
            <Link href="/">Home</Link>
            <Link href="/features">Features</Link>
            <Link href="/training">Training</Link>
            <Link href="/admin">Admin</Link>
            <Link href="/security">Security</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/user-portal">User Portal</Link>
            <Link href="/admin-dashboard">Dashboard</Link>
            <Link href="/admin-login">Logout</Link>
          </nav>
          <button className="nav-toggle" aria-label="Toggle navigation">
            ☰
          </button>
        </div>
      </header>

      <main className="container">
        <h1>Proxmox usermanagement</h1>
        <p className="muted">
          Simple page to create and delete users in Proxmox.
        </p>

        {message ? (
          <div className={`card ${message.type === 'error' ? 'border border-narrek-danger/40' : 'border border-white/10'}`}>
            <p className={message.type === 'error' ? 'text-narrek-danger' : 'text-narrek-accent-2'}>{message.text}</p>
          </div>
        ) : null}

        <section className="card" style={{ marginTop: 16 }}>
          <h2>Onboard users via .csv</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            CSV columns: <b>first_name,last_name,password</b> (password min. 8 characters).
          </p>

          <form className="contact-form" onSubmit={importCsv}>
            <div>
              <input
                className="form-input"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => onCsvFilePicked(e.target.files?.[0])}
                disabled={loading}
              />
              {csvFileName ? (
                <p className="muted" style={{ marginTop: 6 }}>
                  Selected: {csvFileName}
                </p>
              ) : null}
            </div>

            <textarea
              className="form-input"
              style={{ minHeight: 180 }}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="first_name,last_name,password\nAlice,Example,ChangeMe123!"
            />

            <div className="form-actions">
              <button className="btn" type="submit" disabled={loading}>
                {loading ? 'Loading…' : 'Import'}
              </button>
              <button className="btn ghost" type="button" onClick={refresh} disabled={loading}>
                Refresh
              </button>
            </div>
          </form>
        </section>

        <section className="card" style={{ marginTop: 16 }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 style={{ margin: 0 }}>Users overview</h2>
            <input
              className="form-input"
              style={{ maxWidth: 320 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name"
            />
          </div>

          <div style={{ marginTop: 12, overflowX: 'auto' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-narrek-muted">
                <th className="text-left py-3">Name</th>
                <th className="text-left py-3">Status</th>
                <th className="text-right py-3">Actions</th>
              </tr>
            </thead>
  
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-3 text-narrek-muted">
                      {loading ? 'Loading…' : 'No users found.'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.userid} className="border-t border-white/5">
                      <td className="py-2 text-narrek-muted">{u.fullName || '-'}</td>
                      <td className="py-2">
                        <span className={`status-badge ${u.enabled ? 'status-running' : 'status-stopped'}`}>
                          {u.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <button
                          className="btn btn-sm btn-danger"
                          type="button"
                          onClick={() => deleteUser(u)}
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <p>© Narrekappe B.V.</p>
        </div>
      </footer>
    </>
  );
}
