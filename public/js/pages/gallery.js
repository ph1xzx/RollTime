import { initI18n, t } from '../i18n.js';
import { mountNav, api, guestSess, startCountdown } from '../shared.js';
import { EFFECTS } from '../fx.js';

mountNav({ ctaHref: '/create', ctaKey: 'nav.cta' });
initI18n();

const code = location.pathname.split('/')[2];
const $ = s => document.querySelector(s);
const sess = guestSess.get(code);

/* akses: tamu (guest token) atau owner; kalau bukan keduanya → suruh join dulu */
const initial = {};
try {
  const evRes = await api.req(`/api/events/${code}`);
  initial.ev = evRes.event;
  initial.owner = !!evRes.event.owner;
} catch (e) { location.href = '/'; }

const ev = initial.ev;
document.title = `ROLLTIME — ${ev.name}`;
$('#galTitle').textContent = ev.name;
$('#galMeta').textContent = `${ev.code} · ${ev.counts.guests} tamu · reveal ${new Date(ev.reveal_at).toLocaleString('id-ID')}`;
$('#camLink').href = sess ? `/e/${code}/cam` : `/e/${code}`;
if (!sess && !initial.owner) { location.href = `/e/${code}`; }

const zipUrl = `/api/events/${code}/zip`;
let allPhotos = [];
let revealed = false;
let cdStarted = false;

async function load() {
  const headers = sess ? { guestToken: sess.token } : {};
  let data;
  try {
    data = await api.req(`/api/events/${code}/photos`, headers);
  } catch (e) {
    if (!sess) { location.href = `/e/${code}`; return; }
    throw e;
  }
  revealed = data.revealed;
  if (!revealed) {
    $('#preReveal').classList.remove('hidden');
    $('#postReveal').classList.add('hidden');
    $('#soFar').textContent = data.total;
    const lockN = Math.min(Math.max(data.total, 4), 24);
    $('#lockGrid').innerHTML = Array.from({ length: lockN }, (_, i) =>
      `<div class="locked-cell">${String(i + 1).padStart(2, '0')}A</div>`).join('');
    if (!cdStarted) {
      cdStarted = true;
      startCountdown($('#cdownBig'), data.reveal_at, { onDone: () => { setTimeout(load, 1200); } });
    }
  } else {
    allPhotos = data.photos;
    $('#preReveal').classList.add('hidden');
    $('#postReveal').classList.remove('hidden');
    $('#zipBtn').classList.remove('hidden');
    renderGrid();
  }
}

function renderGrid(filterName = null) {
  const photos = filterName ? allPhotos.filter(p => p.guest_name === filterName) : allPhotos;
  $('#photoCount').textContent = `${photos.length} / ${allPhotos.length} foto`;
  $('#galEmpty').classList.toggle('hidden', photos.length > 0);
  $('#galGrid').innerHTML = photos.map((p, i) => {
    const fx = EFFECTS.find(f => f.id === p.filter_id) || EFFECTS[1];
    return `<div class="ph">
      <img src="${p.url}" alt="" loading="lazy" data-idx="${i}">
      <span class="who">${String(i + 4).padStart(2, '0')}A · ${p.guest_name || '—'} · ${t('fx.' + fx.key)}</span>
    </div>`;
  }).join('');
  $('#galGrid').querySelectorAll('img').forEach(img => {
    img.onclick = () => openLb(photos[+img.dataset.idx]);
  });

  /* filter dropdown */
  const names = [...new Set(allPhotos.map(p => p.guest_name))];
  const sel = $('#guestFilter');
  sel.innerHTML = `<option value="">${t('gl.filter.all')}</option>` +
    names.map(n => `<option ${n === filterName ? 'selected' : ''}>${n}</option>`).join('');
  sel.onchange = () => renderGrid(sel.value || null);
}

function openLb(p) {
  $('#lbImg').src = p.url;
  $('#lbMeta').textContent = `${p.guest_name} · ${new Date(p.created_at).toLocaleString('id-ID')}`;
  const dl = $('#lbDl');
  dl.href = p.url;
  dl.setAttribute('download', `rolltime-${p.id}.jpg`);
  $('#lightbox').classList.remove('hidden');
}
$('#lbClose').onclick = () => $('#lightbox').classList.add('hidden');
$('#lightbox').onclick = e => { if (e.target.id === 'lightbox') $('#lightbox').classList.add('hidden'); };

$('#zipBtn').onclick = async () => {
  /* zip butuh header auth → fetch manual dengan token lalu unduh blob */
  const headers = {};
  if (api.token) headers.Authorization = `Bearer ${api.token}`;
  if (sess) headers['x-guest-token'] = sess.token;
  const res = await fetch(zipUrl, { headers });
  if (!res.ok) return;
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `rolltime-${code}.zip`;
  a.click();
};

load();
/* auto-refresh tiap 20 detik buat pengalaman "reveal bareng" */
setInterval(load, 20000);
