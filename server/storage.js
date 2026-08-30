/**
 * ROLLTIME — storage adapter
 * Dua mode:
 *  - local    : file disimpan di ./data/uploads (default, demo)
 *  - telegram : file dikirim ke channel privat via Bot API sendDocument.
 *               Telegram balikin file_id → itu yang jadi "key" di DB.
 *               Pas dibutuhkan, server ambil lagi binary-nya via getFile
 *               lalu stream ke browser.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');

const UP_DIR = path.join(process.env.VERCEL ? '/tmp' : path.join(__dirname, '..'), 'data', 'uploads');

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
    return {
      stream: Readable.fromWeb(res.body),
      size: Number(res.headers.get('content-length') || 0),
    };
  }
  async remove() { /* hapus di Telegram optional — biarkan arsipnya */ }
}

const useTele = !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
const storage = useTele ? new TelegramStorage() : new LocalStorage();
storage.mode = useTele ? 'telegram' : 'local';
module.exports = storage;
