/** Vercel serverless entry — satu function nanganin SEMUA route (API + halaman + static).
 *  Catatan Vercel: body limit 4.5MB/request & timeout 10s (Hobby) / 60s (Pro).
 *  Untuk production di Vercel WAJIB isi env Supabase + Telegram —
 *  demo mode jalan tapi data tidak persist (filesystem serverless ephemeral). */
process.env.VERCEL = '1';
const { app } = require('../server/app');

module.exports = (req, res) => {
  // hedge kalau rewrite mengubah path menjadi /api
  if (req.url === '/api' || req.url === '/api/') req.url = '/';
  app(req, res);
};
