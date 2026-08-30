/** ROLLTIME — standalone server (local / VPS / Railway). Untuk Vercel: lihat api/index.js */
const { app, db, storage } = require('./app');

const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ROLLTIME jalan di http://0.0.0.0:${PORT}  [db=${db.mode} storage=${storage.mode}]`);
});
