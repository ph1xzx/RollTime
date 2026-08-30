import { initI18n, t } from '../i18n.js';
import { mountNav, api, toast } from '../shared.js';
import { EFFECTS } from '../fx.js';

mountNav({ ctaHref: '/app', ctaKey: 'nav.dash' });
initI18n();

/* harus login */
if (!api.token) { location.href = '/auth?next=' + encodeURIComponent('/create'); }
else { try { await api.req('/api/me'); } catch (e) { api.setToken(null); location.href = '/auth?next=/create'; } }

const $ = s => document.querySelector(s);
const state = { type: 'party', filter_id: 1, shots: 10 };
let step = 0;

/* tipe acara */
const TYPES = ['wed', 'bday', 'party', 'concert', 'travel', 'other'];
function renderTypes() {
  $('#typeGrid').innerHTML = TYPES.map(tp => `
    <div class="type-card ${state.type === tp ? 'on' : ''}" data-type="${tp}">
      ${t('cr.type.' + tp)}<small>${t('cr.typed.' + tp)}</small>
    </div>`).join('');
  document.querySelectorAll('.type-card').forEach(c => c.onclick = () => {
    state.type = c.dataset.type; renderTypes();
  });
}

/* efek pick */
function renderFxPick() {
  $('#fxRow').innerHTML = EFFECTS.map(f => `
    <div class="fx-pick ${state.filter_id === f.id ? 'on' : ''}" data-fx="${f.id}">
      <span class="sw" style="background:${f.chip}"></span>${t('fx.' + f.key)}
    </div>`).join('');
  document.querySelectorAll('.fx-pick').forEach(p => p.onclick = () => {
    state.filter_id = +p.dataset.fx; renderFxPick();
  });
}

/* steps */
function renderSteps() {
  $('#stepsBar').innerHTML = ['cr.s0','cr.s1','cr.s2','cr.s3']
    .map((k, i) => `<div class="${i === step ? 'on' : ''}">${t(k)}</div>`).join('');
  document.querySelectorAll('.step').forEach(s => s.classList.toggle('on', +s.dataset.step === step));
  renderTypes(); renderFxPick();
}
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
  const next = +b.dataset.go;
  if (next === 2 && !$('#fName').value.trim()) { wizErr('Nama acara wajib diisi.'); return; }
  wizErr(null);
  step = next; renderSteps();
});

function wizErr(msg) {
  const e = $('#wizErr');
  if (!msg) { e.classList.add('hidden'); return; }
  e.textContent = msg; e.classList.remove('hidden');
}

/* defaults datetime: mulai = sekarang (dibulatkan), selesai = +5 jam */
function toLocalInput(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const now = new Date();
const start = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
const end = new Date(start.getTime() + 5 * 3600e3);
$('#fStart').value = toLocalInput(start);
$('#fEnd').value = toLocalInput(end);
$('#fCode').addEventListener('input', () => { $('#codePrev').textContent = $('#fCode').value || 'xxxxx'; });

/* stepper jatah */
$('#shotMinus').onclick = () => { state.shots = Math.max(1, state.shots - 1); $('#shotVal').textContent = state.shots; };
$('#shotPlus').onclick = () => { state.shots = Math.min(99, state.shots + 1); $('#shotVal').textContent = state.shots; };

/* create */
$('#btnCreate').onclick = async () => {
  $('#btnCreate').disabled = true;
  try {
    const rv = $('#fReveal').value;
    const endsAt = new Date($('#fEnd').value);
    let reveal_mode = 'custom', reveal_at;
    if (rv === 'instant') { reveal_mode = 'instant'; }
    else if (rv === 'end') { reveal_at = endsAt; }
    else { reveal_at = new Date(endsAt.getTime() + 2 * 3600e3); }
    const { event } = await api.req('/api/events', {
      method: 'POST',
      body: {
        name: $('#fName').value.trim(),
        code: $('#fCode').value.trim() || undefined,
        type: state.type,
        starts_at: new Date($('#fStart').value).toISOString(),
        ends_at: endsAt.toISOString(),
        reveal_mode, reveal_at: reveal_at ? reveal_at.toISOString() : undefined,
        filter_id: state.filter_id,
        shots_per_guest: state.shots,
      },
    });
    location.href = `/e/${event.code}/manage?fresh=1`;
  } catch (e) {
    wizErr(e.message === 'code_taken' ? t('cr.err.code') : t('cr.err.generic'));
    $('#btnCreate').disabled = false;
  }
};

/* re-render text yang bergantung bahasa */
document.querySelectorAll('[data-lang-btn]').forEach(b => b.addEventListener('click', () => setTimeout(() => { renderSteps(); }, 0)));
renderSteps();
