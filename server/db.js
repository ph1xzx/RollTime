/**
 * ROLLTIME — database adapter
 * Dua mode:
 *  - local    : JSON file di ./data/db.json (default, demo mode)
 *  - supabase : PostgREST + GoTrue via REST API (aktif kalau SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY di-set)
 * Interface method-nya SAMA, jadi server.js nggak perlu tahu bedanya.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(process.env.VERCEL ? '/tmp' : path.join(__dirname, '..'), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function uuid() { return crypto.randomUUID(); }
function nowIso() { return new Date().toISOString(); }
function hashPass(password, salt) {
  return crypto.createHash('sha256').update(salt + ':' + password).digest('hex');
}

/* ============================ LOCAL (demo) ============================ */
class LocalDB {
  constructor() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DB_FILE)) {
      this.data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      this.data.reactions ||= [];   // kompatibel db.json lama
    } else {
      this.data = { users: [], sessions: [], events: [], guests: [], photos: [], reactions: [] };
      this.save();
    }
  }
  save() {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1));
    fs.renameSync(tmp, DB_FILE);
  }

  // ---- users & sessions ----
  async createUser({ name, email, password }) {
    email = String(email).toLowerCase().trim();
    if (this.data.users.find(u => u.email === email)) throw Object.assign(new Error('email_taken'), { code: 'email_taken' });
    const salt = crypto.randomBytes(8).toString('hex');
    const user = { id: uuid(), name, email, pass_hash: hashPass(password, salt), salt, created_at: nowIso() };
    this.data.users.push(user); this.save();
    return { id: user.id, name: user.name, email: user.email };
  }
  async loginUser(email, password) {
    email = String(email).toLowerCase().trim();
    const u = this.data.users.find(x => x.email === email);
    if (!u || u.pass_hash !== hashPass(password, u.salt)) throw Object.assign(new Error('bad_credentials'), { code: 'bad_credentials' });
    const token = crypto.randomBytes(24).toString('hex');
    this.data.sessions.push({ token, user_id: u.id, created_at: nowIso() });
    this.save();
    return { token, user: { id: u.id, name: u.name, email: u.email } };
  }
  async getSessionUser(token) {
    const s = this.data.sessions.find(x => x.token === token);
    if (!s) return null;
    const u = this.data.users.find(x => x.id === s.user_id);
    return u ? { id: u.id, name: u.name, email: u.email } : null;
  }
  async logout(token) {
    this.data.sessions = this.data.sessions.filter(x => x.token !== token); this.save();
  }

  // ---- events ----
  async createEvent(ev) {
    if (this.data.events.find(e => e.code === ev.code)) throw Object.assign(new Error('code_taken'), { code: 'code_taken' });
    const row = { id: uuid(), created_at: nowIso(), ...ev };
    this.data.events.push(row); this.save();
    return row;
  }
  async getEventByCode(code) {
    return this.data.events.find(e => e.code === code) || null;
  }
  async listEventsByOwner(ownerId) {
    return this.data.events.filter(e => e.owner_id === ownerId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async updateEvent(code, patch) {
    const i = this.data.events.findIndex(e => e.code === code);
    if (i < 0) return null;
    this.data.events[i] = { ...this.data.events[i], ...patch };
    this.save(); return this.data.events[i];
  }
  async deleteEvent(code) {
    const ev = await this.getEventByCode(code);
    if (!ev) return null;
    this.data.events = this.data.events.filter(e => e.code !== code);
    this.data.guests = this.data.guests.filter(g => g.event_id !== ev.id);
    this.data.photos = this.data.photos.filter(p => p.event_id !== ev.id);
    this.data.reactions = (this.data.reactions || []).filter(r => r.event_id !== ev.id);
    this.save(); return ev;
  }

  // ---- guests ----
  async joinGuest(eventId, name) {
    const g = { id: uuid(), event_id: eventId, name, token: crypto.randomBytes(18).toString('hex'), shots_used: 0, created_at: nowIso() };
    this.data.guests.push(g); this.save();
    return g;
  }
  async getGuestByToken(token) {
    return this.data.guests.find(g => g.token === token) || null;
  }
  async bumpGuestShot(guestId) {
    const g = this.data.guests.find(x => x.id === guestId);
    if (g) { g.shots_used++; this.save(); }
    return g;
  }
  async listGuests(eventId) {
    return this.data.guests.filter(g => g.event_id === eventId);
  }

  // ---- photos ----
  async addPhoto(p) {
    const row = { id: uuid(), created_at: nowIso(), ...p };
    this.data.photos.push(row); this.save();
    return row;
  }
  async listPhotos(eventId) {
    return this.data.photos.filter(p => p.event_id === eventId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  async getPhoto(id) {
    return this.data.photos.find(p => p.id === id) || null;
  }
  async deletePhoto(id) {
    this.data.photos = this.data.photos.filter(p => p.id !== id);
    this.data.reactions = (this.data.reactions || []).filter(r => r.photo_id !== id);
    this.save();
  }

  /* ---- reactions (❤️ per foto, 1 per tamu per foto, toggle) ---- */
  async toggleReaction(photoId, eventId, guestId, guestName) {
    const list = this.data.reactions;
    const idx = list.findIndex(r => r.photo_id === photoId && r.guest_id === guestId);
    let loved;
    if (idx >= 0) { list.splice(idx, 1); loved = false; }
    else { list.push({ id: uuid(), photo_id: photoId, event_id: eventId, guest_id: guestId, guest_name: guestName, created_at: nowIso() }); loved = true; }
    this.save();
    return { loved, count: list.filter(r => r.photo_id === photoId).length };
  }
  async reactionCounts(eventId) {
    const out = {};
    for (const r of (this.data.reactions || [])) if (r.event_id === eventId) out[r.photo_id] = (out[r.photo_id] || 0) + 1;
    return out;
  }
  async reactionsByGuest(eventId, guestId) {
    return (this.data.reactions || []).filter(r => r.event_id === eventId && r.guest_id === guestId).map(r => r.photo_id);
  }
  async leaderboard(eventId, limit = 10) {
    const counts = await this.reactionCounts(eventId);
    const photos = await this.listPhotos(eventId);
    return photos
      .map(p => ({ id: p.id, guest_name: p.guest_name, filter_id: p.filter_id, created_at: p.created_at, loves: counts[p.id] || 0 }))
      .filter(p => p.loves > 0)
      .sort((a, b) => b.loves - a.loves)
      .slice(0, limit);
  }
  async eventCounts(eventId) {
    return {
      guests: this.data.guests.filter(g => g.event_id === eventId).length,
      photos: this.data.photos.filter(p => p.event_id === eventId).length,
    };
  }
}

/* ============================ SUPABASE ============================ */
class SupaDB {
  constructor() {
    this.url = process.env.SUPABASE_URL.replace(/\/$/, '');
    this.key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.h = { apikey: this.key, Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' };
  }
  async rest(table, { method = 'GET', query = '', body, prefer } = {}) {
    const headers = { ...this.h };
    if (prefer) headers.Prefer = prefer;
    const res = await fetch(`${this.url}/rest/v1/${table}${query}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      const err = new Error('db_error'); err.detail = text; err.status = res.status; throw err;
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('json') ? res.json() : null;
  }

  // ---- auth (GoTrue) ----
  async createUser({ name, email, password }) {
    const res = await fetch(`${this.url}/auth/v1/signup`, {
      method: 'POST', headers: this.h,
      body: JSON.stringify({ email, password, data: { name } }),
    });
    const j = await res.json();
    if (!res.ok) throw Object.assign(new Error(j.msg || 'signup_failed'), { code: j.error_code || 'signup_failed' });
    // simpan profile
    await this.rest('rt_users', { method: 'POST', body: { id: j.user.id, name, email: email.toLowerCase() }, prefer: 'return=minimal' }).catch(() => {});
    if (!j.access_token) { // email confirmation ON — user harus verify; kembalikan info
      const err = new Error('confirm_email'); err.code = 'confirm_email'; throw err;
    }
    return { id: j.user.id, name, email: email.toLowerCase() };
  }
  async loginUser(email, password) {
    const res = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: this.h,
      body: JSON.stringify({ email, password }),
    });
    const j = await res.json();
    if (!res.ok) throw Object.assign(new Error('bad_credentials'), { code: 'bad_credentials' });
    const u = j.user;
    return { token: j.access_token, user: { id: u.id, name: (u.user_metadata && u.user_metadata.name) || u.email, email: u.email } };
  }
  async getSessionUser(token) {
    const res = await fetch(`${this.url}/auth/v1/user`, {
      headers: { apikey: this.key, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const u = await res.json();
    return { id: u.id, name: (u.user_metadata && u.user_metadata.name) || u.email, email: u.email };
  }
  async logout() { /* stateless JWT */ }

  // ---- events ----
  async createEvent(ev) {
    const rows = await this.rest('rt_events', { method: 'POST', body: ev, prefer: 'return=representation' });
    return rows[0];
  }
  async getEventByCode(code) {
    const rows = await this.rest(`rt_events?code=eq.${encodeURIComponent(code)}&select=*`);
    return rows[0] || null;
  }
  async listEventsByOwner(ownerId) {
    return this.rest(`rt_events?owner_id=eq.${ownerId}&select=*&order=created_at.desc`);
  }
  async updateEvent(code, patch) {
    const rows = await this.rest(`rt_events?code=eq.${encodeURIComponent(code)}`, { method: 'PATCH', body: patch, prefer: 'return=representation' });
    return rows[0] || null;
  }
  async deleteEvent(code) {
    const ev = await this.getEventByCode(code);
    if (ev) await this.rest(`rt_events?code=eq.${encodeURIComponent(code)}`, { method: 'DELETE' });
    return ev;
  }

  // ---- guests ----
  async joinGuest(eventId, name) {
    const token = crypto.randomBytes(18).toString('hex');
    const rows = await this.rest('rt_guests', { method: 'POST', body: { event_id: eventId, name, token }, prefer: 'return=representation' });
    return rows[0];
  }
  async getGuestByToken(token) {
    const rows = await this.rest(`rt_guests?token=eq.${encodeURIComponent(token)}&select=*`);
    return rows[0] || null;
  }
  async bumpGuestShot(guestId) {
    const g = (await this.rest(`rt_guests?id=eq.${guestId}&select=*`))[0];
    if (g) await this.rest(`rt_guests?id=eq.${guestId}`, { method: 'PATCH', body: { shots_used: (g.shots_used || 0) + 1 }, prefer: 'return=minimal' });
    return g;
  }
  async listGuests(eventId) {
    return this.rest(`rt_guests?event_id=eq.${eventId}&select=*`);
  }

  // ---- photos ----
  async addPhoto(p) {
    const rows = await this.rest('rt_photos', { method: 'POST', body: p, prefer: 'return=representation' });
    return rows[0];
  }
  async listPhotos(eventId) {
    return this.rest(`rt_photos?event_id=eq.${eventId}&select=*&order=created_at.asc`);
  }
  async getPhoto(id) {
    const rows = await this.rest(`rt_photos?id=eq.${id}&select=*`);
    return rows[0] || null;
  }
  async deletePhoto(id) {
    await this.rest(`rt_photos?id=eq.${id}`, { method: 'DELETE' });
  }

  /* ---- reactions ---- */
  async toggleReaction(photoId, eventId, guestId, guestName) {
    const ex = await this.rest(`rt_reactions?photo_id=eq.${photoId}&guest_id=eq.${guestId}&select=id`);
    if (ex.length) {
      await this.rest(`rt_reactions?id=eq.${ex[0].id}`, { method: 'DELETE' });
    } else {
      await this.rest('rt_reactions', { method: 'POST', body: { photo_id: photoId, event_id: eventId, guest_id: guestId, guest_name: guestName }, prefer: 'return=minimal' });
    }
    const all = await this.rest(`rt_reactions?photo_id=eq.${photoId}&select=id`);
    return { loved: !ex.length, count: all.length };
  }
  async reactionCounts(eventId) {
    const rows = await this.rest(`rt_reactions?event_id=eq.${eventId}&select=photo_id`);
    const out = {};
    for (const r of rows) out[r.photo_id] = (out[r.photo_id] || 0) + 1;
    return out;
  }
  async reactionsByGuest(eventId, guestId) {
    const rows = await this.rest(`rt_reactions?event_id=eq.${eventId}&guest_id=eq.${guestId}&select=photo_id`);
    return rows.map(r => r.photo_id);
  }
  async leaderboard(eventId, limit = 10) {
    const counts = await this.reactionCounts(eventId);
    const photos = await this.listPhotos(eventId);
    return photos
      .map(p => ({ id: p.id, guest_name: p.guest_name, filter_id: p.filter_id, created_at: p.created_at, loves: counts[p.id] || 0 }))
      .filter(p => p.loves > 0)
      .sort((a, b) => b.loves - a.loves)
      .slice(0, limit);
  }
  async eventCounts(eventId) {
    const guests = await this.rest(`rt_guests?event_id=eq.${eventId}&select=id`);
    const photos = await this.rest(`rt_photos?event_id=eq.${eventId}&select=id`);
    return { guests: guests.length, photos: photos.length };
  }
}

const useSupa = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const db = useSupa ? new SupaDB() : new LocalDB();
db.mode = useSupa ? 'supabase' : 'local';
module.exports = db;
