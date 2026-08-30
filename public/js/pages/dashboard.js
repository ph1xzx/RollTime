import { initI18n, t } from '../i18n.js';
import { mountNav, mountFooter, api } from '../shared.js';

mountNav({ ctaHref: '/create', ctaKey: 'db.new' });
mountFooter();
initI18n();

if (!api.token) location.href = '/auth?next=/app';

const $ = s => document.querySelector(s);
let me = null;
try { me = (await api.req('/api/me')).user; }
catch (e) { api.setToken(null); location.href = '/auth?next=/app'; }
document.getElementById('helloLine').textContent = `${t('db.hey')} ${me.name}`;

function evBadge(ev) {
  if (ev.revealed) return `<span class="badge open">REVEALED</span>`;
  if (ev.active) return `<span class="badge live" data-i18n="mg.live">LIVE</span>`;
  if (ev.ended) return `<span class="badge" data-i18n="mg.done"></span>`;
  return `<span class="badge" data-i18n="mg.wait"></span>`;
}

async function load() {
  let { events } = await api.req('/api/events');
  const list = $('#evList');
  $('#emptyState').classList.toggle('hidden', events.length > 0);
  list.classList.toggle('hidden', events.length === 0);
  list.innerHTML = events.map(ev => `
    <div class="ev-row">
      <div>
        <div class="nm">${ev.name}</div>
        <div class="meta">${ev.code} · ${ev.counts.guests} ${t('db.guests')} · ${ev.counts.photos} ${t('db.photos')}</div>
      </div>
      ${evBadge(ev)}
      <a class="badge" href="/e/${ev.code}">/e/${ev.code}</a>
      <a class="btn" style="padding:10px 18px" href="/e/${ev.code}/manage">${t('db.open')}</a>
    </div>`).join('');
}
load();
