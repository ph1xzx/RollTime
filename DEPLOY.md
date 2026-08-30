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

## B. Telegram storage (±5 menit)

1. Chat [@BotFather](https://t.me/BotFather) → `/newbot` → ikuti → dapat **BOT TOKEN**
2. Bikin **channel PRIVAT** (misal `rolltime-storage`) → add bot jadi **admin** (centang Post Messages)
3. Ambil chat id:
   - Kirim pesan apa aja di channel itu
   - Buka `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Cari `"chat":{"id":-100xxxxxxxxxx` → itu CHAT_ID (minus-nya ikut)
4. Cara kerja: foto tamu → `sendDocument` ke channel → `file_id` disimpan di `rt_photos.storage_key`
   → galeri ambil balik via `getFile` + stream. Gratis, unlimited.

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
