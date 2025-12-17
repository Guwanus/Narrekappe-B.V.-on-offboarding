// Minimal Proxmox REST API helper (token-based)
//
// Required env:
// - PROXMOX_BASE_URL  e.g. https://192.168.205.30:8006
// - PROXMOX_API_TOKEN e.g. root@pam!narrekappe=xxxxxxxxxxxxxxxx
//
// Optional env:
// - PROXMOX_REALM (default: pve)
//
// Notes:
// - Proxmox uses self-signed TLS by default. For development you can set:
//   NODE_TLS_REJECT_UNAUTHORIZED=0

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function getRealm() {
  return process.env.PROXMOX_REALM || 'pve';
}

export function encodeComment(fullName) {
  return String(fullName || '').trim();
}

// ✅ Needed by existing code (users overview mapping)
export function decodeComment(comment) {
  const fullName = String(comment || '').trim();
  // Bij optie 2 hebben we geen email meer; return lege email zodat UI niet crasht.
  return { email: '', fullName };
}

async function proxmoxRequest(method, path, bodyParams) {
  const base = requireEnv('PROXMOX_BASE_URL').replace(/\/+$/, '');
  const token = requireEnv('PROXMOX_API_TOKEN');
  const url = `${base}/api2/json${path}`;

  const headers = {
    Authorization: `PVEAPIToken=${token}`,
  };

  let body;
  if (bodyParams && ['POST', 'PUT', 'DELETE'].includes(method)) {
    body = new URLSearchParams();
    Object.entries(bodyParams).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      body.append(k, String(v));
    });
    headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
  }

  const res = await fetch(url, { method, headers, body });
  const text = await res.text();

  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg = json?.errors
      ? JSON.stringify(json.errors)
      : json?.message || json?.error || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json;
}

export async function proxmoxListUsers() {
  const json = await proxmoxRequest('GET', '/access/users');
  const data = json?.data;
  return Array.isArray(data) ? data : [];
}

// ✅ Let op: bij optie 2 sturen we direct userid mee (geen email->userid conversie meer)
export async function proxmoxCreateUser({ userid, fullName, password }) {
  if (!userid) throw new Error('Missing userid');
  if (!password || String(password).length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  await proxmoxRequest('POST', '/access/users', {
    userid,
    password,
    comment: encodeComment(fullName),
    enable: 1,
  });

  return { userid };
}

export async function proxmoxDeleteUser({ userid }) {
  if (!userid) throw new Error('Missing userid');
  const safe = encodeURIComponent(userid);
  await proxmoxRequest('DELETE', `/access/users/${safe}`);
  return { userid };
}
