/**
 * ROLLTIME — main server
 * Node + Express, tanpa build step. Frontend static HTML + ES modules.
 */
const fs = require('fs');
const path = require('path');

// --- load .env manual (no dep) ---
(function loadEnv() {
  const p = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#')) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

const express = require('express');
const multer = require('multer');
const archiver = require('archiver');
const QRCode = require('qrcode');
const db = require('./db');
const storage = require('./storage');

const app = express();
const PUB = path.join(__dirname, '..', 'public');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(express.json({ limit: '1mb' }));

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode(len = 5) {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s.toLowerCase();
}
const sanitizeCode = c => String(c || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);

/* ---------------- helpers ---------------- */
async function authUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  return db.getSessionUser(token);
}
async function authGuest(req) {
  const token = req.headers['x-guest-token'];
  if (!token) return null;
  return db.getGuestByToken(String(token));
}
function eventState(ev) {
  const now = Date.now();
  const start = new Date(ev.starts_at).getTime();
  const end = new Date(ev.ends_at).getTime();
  const reveal = new Date(ev.reveal_at).getTime();
  return {
    started: now >= start,
    ended: now >= end,
    revealed: now >= reveal,
    active: now >= start && now < end,
  };
}
function publicEvent(ev, counts) {
  const st = eventState(ev);
  const fids = Array.isArray(ev.filter_ids) && ev.filter_ids.length ? ev.filter_ids : [ev.filter_id ?? 1];
  return {
    code: ev.code, name: ev.name, type: ev.type,
    filter_id: ev.filter_id, filter_ids: fids, shots_per_guest: ev.shots_per_guest,
    starts_at: ev.starts_at, ends_at: ev.ends_at, reveal_at: ev.reveal_at,
    ...st, counts,
  };
}
const ok = (res, data) => res.json({ ok: true, ...data });
const fail = (res, code, message = '', status = 400) => res.status(status).json({ ok: false, error: code, message });

/* ---------------- config & auth ---------------- */
app.get('/api/config', (req, res) => ok(res, { dbMode: db.mode, storageMode: storage.mode }));

/* diagnosa koneksi Supabase (aman: nggak ada secret yang bocor, cuma status) */
app.get('/api/diag', async (req, res) => {
  const out = { dbMode: db.mode, storageMode: storage.mode };
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  try {
    const u = new URL(url);
    out.url_parse_ok = /^https?:$/.test(u.protocol);
  } catch (e) { out.url_parse_ok = false; out.hint = 'SUPABASE_URL tidak valid — harus lengkap, contoh: https://abcdefgh.supabase.co'; }
  out.service_key_format = /^eyJ[A-Za-z0-9_-]+\./.test(key) ? 'jwt_ok' : 'suspicious (bukan JWT — pastikan ini SERVICE ROLE key, bukan anon)';
  if (out.url_parse_ok) {
    try {
      const r = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, { headers: { apikey: key } });
      out.auth_http = r.status;           // 200 = url+key jalan; 401/403 = key salah; 404 = url salah
      const j = await r.json().catch(() => ({}));
      if (j.external) out.email_provider = j.external.email === true ? 'ON' : 'OFF — nyalakan di Auth → Providers → Email';
      else if (j.error_code || j.msg) out.auth_error = j.error_code || j.msg;
      if ('mailer_autoconfirm' in j) {
        out.mailer_autoconfirm = j.mailer_autoconfirm === true
          ? 'ON — signup langsung login (ideal)'
          : 'OFF — signup wajib klik link email. MATIKAN "Confirm email" di Authentication → Sign In / Up → Email, karena SMTP gratis Supabase kena rate limit (max ~2-3 email/jam)';
      }
    } catch (e) {
      out.auth_reachable = false;
      out.fetch_error = String(e.cause?.code || e.message || e).slice(0, 100);
    }
    // cek tabel schema (harus 'ok' semua; kalau 404 → jalankan schema.sql di SQL Editor)
    out.tables = {};
    for (const tb of ['rt_users', 'rt_events', 'rt_guests', 'rt_photos', 'rt_reactions']) {
      try {
        const rr = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${tb}?select=*&limit=0`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
        });
        out.tables[tb] = rr.ok ? 'ok' : `http ${rr.status}${rr.status === 404 ? ' — tabel belum ada, jalankan schema.sql' : ''}`;
      } catch (e2) { out.tables[tb] = 'fetch_error'; }
    }
  }
  ok(res, out);
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return fail(res, 'missing_fields');
    if (String(password).length < 4) return fail(res, 'weak_password');
    let user;
    try {
      user = await db.createUser({ name: String(name).slice(0, 40), email, password });
    } catch (e) {
      if (e.code === 'email_taken') return fail(res, 'email_taken', '', 409);
      // Supabase dgn "Confirm email" ON: akun kebuat tapi sesi belum ada → kasih tahu dengan BAIK
      if (e.code === 'confirm_email') return ok(res, { needs_confirm: true });
      if (e.code === 'weak_password') return fail(res, 'weak_password'); // GoTrue min 6 karakter
      throw e;
    }
    try {
      const { token } = await db.loginUser(email, password);
      return ok(res, { token, user });
    } catch (e2) {
      // akun kebuat tapi auto-login gagal (rate limit dsb) → suruh login manual
      return ok(res, { needs_login: true });
    }
  } catch (e) {
    console.error('signup error:', e.code || '', e.detail || e.message || e);
    fail(res, 'signup_failed', e.detail || '', 500);
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const { token, user } = await db.loginUser(email, password);
    ok(res, { token, user });
  } catch (e) {
    console.error('login error:', e.code || '', e.detail || '');
    if (e.code === 'email_not_confirmed') return fail(res, 'email_not_confirmed', '', 403);
    fail(res, 'bad_credentials', '', 401);
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) await db.logout(h.slice(7));
  ok(res, {});
});

app.get('/api/me', async (req, res) => {
  const user = await authUser(req);
  if (!user) return fail(res, 'unauthorized', '', 401);
  ok(res, { user });
});

/* ---------------- events (owner) ---------------- */
app.post('/api/events', async (req, res) => {
  const user = await authUser(req);
  if (!user) return fail(res, 'unauthorized', '', 401);
  try {
    const b = req.body || {};
    let code = sanitizeCode(b.code) || genCode();
    if (code.length < 4) code = genCode();
    const starts = b.starts_at ? new Date(b.starts_at) : new Date();
    const ends = b.ends_at ? new Date(b.ends_at) : new Date(starts.getTime() + 24 * 3600e3);
    let reveal;
    if (b.reveal_mode === 'instant') reveal = starts;
    else if (b.reveal_mode === 'custom' && b.reveal_at) reveal = new Date(b.reveal_at);
    else reveal = new Date(ends.getTime() + 2 * 3600e3); // default: 2 jam setelah acara
    // multi-efek: filter_ids = daftar efek yg dipilih host (min 1), filter_id = default (elemen pertama)
    let fids = Array.isArray(b.filter_ids)
      ? b.filter_ids.map(x => parseInt(x, 10)).filter(x => Number.isInteger(x) && x >= 0 && x <= 14)
      : [];
    fids = [...new Set(fids)];
    if (fids.length === 0) fids = [Math.max(0, Math.min(14, parseInt(b.filter_id ?? 1, 10))) || 1];
    const evData = {
      code, owner_id: user.id,
      name: String(b.name || 'Acara').slice(0, 80),
      type: String(b.type || 'party'),
      filter_id: fids[0], filter_ids: fids,
      shots_per_guest: Math.max(1, Math.min(99, parseInt(b.shots_per_guest ?? 10, 10))),
      starts_at: starts.toISOString(), ends_at: ends.toISOString(), reveal_at: reveal.toISOString(),
    };
    let ev;
    try {
      ev = await db.createEvent(evData);
    } catch (e1) {
      // fallback: DB lama belum punya kolom filter_ids → simpan tanpa kolom itu
      if (String(e1.detail || '').includes('filter_ids')) {
        delete evData.filter_ids;
        ev = await db.createEvent(evData);
      } else throw e1;
    }
    ok(res, { event: publicEvent(ev, { guests: 0, photos: 0 }) });
  } catch (e) {
    if (e.code === 'code_taken' || (e.detail || '').includes('duplicate')) return fail(res, 'code_taken', '', 409);
    console.error(e); fail(res, 'create_failed', '', 500);
  }
});

app.get('/api/events', async (req, res) => {
  const user = await authUser(req);
  if (!user) return fail(res, 'unauthorized', '', 401);
  const list = await db.listEventsByOwner(user.id);
  const out = [];
  for (const ev of list) out.push(publicEvent(ev, await db.eventCounts(ev.id)));
  ok(res, { events: out });
});

app.get('/api/events/:code', async (req, res) => {
  const ev = await db.getEventByCode(sanitizeCode(req.params.code));
  if (!ev) return fail(res, 'not_found', '', 404);
  const counts = await db.eventCounts(ev.id);
  const result = publicEvent(ev, counts);
  // owner flag buat manage page
  const user = await authUser(req);
  if (user && user.id === ev.owner_id) result.owner = true;
  ok(res, { event: result });
});

async function ownerGuard(req, res) {
  const user = await authUser(req);
  const ev = await db.getEventByCode(sanitizeCode(req.params.code));
  if (!ev) { fail(res, 'not_found', '', 404); return [null, null]; }
  if (!user || user.id !== ev.owner_id) { fail(res, 'forbidden', '', 403); return [null, null]; }
  return [user, ev];
}

app.delete('/api/events/:code', async (req, res) => {
  const [, ev] = await ownerGuard(req, res);
  if (!ev) return;
  const photos = await db.listPhotos(ev.id);
  await db.deleteEvent(ev.code);
  if (storage.mode === 'local') for (const p of photos) await storage.remove(p.storage_key).catch(() => {});
  ok(res, {});
});

app.get('/api/events/:code/guests', async (req, res) => {
  const [, ev] = await ownerGuard(req, res);
  if (!ev) return;
  const guests = await db.listGuests(ev.id);
  ok(res, { guests: guests.map(g => ({ name: g.name, shots_used: g.shots_used, created_at: g.created_at })) });
});

/* ---------------- guests ---------------- */
app.post('/api/events/:code/join', async (req, res) => {
  const ev = await db.getEventByCode(sanitizeCode(req.params.code));
  if (!ev) return fail(res, 'not_found', '', 404);
  const st = eventState(ev);
  if (st.ended) return fail(res, 'event_ended', '', 410);
  const name = String((req.body || {}).name || '').slice(0, 30).trim();
  if (!name) return fail(res, 'name_required');
  const g = await db.joinGuest(ev.id, name);
  ok(res, { guestToken: g.token, guest: { name: g.name, shots_used: 0 }, shots_per_guest: ev.shots_per_guest });
});

/* reuse guest: kembalikan state shots */
app.get('/api/events/:code/roll', async (req, res) => {
  const ev = await db.getEventByCode(sanitizeCode(req.params.code));
  if (!ev) return fail(res, 'not_found', '', 404);
  const g = await authGuest(req);
  if (!g || g.event_id !== ev.id) return fail(res, 'unauthorized', '', 401);
  ok(res, { guest: { name: g.name, shots_used: g.shots_used }, shots_per_guest: ev.shots_per_guest, filter_id: ev.filter_id, filter_ids: Array.isArray(ev.filter_ids) && ev.filter_ids.length ? ev.filter_ids : [ev.filter_id ?? 1], ...eventState(ev) });
});

/* ---------------- photos ---------------- */
app.post('/api/events/:code/photos', upload.single('photo'), async (req, res) => {
  const ev = await db.getEventByCode(sanitizeCode(req.params.code));
  if (!ev) return fail(res, 'not_found', '', 404);
  const g = await authGuest(req);
  if (!g || g.event_id !== ev.id) return fail(res, 'unauthorized', '', 401);
  const st = eventState(ev);
  if (st.ended) return fail(res, 'event_ended', '', 410);
  if (!st.started) return fail(res, 'not_started', '', 425);
  if (g.shots_used >= ev.shots_per_guest) return fail(res, 'roll_empty', '', 403);
  if (!req.file || !req.file.buffer.length) return fail(res, 'no_file');
  try {
    const saved = await storage.save(req.file.buffer, `rolltime-${ev.code}-${Date.now()}.jpg`);
    const filterId = Math.max(0, Math.min(14, parseInt(req.body.filter_id ?? ev.filter_id, 10)));
    const photo = await db.addPhoto({
      event_id: ev.id, guest_id: g.id, guest_name: g.name,
      storage_key: saved.key, filter_id: filterId, size: saved.size || req.file.buffer.length,
    });
    await db.bumpGuestShot(g.id);
    ok(res, { photo: { id: photo.id, created_at: photo.created_at }, shots_used: Math.min(g.shots_used, ev.shots_per_guest) });
  } catch (e) {
    console.error('upload error', e);
    fail(res, 'upload_failed', e.detail || '', 500);
  }
});

app.get('/api/events/:code/photos', async (req, res) => {
  const ev = await db.getEventByCode(sanitizeCode(req.params.code));
  if (!ev) return fail(res, 'not_found', '', 404);
  const g = await authGuest(req);
  const user = await authUser(req);
  const isOwner = user && user.id === ev.owner_id;
  const isGuest = g && g.event_id === ev.id;
  if (!isOwner && !isGuest) return fail(res, 'unauthorized', '', 401);
  const st = eventState(ev);
  const photos = await db.listPhotos(ev.id);
  if (!st.revealed) {
    // OWNER tetap bisa lihat daftar + file (buat live wall di venue & monitoring)
    if (isOwner) {
      return ok(res, {
        revealed: false, owner: true, reveal_at: ev.reveal_at, total: photos.length,
        photos: photos.map(p => ({
          id: p.id, guest_name: p.guest_name, filter_id: p.filter_id,
          created_at: p.created_at, url: `/api/photo/${p.id}`,
        })),
      });
    }
    // tamu: cuma metadata, tanpa akses file
    return ok(res, {
      revealed: false, reveal_at: ev.reveal_at,
      total: photos.length,
      mine: isGuest ? photos.filter(p => p.guest_id === g.id).length : 0,
      photos: [],
    });
  }
  const counts = await db.reactionCounts(ev.id);
  const mineSet = g ? new Set(await db.reactionsByGuest(ev.id, g.id)) : new Set();
  ok(res, {
    revealed: true, total: photos.length,
    photos: photos.map(p => ({
      id: p.id, guest_name: p.guest_name, filter_id: p.filter_id,
      created_at: p.created_at, url: `/api/photo/${p.id}`,
      loves: counts[p.id] || 0, loved_me: mineSet.has(p.id),
    })),
  });
});

app.get('/api/photo/:id', async (req, res) => {
  const photo = await db.getPhoto(String(req.params.id));
  if (!photo) return fail(res, 'not_found', '', 404);
  // siapa boleh lihat? event harus sudah reveal (atau caller-nya owner)
  const event = await getEventById(photo.event_id);
  if (!event) return fail(res, 'not_found', '', 404);
  if (!eventState(event).revealed) {
    const user = await authUser(req);
    const isOwner = user && user.id === event.owner_id;
    if (!isOwner) return fail(res, 'hidden_until_reveal', '', 403);
  }
  const handle = await storage.open(photo.storage_key);
  if (!handle) return fail(res, 'file_missing', '', 404);
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  if (handle.size) res.setHeader('Content-Length', String(handle.size));
  handle.stream.pipe(res);
});

/* helper: ambil event by id (kedua adapter punya getEventByCode; tambah lookup by id) */
async function getEventById(id) {
  if (db.mode === 'local') {
    return (db.data.events || []).find(e => e.id === id) || null;
  }
  const rows = await db.rest(`rt_events?id=eq.${id}&select=*`);
  return (rows && rows[0]) || null;
}

/* download ZIP (setelah reveal) */
app.get('/api/events/:code/zip', async (req, res) => {
  const ev = await db.getEventByCode(sanitizeCode(req.params.code));
  if (!ev) return fail(res, 'not_found', '', 404);
  const g = await authGuest(req);
  const user = await authUser(req);
  const allowed = (user && user.id === ev.owner_id) || (g && g.event_id === ev.id);
  if (!allowed) return fail(res, 'unauthorized', '', 401);
  if (!eventState(ev).revealed) return fail(res, 'hidden_until_reveal', '', 403);
  const photos = await db.listPhotos(ev.id);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="rolltime-${ev.code}.zip"`);
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(res);
  let i = 1;
  for (const p of photos) {
    try {
      const handle = await storage.open(p.storage_key);
      if (handle) archive.append(handle.stream, { name: `${String(i).padStart(3, '0')}-${(p.guest_name || 'tamu').replace(/[^\w -]/g, '')}.jpg` });
      i++;
    } catch (e) { /* skip file error */ }
  }
  archive.finalize();
});

/* ---- reactions: ❤️ toggle (tamu, pasca-reveal) ---- */
app.post('/api/events/:code/react', async (req, res) => {
  const ev = await db.getEventByCode(sanitizeCode(req.params.code));
  if (!ev) return fail(res, 'not_found', '', 404);
  const g = await authGuest(req);
  if (!g || g.event_id !== ev.id) return fail(res, 'unauthorized', '', 401);
  if (!eventState(ev).revealed) return fail(res, 'hidden_until_reveal', '', 403);
  const photoId = String((req.body || {}).photo_id || '');
  const photo = await db.getPhoto(photoId);
  if (!photo || photo.event_id !== ev.id) return fail(res, 'photo_not_found', '', 404);
  try {
    const r = await db.toggleReaction(photo.id, ev.id, g.id, g.name);
    ok(res, { loved: r.loved, count: r.count });
  } catch (e) { console.error(e); fail(res, 'react_failed', '', 500); }
});

/* ---- leaderboard: foto paling ❤️ ---- */
app.get('/api/events/:code/leaderboard', async (req, res) => {
  const ev = await db.getEventByCode(sanitizeCode(req.params.code));
  if (!ev) return fail(res, 'not_found', '', 404);
  const g = await authGuest(req);
  const user = await authUser(req);
  const allowed = (user && user.id === ev.owner_id) || (g && g.event_id === ev.id);
  if (!allowed) return fail(res, 'unauthorized', '', 401);
  if (!eventState(ev).revealed) return fail(res, 'hidden_until_reveal', '', 403);
  const top = await db.leaderboard(ev.id, 10);
  ok(res, { top: top.map(p => ({ ...p, url: `/api/photo/${p.id}` })) });
});

/* QR code SVG */
app.get('/api/qr.svg', async (req, res) => {
  const text = String(req.query.text || '').slice(0, 500);
  if (!text) return fail(res, 'no_text');
  const svg = await QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#101010', light: '#00000000' } });
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(svg);
});

/* ---------------- pages ---------------- */
const page = f => (req, res) => res.sendFile(path.join(PUB, f));
app.get('/', page('index.html'));
app.get('/auth', page('auth.html'));
app.get('/app', page('dashboard.html'));
app.get('/create', page('create.html'));
app.get('/booth', page('booth.html'));
app.get('/e/:code', page('join.html'));
app.get('/e/:code/cam', page('camera.html'));
app.get('/e/:code/gallery', page('gallery.html'));
app.get('/e/:code/manage', page('manage.html'));
app.get('/e/:code/live', page('live.html'));

app.use(express.static(PUB, { maxAge: '1h', index: false }));
app.use((req, res) => res.status(404).sendFile(path.join(PUB, 'index.html')));

// app di-export biar bisa dipakai standalone (server.js) atau serverless (api/index.js di Vercel)
module.exports = { app, db, storage };
