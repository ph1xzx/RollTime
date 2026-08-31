import { initI18n, t } from '../i18n.js';
import { mountNav, api, toast } from '../shared.js';

mountNav({ ctaHref: '/app', ctaKey: 'nav.dash' });
initI18n();

const code = location.pathname.split('/')[2];
const $ = s => document.querySelector(s);

let ev = null;
try {
  const res = await api.req(`/api/events/${code}`);
  if (!res.event.owner) { location.href = '/app'; }
  ev = res.event;
} catch (e) { location.href = '/app'; }

const guestUrl = `${location.origin}/e/${ev.code}`;
$('#evName').textContent = ev.name;
const fxN = (Array.isArray(ev.filter_ids) && ev.filter_ids.length) ? ev.filter_ids.length : 1;
$('#evMeta').textContent = `${ev.type} · ${ev.shots_per_guest} shots/guest · ${fxN > 1 ? fxN + ' efek' : 'fx#' + ev.filter_id} · ${new URLSearchParams(location.search).has('fresh') ? '★ baru aja dibuat' : ''}`;
$('#qrImg').src = `/api/qr.svg?text=${encodeURIComponent(guestUrl)}`;
$('#qrCode').textContent = `/e/${ev.code}`;
$('#linkInput').value = guestUrl;
$('#guestLink').href = guestUrl;
$('#guestLink').textContent = `/e/${ev.code} ↗`;
$('#galleryBtn').href = `/e/${ev.code}/gallery`;
$('#galleryBtn').textContent = 'Album →';
$('#liveBtn').href = `/e/${ev.code}/live`;
$('#revealAt').textContent = new Date(ev.reveal_at).toLocaleString(document.documentElement.lang === 'en' ? 'en-US' : 'id-ID');

$('#copyBtn').onclick = async () => {
  await navigator.clipboard.writeText(guestUrl).catch(() => {});
  toast(t('toast.copied'));
};
$('#dlQr').onclick = async () => {
  const svg = await fetch(`/api/qr.svg?text=${encodeURIComponent(guestUrl)}`).then(r => r.text());
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `rolltime-${ev.code}-qr.svg`;
  a.click();
};
$('#deleteBtn').onclick = async () => {
  if (!confirm(t('db.del.confirm'))) return;
  await api.req(`/api/events/${ev.code}`, { method: 'DELETE' });
  toast(t('toast.deleted'));
  location.href = '/app';
};

async function loadStats() {
  const { event } = await api.req(`/api/events/${code}`);
  ev = event;
  $('#stGuests').textContent = ev.counts.guests;
  $('#stPhotos').textContent = ev.counts.photos;
  $('#stLeft').textContent = ev.counts.guests * ev.shots_per_guest - ev.counts.photos;
  const { guests } = await api.req(`/api/events/${code}/guests`);
  $('#guestList').innerHTML = guests.length
    ? guests.map(g => `<div class="ev-row" style="grid-template-columns:1fr auto auto">
        <div class="nm" style="font-size:14px">${g.name}</div>
        <span class="tag-mono">${g.shots_used}/${ev.shots_per_guest} shots</span>
        <span class="tag-mono" style="opacity:.5">${new Date(g.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</span>
      </div>`).join('')
    : `<div class="empty" style="padding:26px">— belum ada tamu join —</div>`;
}
$('#refreshBtn').onclick = loadStats;
loadStats();
setInterval(loadStats, 15000);

$('#load').classList.add('hidden');
$('#content').classList.remove('hidden');
