/** Live TV wall — mosaic foto masuk real-time buat layar venue (khusus host/owner). */
import { initI18n, t } from '../i18n.js';
import { api } from '../shared.js';

initI18n();

const code = location.pathname.split('/')[2];
const $ = s => document.querySelector(s);

const guestUrl = `${location.origin}/e/${code}`;
$('#lvQr').src = `/api/qr.svg?text=${encodeURIComponent(guestUrl)}`;

/* footer marquee */
const track = $('#lvTrack');
const oneLine = `<span>SCAN → MOTRET → ROLLTIME</span><span>★</span><span>${guestUrl.replace(/^https?:\/\//,'')}</span><span>★</span>`;
track.innerHTML = oneLine.repeat(4);

/* jam */
function tickClock() {
  const d = new Date();
  $('#lvClock').textContent = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}
tickClock(); setInterval(tickClock, 1000);

let ev = null;
try {
  const res = await api.req(`/api/events/${code}`);
  ev = res.event;
  $('#lvName').textContent = ev.name.toUpperCase();
  document.title = `ROLLTIME LIVE — ${ev.name}`;
  if (!res.event.owner) { $('#lvNoHost').classList.remove('hidden'); throw new Error('not_owner'); }
} catch (e) {
  $('#lvNoHost').classList.remove('hidden');
  throw e;
}

const seen = new Set();
const CAP = 42;
let first = true;

async function poll() {
  try {
    const data = await api.req(`/api/events/${code}/photos`);   // pakai Bearer token host
    $('#lvCount').textContent = data.total;
    let added = false;
    // render dari yang TERBARU di kiri-atas
    const fresh = [...data.photos].reverse();
    for (const p of fresh) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      added = true;
      const tile = document.createElement('div');
      tile.className = 'lv-tile' + (first ? '' : ' new');
      tile.innerHTML = `<img src="${p.url}" alt=""><span class="who">${p.guest_name || ''}</span>`;
      $('#lvGrid').prepend(tile);
    }
    /* batasi jumlah tile di DOM */
    const tiles = $('#lvGrid').children;
    while (tiles.length > CAP) $('#lvGrid').removeChild(tiles[tiles.length - 1]);
    $('#lvWait').classList.toggle('hidden', data.total > 0);
    first = false;
  } catch (e) { /* network blip — coba lagi tick berikutnya */ }
}
poll();
setInterval(poll, 5000);
