import { initI18n, t } from '../i18n.js';
import { mountNav, api, guestSess, toast } from '../shared.js';
import { EFFECTS } from '../fx.js';

mountNav({ ctaHref: '/create', ctaKey: 'nav.cta' });
initI18n();

const code = location.pathname.split('/')[2];
const $ = s => document.querySelector(s);

let ev = null;
try { ev = (await api.req(`/api/events/${code}`)).event; }
catch (e) { document.body.innerHTML = `<div class="pane"><h1>${t('jn.notfound')}</h1></div>`; throw e; }

$('#evTitle').textContent = ev.name;
$('#joinCap').innerHTML = ev.name + `<br><span style="font-size:.45em;opacity:.85">BY ROLLTIME FILM_${String(ev.filter_id).padStart(2,'0')}</span>`;
document.title = `ROLLTIME — ${ev.name}`;

const heroImgs = ['hero-1','hero-2','hero-3','sample-3','sample-4'];
$('#joinImg').src = `/assets/img/${heroImgs[ev.name.length % heroImgs.length]}.png`;

const fx = EFFECTS.find(f => f.id === ev.filter_id) || EFFECTS[1];
$('#metaChips').innerHTML = `
  <span class="info-chip">${t('jn.shots')}: <b>${ev.shots_per_guest}</b></span>
  <span class="info-chip">${t('jn.fx')}: <b>${t('fx.' + fx.key)}</b></span>
  <span class="info-chip">${t('jn.ends')}: <b>${new Date(ev.ends_at).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</b></span>`;

/* kalau guest udah pernah join di device ini → langsung lanjut */
const saved = guestSess.get(code);
if (saved && saved.token) {
  $('#guestName').value = saved.name || '';
  if (!ev.ended) $('#joinBtn').innerHTML = `${t('jn.cta')} (${saved.name})`;
}

if (ev.ended) {
  $('#joinArea').classList.add('hidden');
  $('#endedArea').classList.remove('hidden');
  $('#endedGalBtn').href = `/e/${code}/gallery`;
}

$('#joinBtn').onclick = async () => {
  const name = $('#guestName').value.trim();
  if (!name) { $('#joinErr').textContent = t('jn.join.err'); $('#joinErr').classList.remove('hidden'); return; }
  $('#joinErr').classList.add('hidden');
  $('#joinBtn').disabled = true;
  try {
    let sess = guestSess.get(code);
    if (!(sess && sess.token && sess.name === name)) {
      const res = await api.req(`/api/events/${code}/join`, { method: 'POST', body: { name } });
      sess = { token: res.guestToken, name };
      guestSess.set(code, sess);
    }
    location.href = `/e/${code}/cam`;
  } catch (e) {
    toast(e.message === 'event_ended' ? t('jn.ended') : 'Error');
    $('#joinBtn').disabled = false;
  }
};
$('#guestName').addEventListener('keydown', e => { if (e.key === 'Enter') $('#joinBtn').click(); });
