# ROLLTIME 🎞️

**Kamera sekali pakai digital untuk acara + Photobooth strip viral** — konsep ala satualbum.id, design ala serotoninn.com, backend Supabase + storage Telegram (atau mode demo lokal).

## Fitur

- **Event "roll film"** — host bikin acara, tamu scan QR → motret dari browser (no install, no signup)
- **15 efek kamera digital/digicam** (WebGL shader, real-time): Original, Kodak FunSaver, Fuji QuickSnap, Portra 400, Ektar 100, Ilford HP5+, CineStill 800T, Canon Ixus, Sony Cyber-shot, Nikon Coolpix, Kodak EasyShare, Fuji FinePix, Olympus Mju, Y2K Flash, Polaroid 600
- **Jatah foto terbatas per tamu** + **reveal bareng-bareng** (foto tersembunyi sampai waktu cuci)
- **Photobooth mode** (`/booth`) — strip 4-cut / 3-cut / grid 2×2, countdown otomatis, 5 frame viral (Y2K Star, Coquette, Mono Film, Kodak Sprocket, Midnight), unduh PNG instan
- **QR generator + print-ready**, galeri per-tamu, download ZIP
- **Bilingual** ID/EN toggle
- Date-stamp oranye + nomor frame (`04A`) di setiap jepretan

## Jalanin lokal

```bash
npm install
npm start        # http://localhost:3000
```

Tanpa `.env` → **DEMO MODE** (database JSON di `data/db.json`, foto di `data/uploads/`). Langsung fungsional penuh.

## Switch ke production (Supabase + Telegram)

1. Bikin project Supabase → jalankan isi **`schema.sql`** di SQL Editor
2. Bikin bot via @BotFather, buat **channel privat**, jadikan bot admin. Ambil chat id (`-100...`)
3. Salin `.env.example` → `.env`, isi 4 variabelnya:

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...      # service_role (server-only, JANGAN expose)
TELEGRAM_BOT_TOKEN=123456:AAxx...
TELEGRAM_CHAT_ID=-100xxxxxxxxxx
```

Restart → log akan bilang `[db=supabase storage=telegram]`.

### Cara kerja storage Telegram

```
tamu jepret → POST /api/events/:code/photos (multipart)
  → server kirim file ke channel privat via Bot API sendDocument
  → Telegram balikin file_id → disimpan di Supabase (rt_photos.storage_key)
browser minta foto → GET /api/photo/:id
  → server: getFile(file_id) → download binary → stream ke browser (cache 24 jam)
```

Gratis, unlimited kuota, file sampai 50MB/foto. Semua otorisasi di layer server (service key bypass RLS).

## Struktur

```
server/server.js   Express: API + routing halaman
server/db.js       Adapter DB: local JSON ↔ Supabase REST (PostgREST + GoTrue)
server/storage.js  Adapter storage: local disk ↔ Telegram Bot API
public/            Frontend murni: HTML + ES modules + CSS (no build step)
  js/fx.js         15 shader WebGL efek kamera
  js/cam.js        Engine kamera (getUserMedia → capture full-res + stamp)
  js/pages/*.js    Landing, auth, create, dashboard, manage, join, camera, gallery, booth
schema.sql         Skema tabel Supabase
```

## Catatan deploy

- Wajib HTTPS biar `getUserMedia` (kamera) jalan — Vercel/Railway/VPS + reverse proxy otomatis aman
- Upload limit 20MB/foto; di Telegram mode batas aslinya 50MB (Bot sendDocument)
- Untuk skala rame: tambahin CDN/cache di depan `/api/photo/:id` biar bandwidth server hemat
