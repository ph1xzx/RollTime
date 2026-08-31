/**
 * Premium motion layer (GSAP + ScrollTrigger via CDN).
 * Semua animasi "from" — kalau CDN gagal/offline, konten TETAP tampil normal.
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function ensureGsap() {
  if (window.gsap) return window.gsap;
  await loadScript('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js');
  await loadScript('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js');
  return window.gsap || null;
}

function st(gsap, target, fromVars, extra = {}) {
  gsap.from(target, { ...fromVars, scrollTrigger: { trigger: target, start: 'top 88%', ...extra } });
}

/** Animasi untuk landing page. */
export async function initLanding() {
  let gsap = null;
  try { gsap = await ensureGsap(); } catch (e) { return; }
  if (!gsap) return;
  if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

  /* hero: headline naik per baris + sub fade */
  gsap.from('.hero .headline .row', { yPercent: 70, opacity: 0, duration: 1.05, ease: 'power4.out', stagger: 0.13 });
  gsap.from('.hero .sub p, .hero-sub-meta > *', { y: 26, opacity: 0, duration: 0.8, delay: 0.4, stagger: 0.08, ease: 'power2.out' });
  gsap.from('.strip .tile', { xPercent: 26, opacity: 0, duration: 0.9, delay: 0.35, stagger: 0.07, ease: 'power3.out' });

  if (!window.ScrollTrigger) return;

  /* setiap judul seksi slide dari kiri */
  document.querySelectorAll('.section-head h2').forEach(h => {
    st(gsap, h, { x: -56, opacity: 0, duration: 0.75, ease: 'power3.out' });
  });
  /* sel grid cara kerja */
  document.querySelectorAll('.grid-3 > .cell').forEach((c, i) => {
    st(gsap, c, { y: 46, opacity: 0, duration: 0.75, delay: i * 0.07, ease: 'power2.out' });
  });
  /* grid efek masuk bertahap */
  st(gsap, '.fx-cell', { y: 26, opacity: 0, duration: 0.5, ease: 'power1.out' }, {
    trigger: '.fx-grid', start: 'top 86%',
    stagger: undefined,
  });
  gsap.utils.toArray('.fx-cell').forEach((cell, i) => {
    st(gsap, cell, { y: 22, opacity: 0, duration: 0.45, delay: (i % 5) * 0.04, ease: 'power1.out' }, { start: 'top 94%' });
  });
  /* booth preview cards goyang masuk */
  document.querySelectorAll('#boothsec [style*="rotate"]').forEach((card, i) => {
    st(gsap, card, { y: 60, rotation: i === 0 ? -14 : 14, opacity: 0, duration: 0.9, ease: 'back.out(1.6)' }, { start: 'top 92%' });
  });
  /* harga + checklist + faq */
  st(gsap, '.price-big', { scale: 0.92, opacity: 0, duration: 0.9, ease: 'power3.out' }, { start: 'top 88%' });
  st(gsap, '.checklist li', { x: -22, opacity: 0, duration: 0.4 }, { start: 'top 92%' });
  document.querySelectorAll('.checklist li').forEach((li, i) => {
    st(gsap, li, { x: -20, opacity: 0, duration: 0.35, delay: i * 0.05 }, { start: 'top 96%' });
  });
  document.querySelectorAll('.faq details').forEach((d, i) => {
    st(gsap, d, { y: 18, opacity: 0, duration: 0.4, delay: i * 0.04 }, { start: 'top 94%' });
  });
  /* footer wordmark naik */
  st(gsap, '.foot-big', { yPercent: 45, duration: 1.1, ease: 'power2.out' }, { start: 'top 98%' });

  /* parallax halus di hero strip */
  gsap.to('.strip', {
    xPercent: -4, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 },
  });
}

/** Animasi ringan buat halaman form (auth/create/join). */
export async function initFormPage(selector = '.auth-card, .wizard, .join-form > *') {
  let gsap = null;
  try { gsap = await ensureGsap(); } catch (e) { return; }
  if (!gsap) return;
  gsap.from(selector, { y: 26, opacity: 0, duration: 0.7, stagger: 0.06, ease: 'power2.out' });
}
