# PRD — ROLLTIME 🎞️
> **Product Requirements Document** · v1.0 · Agustus 2026 · Status: **MVP LIVE (demo mode)**

---

## 1. Ringkasan Produk

**ROLLTIME adalah "kamera sekali pakai digital" untuk acara + photobooth web.**

Satu QR di tiap meja → tamu motret dari browser HP sendiri (tanpa install, tanpa daftar) → foto **tersembunyi selama acara** → semua foto **kebuka bareng-bareng** pas waktu "cuci film" (reveal). Ditambah **mode Photobooth** strip foto ala studio Korea yang lagi viral — instant, tanpa event.

- **Referensi konsep:** satualbum.id (event disposable camera)
- **Referensi design:** serotoninn.com (bone background, ink black, tipografi grotesque ALL-CAPS, grid border 2px, label `(FILM_04)`, marquee)
- **Backend:** Supabase (Auth + Postgres) · **Storage:** Telegram Bot API channel privat (gratis, unlimited, 50MB/file)
- **Bahasa:** ID default + toggle EN

## 2. Problem → Solusi

| Problem di acara | Solusi ROLLTIME |
|---|---|
| Momen candid tamu hilang di grup WA / nggak pernah terkumpul | Satu roll kolektif per acara, semua foto masuk 1 album |
| Fotografer cuma di titik utama | Setiap tamu = kamera, setiap sudut terliput |
| Photobooth fisik mahal & antre | Browser = photobooth, QR = tiket masuk |
| Foto langsung bocor, nggak ada momen "bareng-bareng" | Reveal serentak = sensasi cuci film |
| Tamu males install app / daftar akun | Scan QR → isi nama → langsung motret |

## 3. Tujuan & Metrik Sukses

| Tujuan | Metrik target |
|---|---|
| Adopsi event | ≥100 event terbuat di bulan 1 |
| Partisipasi tamu | ≥70% tamu yang join mengambil ≥1 foto |
| Retensi host | ≥30% host bikin event ke-2 |
| Photobooth viral | ≥500 strip ter-download di bulan 1 |
| Teknis | upload success ≥99%, first paint <2s di 4G |

## 4. Target User

1. **Host acara** (pengantin, EO, birthday celebrant, panitia gigs) — butuh dokumentasi candid massal tanpa ribet.
2. **Tamu** — umur 15–60, HP apa pun, zero-friction.
3. **Casual user / tongkrongan** — mau strip photobooth lucu buat sosmed, tanpa bikin event.

## 5. Scope

### In-scope (MVP — sudah jalan ✅)
- Auth email/password; dashboard multi-event
- Wizard create event: tipe, nama, link pendek custom, jadwal, **reveal mode** (instant / pas selesai / +2 jam), preset kamera, jatah foto per tamu
- QR code SVG print-ready + link tamu + manage page (stats live + daftar tamu)
- Kamera tamu fullscreen: **15 efek digicam WebGL real-time**, flip kamera, upload dari galeri, counter jatah, date-stamp oranye, nomor frame `04A`
- Reveal pipeline: galeri terkunci (countdown + placeholder) → terbuka serentak → filter per-tamu, lightbox, download ZIP
- Photobooth: strip 4/3-cut + grid 2×2, countdown 3-2-1, 5 frame (Y2K Star, Coquette, Mono Film, Kodak Sprocket, Midnight), unduh PNG
- Bilingual ID/EN
- Adapter backend: **demo mode lokal** ↔ **Supabase + Telegram** (env-driven, zero code change)

### Out-of-scope (v1)
- Pembayaran (Midtrans) & tier paket
- Google OAuth · cover undangan upload
- Guestbook / komentar per foto
- Moderasi/blur otomatis konten
- Native app (PWA dulu)

## 6. User Stories (prioritas)

| # | Story | Acceptance |
|---|---|---|
| US-1 | Sebagai host, gua bisa bikin event <2 menit | Wizard 4 langkah; event langsung punya QR+link |
| US-2 | Sebagai host, gua bisa atur jatah & kapan foto kebuka | `shots_per_guest` enforced di server; reveal sesuai pilihan |
| US-3 | Sebagai tamu, gua scan QR → motret tanpa akun | ≤3 tap dari QR ke jepretan pertama |
| US-4 | Sebagai tamu, jatah gua terbatas kayak roll beneran | Shot ke-N+1 → 403 `roll_empty` ✅ tested |
| US-5 | Sebagai semua orang, foto baru keliatan pas reveal | Pre-reveal API balikin metadata aja; file 403 ✅ tested |
| US-6 | Sebagai host, gua liat siapa motret apa | Tabel tamu + nama per foto pasca-reveal |
| US-7 | Sebagai siapa pun, gua bisa download semua foto | ZIP streaming dengan nama `001-nama.jpg` ✅ tested |
| US-8 | Sebagai casual user, gua bikin strip photobooth instant | Countdown → 4 frame → PNG terdownload |

## 7. Non-Functional Requirements

- **Perf:** efek kamera ≥30fps di HP mid-range (WebGL single-pass); upload ≤3s/foto 4G
- **Security:** service key hanya di server; session token http client-side; guest token random 18-byte; sanitasi input (nama 30 char, code slug)
- **Reliability:** demo mode tanpa dependensi eksternal; gagal upload → tombol muncul lagi, jatah tidak berkurang
- **Privacy:** foto milik event; pre-reveal benar-benar terkunci (no URL leak)
- **Compat:** iOS Safari 15+, Chrome Android/ desktop; HTTPS wajib (getUserMedia)
- **Biaya:** Rp0 infra — Telegram = storage, Supabase free tier = DB

---

# 8. PIPELINE

## 8.1 Pipeline Produk (state machine event)

```
 DRAFT          SCHEDULED           LIVE              ENDED            REVEALED
wizard 4 ─► event terbuat ─► tgl mulai tiba ─► ends_at lewat ─► reveal_at tiba
langkah      (QR siap print)   tamu bisa join      kamera tutup    semua foto
                               & motret            join baru 410    kebuka serentak
                                                                 (galeri + ZIP)
```
Status diturunkan di-server dari timestamp (`eventState()`), jadi nggak butuh cron.

## 8.2 Pipeline Host (pemilik acara)

```
Sign up/Login ─► Dashboard ─► Create Wizard (tipe▸nama▸efek▸jatah)
      │                              │
      │                              ▼
      │                     "Film kamu siap": QR SVG + /e/:code + custom link
      │                              │
      ▼                              ▼
 Manage page (stats 15 detik)   print QR / blast link WA
      │
      ▼
 Pasca-reveal: galeri + tamu list + ZIP ─► (opsional) hapus event
```

## 8.3 Pipeline Tamu (guest)

```
Scan QR ─► /e/:code (landing acara + countdown + info efek)
   │
   ▼
Isi nama ─► POST /join → guestToken disimpan di localStorage (device = kamera dia)
   │
   ▼
/e/:code/cam ─► getUserMedia ─► WebGL shader loop (15 efek, mirror-aware)
   │                capture full-res → overlay date-stamp + nomor frame
   │                ▼
   │         POST multipart /photos (+filter_id)
   │                │
   │     server validasi: event LIVE? jatah sisa? file ada?
   │                ▼
   │     jatah-- ─► counter update ─► jatah 0 → layar "Roll kamu habis"
   ▼
/e/:code/gallery ─► belum reveal: countdown + sel terkunci
                 ─► pas reveal: grid + filter tamu + lightbox + ZIP
                 (auto-refresh 20s = pengalaman "kebuka bareng")
```

## 8.4 Pipeline Data Foto (byte-level)

```
[HP tamu]  JPEG (full-res + stamp)                  content-type: multipart
    │  POST /api/events/:code/photos  (x-guest-token)
    ▼
[Express]  multer (RAM, ≤20MB) ─► validasi event/jatah
    │
    ├─ DEMO MODE ───────────────► fs → data/uploads/<rand>.jpg
    └─ TELEGRAM MODE ─► FormData ─► POST api.telegram.org/bot/sendDocument
                                       (chat_id = channel privat)
                                       ▼ balikan { file_id }
    ▼
[Supabase] INSERT rt_photos(event_id, guest_id, storage_key=<file_id>, filter_id, size)
    ▼
UPDATE rt_guests.shots_used += 1 ─► response {photo_id, shots_used}

── saat galeri render ──
GET /api/photo/:id ─► lookup row ─► cek revealed? ─► getFile(file_id)
   ─► fetch file/bot/<token>/<path> ─► STREAM ke browser (Cache-Control 24h)

── saat download ZIP ──
GET /events/:code/zip ─► loop foto ─► stream tiap file ─► archiver ─► zip streaming
```

Kenapa Telegram: storage foto **gratis tanpa kuota**, binary aman di CDN Telegram, Supabase cuma nyimpen pointer (hemat + ringan). Server kita = satu-satunya yang pegang token bot (privasi aman).

## 8.5 Pipeline Render Kamera (WebGL)

```
<video> getUserMedia 1080p+
   │ rAF loop
   ▼  texture upload (texImage2D)
GPU fragment shader ── urutan op:
  1. mirror flip (front cam)
  2. color grade per efek (tint / s-curve / saturation / split-tone)
  3. halation bloom 4-tap (CineStill, Mju, Y2K)
  4. vignette radial
  5. film grain (noise hash × bayangan)      ─► preview 30–60fps
capture: render sekali @full-res ─► 2D overlay (date-stamp #FF8C2E + frame)
   ─► canvas.toBlob(JPEG 0.92) ─► upload
```

## 8.6 Pipeline Backend Dua-Mode (adapter)

```
process.env check ─► SUPABASE_URL + SERVICE_KEY ada? ── ya ─► SupaDB (PostgREST/GoTrue)
                              │                          no ─► LocalDB (data/db.json)
                    TELEGRAM_BOT_TOKEN + CHAT_ID ada? ── ya ─► TelegramStorage
                              │                          no ─► LocalStorage (data/uploads)
Interface identik → server.js & routes TIDAK berubah. Footer nunjukin mode aktif.
```

## 8.7 Pipeline Dev → Deploy

```
local dev (npm start, demo mode)
   │ git push
   ▼
CI ringan: node --check semua file • API smoke test (script curl)
   │
   ▼
Host: Railway / VPS + Node 20 ── HTTPS wajib (kamera) ── env 4 variabel
   │
   ▼
Observability v1: console log + /api/config mode badge
```

## 9. Roadmap

| Fase | Isi | Status |
|---|---|---|
| **P1 — MVP** | Semua di scope §5 in-scope | ✅ LIVE |
| **P2 — Monet & Growth** | Midtrans (tier tamu), cover undangan upload, custom domain per event, share OG image strip | next |
| **P3 — Engagement** | Reaksi ❤ per foto, guestbook, galeri publik opsional, PWA installable + push notif reveal | backlog |
| **P4 — Scale** | WebSocket reveal real-time, CDN di depan /api/photo, moderasi konten, multi-bahasa tambahan | backlog |

## 10. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Bot Telegram ke-rate-limit pas rame upload | upload lambat | queue + retry di adapter; cache file agresif |
| HP tua nggak kuat WebGL | efek gagal | fallback 2D canvas (sudah ada di `renderOnce`) |
| Izin kamera ditolak | tamu stuck | flow upload-dari-galeri sebagai jalur B (sudah ada) |
| Konten nggak pantas | reputasi | P3: laporkan & hapus per-foto oleh owner |
| Node_modules hilang saat restore sandbox | server mati | `npm install && npm start` (README ritual) |
