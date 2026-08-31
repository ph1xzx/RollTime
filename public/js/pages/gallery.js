import { initI18n, t } from '../i18n.js';
import { mountNav, api, guestSess, startCountdown, toast } from '../shared.js';
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
    loadTop();
  }
}

let sortMode = 'new';
let filterName = null;

function sorted(photos) {
  const arr = [...photos];
  if (sortMode === 'top') arr.sort((a, b) => (b.loves || 0) - (a.loves || 0));
  return arr;
}

function renderGrid() {
  let photos = filterName ? allPhotos.filter(p => p.guest_name === filterName) : allPhotos;
  photos = sorted(photos);
  $('#photoCount').textContent = `${photos.length} / ${allPhotos.length} foto`;
  $('#galEmpty').classList.toggle('hidden', photos.length > 0);
  $('#galGrid').innerHTML = photos.map((p, i) => {
    const fx = EFFECTS.find(f => f.id === p.filter_id) || EFFECTS[1];
    return `<div class="ph">
      <img src="${p.url}" alt="" loading="lazy" data-idx="${i}">
      <button class="love-btn ${p.loved_me ? 'loved' : ''}" data-love="${p.id}">❤ ${p.loves || 0}</button>
      <span class="who">${String(i + 4).padStart(2, '0')}A · ${p.guest_name || '—'} · ${t('fx.' + fx.key)}</span>
    </div>`;
  }).join('');
  $('#galGrid').querySelectorAll('img').forEach(img => {
    img.onclick = () => openLb(photos[+img.dataset.idx]);
  });
  $('#galGrid').querySelectorAll('[data-love]').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.love;
      btn.textContent = '…';
      try {
        const r = await api.req(`/api/events/${code}/react`, { method: 'POST', body: { photo_id: id }, guestToken: sess ? sess.token : null });
        const p = allPhotos.find(x => x.id === id);
        if (p) { p.loves = r.count; p.loved_me = r.loved; }
        renderGrid();
      } catch (e) {
        toast(t('gl.love.fail'));
        const p = allPhotos.find(x => x.id === id);
        btn.textContent = '❤ ' + (p ? p.loves || 0 : 0);
      }
    };
  });

  /* sort select */
  const sortSel = $('#sortSel');
  sortSel.innerHTML = `<option value="new" ${sortMode === 'new' ? 'selected' : ''}>${t('gl.sort.new')}</option>
    <option value="top" ${sortMode === 'top' ? 'selected' : ''}>${t('gl.sort.top')}</option>`;
  sortSel.onchange = () => { sortMode = sortSel.value; renderGrid(); };

  /* filter dropdown */
  const names = [...new Set(allPhotos.map(p => p.guest_name))];
  const sel = $('#guestFilter');
  sel.innerHTML = `<option value="">${t('gl.filter.all')}</option>` +
    names.map(n => `<option ${n === filterName ? 'selected' : ''}>${n}</option>`).join('');
  sel.onchange = () => { filterName = sel.value || null; renderGrid(); };
}

/* leaderboard strip "Paling dicintai" */
async function loadTop() {
  try {
    const { top } = await api.req(`/api/events/${code}/leaderboard`, sess ? { guestToken: sess.token } : {});
    const has = Array.isArray(top) && top.length > 0;
    $('#topWrap').classList.toggle('hidden', !has);
    if (!has) return;
    $('#topStrip').innerHTML = top.map((p, i) => `
      <div class="top-card">
        <span class="rank">#${i + 1}</span>
        <img src="${p.url}" data-idx="${i}" alt="">
        <div class="tmeta"><span>${p.guest_name || '—'}</span><span class="lv">❤ ${p.loves}</span></div>
      </div>`).join('');
    $('#topStrip').querySelectorAll('img').forEach(img => { img.onclick = () => openLb(top[+img.dataset.idx]); });
  } catch (e) { /* diamkan */ }
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
