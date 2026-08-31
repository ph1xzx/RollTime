/** landing page */
import { initI18n, t } from '../i18n.js';
import { mountNav, mountFooter, refreshNavAuth } from '../shared.js';
import { EFFECTS } from '../fx.js';

mountNav();
mountFooter();
initI18n();
refreshNavAuth();

/* hero strip — foto AI dengan nomor frame film */
const imgs = [
  ['hero-1', 'wedding — emma & noah'],
  ['sample-4', 'sparkler send-off'],
  ['hero-2', 'bday — sarah 25th'],
  ['sample-3', 'dance floor 02:13'],
  ['hero-3', 'gigs — pestapora'],
  ['sample-5', 'group hug » final slide'],
];
const strip = document.getElementById('heroStrip');
strip.innerHTML = imgs.map(([f, cap], i) => `
  <figure class="tile">
    <img src="/assets/img/${f}.png" alt="${cap}" loading="lazy">
    <span class="frame">${String(i + 4).padStart(2, '0')}A</span>
    <figcaption class="cap">${cap}</figcaption>
  </figure>`).join('') + `
  <figure class="tile" style="display:grid;place-items:center;background:var(--bone)">
    <div style="text-align:center">
      <div style="font-size:52px;font-weight:900" data-i18n="strip.end">fin</div>
      <div class="tag-mono" data-i18n="strip.eor"></div>
    </div>
  </figure>`;

/* marquee x2 biar seamless */
const mq = document.getElementById('mqTrack');
const items = ['mq.1','mq.2','mq.3','mq.4','mq.5'];
const oneSet = items.map(k => `<span><i>+</i>${t(k)}</span>`).join('');
function renderMq(){
  const set = items.map(k => `<span><i>+</i>${t(k)}</span>`).join('');
  mq.innerHTML = set + set;
}
renderMq();
document.querySelectorAll('[data-lang-btn]').forEach(b => b.addEventListener('click', () => setTimeout(renderMq, 0)));

/* fx grid 15 efek */
const grid = document.getElementById('fxGrid');
function renderFx(){
  grid.innerHTML = EFFECTS.map(fx => `
    <div class="fx-cell">
      <span class="idx">FILM_${String(fx.id).padStart(2, '0')}</span>
      <span class="chip" style="background:${fx.chip}"></span>
      <span class="nm">${t('fx.' + fx.key)}</span>
      <span class="ds">${t('fxd.' + fx.key)}</span>
    </div>`).join('');
}
renderFx();
document.querySelectorAll('[data-lang-btn]').forEach(b => b.addEventListener('click', () => setTimeout(renderFx, 0)));

/* premium motion (GSAP via CDN; offline → skip, konten tetap tampil) */
import('../anim.js').then(m => m.initLanding()).catch(() => {});
