# DEPLOY — ROLLTIME ke Production

Checklist lengkap: **Supabase (DB+Auth)** → **Telegram (storage)** → **Vercel (hosting)**.
Estimasi total: ±15 menit.

---

## A. Supabase (±5 menit)

1. Bikin project di [supabase.com](https://supabase.com) → catat **Project URL** & **service_role key**
   (Settings → API → `service_role` — yang secret, BUKAN anon key)
2. **SQL Editor → New query** → paste SELURUH isi [`schema.sql`](./schema.sql) → Run.
   Ini bikin 4 tabel: `rt_users`, `rt_events`, `rt_guests`, `rt_photos` + index.
3. **PENTING:** Authentication → Sign In / Providers → Email → **matikan "Confirm email"**
   (kalau aktif, signup lewat API akan minta verifikasi email dan login gagal langsung).
4. Server pakai service key → semua tabel diakses lewat API route; RLS boleh dibiarkan off.

## B. Storage foto — pilih SATU (gratis semua)

| Opsi | Kuota gratis | Setup | Catatan |
|---|---|---|---|
| **A. Telegram** | Unlimited (50MB/file) | ±5 menit | Rekomendasi buat acara ratusan tamu |
| **B. Supabase Storage** | 1GB ≈ 500-1000 foto | **0 menit** (auto) | Paling simpel — satu akun buat semua |
| C. Disk lokal | sebesar disk | 0 | HANYA untuk demo / VPS, bukan Vercel |

### Opsi A — Telegram (±5 menit)
1. Chat [@BotFather](https://t.me/BotFather) → `/newbot` → dapat **BOT TOKEN**
2. Bikin **channel PRIVAT** (misal `rolltime-storage`) → add bot jadi **admin** (Post Messages)
3. Ambil chat id — salah satu cara:
   - Kirim pesan apa aja di channel → buka `https://api.telegram.org/bot<TOKEN>/getUpdates` → cari `"chat":{"id":-100xxxxxxxxxx` (minus ikut)
   - atau **forward 1 pesan channel ke @userinfobot** → langsung dibales id-nya
   - alternatif: pakai **grup privat** biasa sebagai gudang (id grup = angka minus, works juga)
4. Cara kerja: foto tamu → `sendDocument` ke channel → `file_id` disimpan di `rt_photos.storage_key`
   → galeri ambil balik via `getFile` + stream. Gratis, unlimited.

### Opsi B — Supabase Storage (0 menit)
**Nggak perlu setup apa-apa** — kalau `TELEGRAM_*` tidak diisi, adapter otomatis:
bikin bucket privat `rolltime-photos` (sekali, saat upload pertama) → foto disimpan di situ.
Cek di Supabase Dashboard → Storage → bucket `rolltime-photos`.
Cocok buat event kecil-menengah. Kuota 1GB; hapus event lama buat ngosongin.

### Kenapa BUKAN Google Drive?
Bisa aja dipakai (15GB), tapi buat use-case ini boros masalah: perlu OAuth (refresh token),
buat service account ribet (service account nggak punya kuota Drive sendiri), tiap file harus
di-set "anyone with link", endpoint download-nya bukan CDN (pelan + kena rate-limit pas rame),
dan rawan quota-harian. Untuk photobooth yang puluhan tamu upload barengan → berisiko macet.
Kalau suatu saat tetap mau, bilang — adapter ke-4 bisa ditambah.

### Verifikasi storage aktif
`/api/config` → `"storageMode": "telegram"` / `"supa-storage"` / `"local"` (badge footer juga nunjukin).

## C. Vercel (±5 menit)

Repo ini sudah siap Vercel (`vercel.json` + `api/index.js` serverless).

1. [vercel.com](https://vercel.com) → **Add New → Project** → import repo `ph1xzx/RollTime`
   (Framework preset: **Other** — biarkan kosong, build command kosong)
2. **Environment Variables** — isi 5 ini:

   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | `https://xxxx.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` (service_role) |
   | `TELEGRAM_BOT_TOKEN` | `123456:AAxx...` |
   | `TELEGRAM_CHAT_ID` | `-100xxxxxxxxxx` |
   | `NODE_ENV` | `production` |
3. **Deploy** → setelah jadi, buka app → footer harus nunjukin `MODE: SUPABASE+TELEGRAM`.

### Batasan Vercel yang perlu lu tahu
- **Upload foto: max 4,5MB/request** (limit serverless Vercel). Capture kamera kita ~1–3MB (JPEG q0.92, 1080×1440) jadi aman; tapi upload file gede dari galeri bisa kena — di HP umumnya tetap lolos karena di-render ulang ke JPEG kita.
- **Timeout 10 detik (Hobby) / 60 detik (Pro)** — ZIP berisi ratusan foto dari Telegram bisa kepotong di Hobby. Kalau event lu gede: upgrade Pro, atau pindah ke Railway/VPS (tanpa limit).
- Demo mode **jalan tapi tidak persist** di Vercel (fs ephemeral) → production wajib env Supabase+Telegram.

## D. Alternatif tanpa limit: Railway / VPS

```bash
npm install
# isi .env (lihat .env.example)
npm start   # PORT=3000
```
Taruh di balik Caddy/Nginx buat HTTPS (kamera butuh HTTPS). Semua limit Vercel hilang.

---

## Verifikasi cepat setelah deploy
1. Daftar akun → bikin event → muncul QR
2. Buka link tamu **dari HP** → izinkan kamera → jepret 1×
3. Di Supabase Table Editor: `rt_photos` ada 1 row, `storage_key` = file_id Telegram
4. Di channel Telegram: foto muncul sebagai dokumen
5. Set `reveal` → galeri kebuka → ZIP ke-download
