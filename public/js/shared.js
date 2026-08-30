/** ROLLTIME shared.js — API client, sesi, komponen UI umum (nav, toast, countdown). */
import { t, getLang } from './i18n.js';

export const api = {
  token: localStorage.getItem('rt_token') || null,
  setToken(tok) {
    this.token = tok;
    if (tok) localStorage.setItem('rt_token', tok);
    else localStorage.removeItem('rt_token');
  },
  async req(path, { method = 'GET', body, form, guestToken } = {}) {
    const headers = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (guestToken) headers['x-guest-token'] = guestToken;
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(path, {
      method, headers,
      body: form ? form : (body ? JSON.stringify(body) : undefined),
    });
    let j = {};
    try { j = await res.json(); } catch (e) { /* zip dsb. */ }
    if (!res.ok) { const err = new Error(j.error || 'request_failed'); err.data = j; err.status = res.status; throw err; }
    return j;
  },
};

/* ---- guest session per event ---- */
export const guestSess = {
  key: code => `rt_guest_${code}`,
  get(code) { try { return JSON.parse(localStorage.getItem(this.key(code)) || 'null'); } catch (e) { return null; } },
  set(code, data) { localStorage.setItem(this.key(code), JSON.stringify(data)); },
};

/* ---- toast ---- */
let toastEl = null, toastTimer = null;
export function toast(msg) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

/* ---- nav injection (biar konsisten di semua page) ---- */
export function mountNav({ active = '', authState = null, ctaHref = '/auth', ctaKey = 'nav.cta' } = {}) {
  const nav = document.createElement('div');
  nav.className = 'nav';
  nav.innerHTML = `
    <a class="brand" href="/"><span class="dot"></span>Rolltime</a>
    <div class="links">
      <a href="/#how" data-i18n="nav.how"></a>
      <a href="/#fx" data-i18n="nav.fx"></a>
      <a href="/booth" data-i18n="nav.booth"></a>
      <a href="/#price" data-i18n="nav.price"></a>
    </div>
    <div class="right">
      <span class="lang" role="button" tabindex="0">
        <b data-lang-btn="id">ID</b>/<b data-lang-btn="en">EN</b>
      </span>
      <a class="cta" href="${ctaHref}" data-i18n="${ctaKey}"></a>
    </div>`;
  document.body.prepend(nav);
  return nav;
}
export async function refreshNavAuth() {
  const cta = document.querySelector('.nav .cta');
  if (!cta) return;
  if (api.token) {
    try {
      const { user } = await api.req('/api/me');
      cta.href = '/app';
      cta.textContent = user.name.split(' ')[0].toUpperCase() + ' →';
      cta.removeAttribute('data-i18n');
      return;
    } catch (e) { api.setToken(null); }
  }
  cta.href = '/auth';
  cta.setAttribute('data-i18n', 'nav.cta');
  cta.textContent = t('nav.cta');
}

/* ---- footer injection ---- */
export function mountFooter() {
  const f = document.createElement('footer');
  f.innerHTML = `
    <div class="foot-big"><span data-i18n="foot.big"></span><span style="color:var(--orange)">.</span></div>
    <div class="foot-row">
      <span data-i18n="foot.line"></span>
      <span><span data-i18n="foot.mode"></span>: <span class="mode-badge" id="modeBadge">—</span></span>
      <span data-i18n="foot.made"></span>
    </div>`;
  document.body.appendChild(f);
  api.req('/api/config').then(({ dbMode, storageMode }) => {
    const b = f.querySelector('#modeBadge');
    if (b) b.textContent = dbMode === 'local' ? 'DEMO' : `${dbMode}+${storageMode}`.toUpperCase();
  }).catch(() => {});
  return f;
}

/* ---- countdown helper ---- */
export function startCountdown(el, targetIso, { onDone, format } = {}) {
  const target = new Date(targetIso).getTime();
  function tick() {
    let diff = target - Date.now();
    if (diff <= 0) { if (onDone) onDone(); return; }
    const s = Math.floor(diff / 1000);
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (format) el.innerHTML = format({ d, h, m, sec });
    else el.textContent = `${String(d).padStart(2,'0')}:${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    requestAnimationFrame(() => setTimeout(tick, 250));
  }
  tick();
}

export const lang = () => getLang();
export { t };
