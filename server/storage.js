/**
 * ROLLTIME — storage adapter (pilih otomatis dari env, prioritas atas→bawah):
 *
 *  1. telegram    : TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
 *                   → channel privat via Bot API. GRATIS, unlimited, 50MB/file. Rekomendasi.
 *  2. supa-storage: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (tanpa telegram)
 *                   → Supabase Storage, bucket privat auto-dibuat ("rolltime-photos").
 *                   GRATIS 1GB (free tier) ≈ 500–1000 foto. Paling simpel — satu akun buat semua.
 *  3. local       : default demo → data/uploads
 *
 * Interface sama: save(buffer, filename) → {key,size}; open(key) → {stream,size}; remove(key).
 * "key" itulah yang disimpen di kolom rt_photos.storage_key.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');

const UP_DIR = path.join(process.env.VERCEL ? '/tmp' : path.join(__dirname, '..'), 'data', 'uploads');

/* ============================ 1) TELEGRAM ============================ */
class TelegramStorage {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID; // contoh: -100xxxxxxxxxx (channel privat)
    this.api = `https://api.telegram.org/bot${this.token}`;
  }
  async save(buffer, filename) {
    const form = new FormData();
    form.append('chat_id', this.chatId);
    form.append('document', new Blob([buffer], { type: 'image/jpeg' }), filename || 'photo.jpg');
    form.append('disable_notification', 'true');
    const res = await fetch(`${this.api}/sendDocument`, { method: 'POST', body: form });
    const j = await res.json();
    if (!j.ok) { const e = new Error('telegram_upload_failed'); e.detail = j.description; throw e; }
    return { key: j.result.document.file_id, size: buffer.length, messageId: j.result.message_id };
  }
  async fileUrl(key) {
    const res = await fetch(`${this.api}/getFile?file_id=${encodeURIComponent(key)}`);
    const j = await res.json();
    if (!j.ok) return null;
    return `https://api.telegram.org/file/bot${this.token}/${j.result.file_path}`;
  }
  async open(key) {
    const url = await this.fileUrl(key);
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok || !res.body) return null;
    return { stream: Readable.fromWeb(res.body), size: Number(res.headers.get('content-length') || 0) };
  }
  async remove() { /* arsip telegram dibiarkan */ }
}

/* ======================= 2) SUPABASE STORAGE ======================= */
class SupaStorage {
  constructor() {
    this.url = process.env.SUPABASE_URL.replace(/\/$/, '');
    this.key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.bucket = process.env.SUPABASE_STORAGE_BUCKET || 'rolltime-photos';
    this.h = { apikey: this.key, Authorization: `Bearer ${this.key}` };
    this._bucketReady = false;
  }
  async ensureBucket() {
    if (this._bucketReady) return;
    const res = await fetch(`${this.url}/storage/v1/bucket`, {
      method: 'POST',
      headers: { ...this.h, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: this.bucket, name: this.bucket, public: false,
        file_size_limit: 52428800,
        allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      // 400/409 "already exists" → lanjut; error lain → throw
      if (!/exist|duplicate|409/i.test(t) && res.status !== 409) {
        const e = new Error('bucket_create_failed'); e.detail = t; throw e;
      }
    }
    this._bucketReady = true;
  }
  async save(buffer, filename) {
    await this.ensureBucket();
    const key = crypto.randomBytes(16).toString('hex') + '.jpg';
    const res = await fetch(`${this.url}/storage/v1/object/${this.bucket}/${key}`, {
      method: 'POST',
      headers: { ...this.h, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
      body: buffer,
    });
    if (!res.ok) { const e = new Error('supa_upload_failed'); e.detail = await res.text(); throw e; }
    return { key, size: buffer.length };
  }
  async open(key) {
    const res = await fetch(`${this.url}/storage/v1/object/${this.bucket}/${key}`, { headers: this.h });
    if (!res.ok || !res.body) return null;
    return { stream: Readable.fromWeb(res.body), size: Number(res.headers.get('content-length') || 0) };
  }
  async remove(key) {
    await fetch(`${this.url}/storage/v1/object/${this.bucket}/${key}`, { method: 'DELETE', headers: this.h }).catch(() => {});
  }
}

/* ========================= 3) LOCAL DISK ========================= */
class LocalStorage {
  constructor() { fs.mkdirSync(UP_DIR, { recursive: true }); }
  async save(buffer, filename) {
    const ext = (path.extname(filename || '') || '.jpg').toLowerCase();
    const key = crypto.randomBytes(16).toString('hex') + ext;
    fs.writeFileSync(path.join(UP_DIR, key), buffer);
    return { key, size: buffer.length };
  }
  async open(key) {
    const p = path.join(UP_DIR, path.basename(key));
    if (!fs.existsSync(p)) return null;
    return { stream: fs.createReadStream(p), size: fs.statSync(p).size };
  }
  async remove(key) {
    const p = path.join(UP_DIR, path.basename(key));
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

const hasTele = !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
const hasSupa = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const storage = hasTele ? new TelegramStorage() : hasSupa ? new SupaStorage() : new LocalStorage();
storage.mode = hasTele ? 'telegram' : hasSupa ? 'supa-storage' : 'local';
module.exports = storage;
