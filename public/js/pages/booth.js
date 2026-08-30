/** Rolltime Booth — strip photobooth viral (countdown, frame tematik, unduh PNG) */
import { initI18n, t } from '../i18n.js';
import { mountNav, toast } from '../shared.js';
import { EFFECTS, stampOverlay } from '../fx.js';
import { CameraEngine } from '../cam.js';

mountNav({ ctaHref: '/create', ctaKey: 'nav.cta' });
initI18n();

const $ = s => document.querySelector(s);

/* ---------------- pilihan ---------------- */
const LAYOUTS = [
  { id: 'strip4', cells: 4, key: 'bt.lay4', dkey: 'bt.lay4d', rows: 4, cols: 1 },
  { id: 'strip3', cells: 3, key: 'bt.lay3', dkey: 'bt.lay3d', rows: 3, cols: 1 },
  { id: 'grid22', cells: 4, key: 'bt.lay22', dkey: 'bt.lay22d', rows: 2, cols: 2 },
];
const FRAMES = [
  { id: 'y2k',      key: 'bt.fr.y2k',      bg: '#FF2D9B', fg: '#FFFFFF' },
  { id: 'coquette', key: 'bt.fr.coquette', bg: '#F6CBD6', fg: '#8A2D4B' },
  { id: 'mono',     key: 'bt.fr.mono',     bg: '#111110', fg: '#F7F5F0' },
  { id: 'kodak',    key: 'bt.fr.kodak',    bg: '#FFC400', fg: '#B3231A' },
  { id: 'midnight', key: 'bt.fr.midnight', bg: '#0D1A38', fg: '#BFD4FF' },
];
const state = { layout: LAYOUTS[0], frame: FRAMES[0], fx: 1 };

function renderOpts() {
  $('#layRow').innerHTML = LAYOUTS.map(l => `
    <button class="booth-opt ${state.layout === l ? 'on' : ''}" data-lay="${l.id}">
      <div class="t">${t(l.key)}</div><div class="d">${t(l.dkey)}</div>
      <div class="lay-preview" style="flex-direction:${l.cols > 1 ? 'row' : 'column'};flex-wrap:wrap;width:${l.cols > 1 ? 38 : 18}px">
        ${'<i></i>'.repeat(l.cells)}
      </div>
    </button>`).join('');
  $('#layRow').querySelectorAll('[data-lay]').forEach(b => b.onclick = () => {
    state.layout = LAYOUTS.find(l => l.id === b.dataset.lay); renderOpts();
  });

  $('#frameRow').innerHTML = FRAMES.map(f => `
    <button class="booth-opt ${state.frame === f ? 'on' : ''}" data-fr="${f.id}">
      <div class="lay-preview" style="margin:0 0 10px"><i style="background:${f.bg};border-color:${f.bg};width:26px;height:26px;border-radius:50%"></i></div>
      <div class="t">${t(f.key)}</div>
    </button>`).join('');
  $('#frameRow').querySelectorAll('[data-fr]').forEach(b => b.onclick = () => {
    state.frame = FRAMES.find(f => f.id === b.dataset.fr); renderOpts();
  });

  $('#fxRow').innerHTML = EFFECTS.map(f => `
    <div class="fx-pick ${state.fx === f.id ? 'on' : ''}" data-fx="${f.id}">
      <span class="sw" style="background:${f.chip}"></span>${t('fx.' + f.key)}
    </div>`).join('');
  $('#fxRow').querySelectorAll('[data-fx]').forEach(b => b.onclick = () => {
    state.fx = +b.dataset.fx; renderOpts();
    if (engine) engine.setEffect(state.fx);
  });
}
renderOpts();
document.querySelectorAll('[data-lang-btn]').forEach(b => b.addEventListener('click', () => setTimeout(renderOpts, 0)));

/* ---------------- kamera ---------------- */
let engine = null;
let captures = [];
let curSlot = 0;

$('#startBtn').onclick = async () => {
  engine = new CameraEngine($('#glCanvas'));
  engine.setEffect(state.fx);
  engine.onError = () => showMsg(t('bt.needcam'));
  const okCam = await engine.start('user');
  if (!okCam) { showMsg(t('bt.needcam')); return; }
  captures = Array(state.layout.cells).fill(null);
  curSlot = 0;
  $('#boothSetup').classList.add('hidden');
  $('#boothResult').classList.add('hidden');
  $('#boothShoot').classList.remove('hidden');
  renderSlots();
};

$('#cancelBtn').onclick = () => {
  if (engine) engine.destroy(); engine = null;
  $('#boothShoot').classList.add('hidden');
  $('#boothSetup').classList.remove('hidden');
};
$('#rotateBtn').onclick = () => engine && engine.switchCamera();

function renderSlots() {
  $('#slotLabel').textContent = `${curSlot + 1}/${state.layout.cells}`;
  $('#slotRow').innerHTML = captures.map((c, i) => `
    <div class="slot ${c ? 'filled' : ''}" data-slot="${i}">
      ${c ? `<img src="${c.url}"><button class="re" data-re="${i}" title="retake">↺</button>`
          : `<span>${i === curSlot ? '●' : i + 1}</span>`}
    </div>`).join('');
  $('#slotRow').querySelectorAll('[data-re]').forEach(b => b.onclick = () => {
    const i = +b.dataset.re;
    URL.revokeObjectURL(captures[i].url);
    captures[i] = null; curSlot = i; renderSlots();
  });
}

let counting = false;
$('#shootBtn').onclick = async () => {
  if (counting || !engine) return;
  counting = true;
  const el = $('#countNum');
  el.classList.remove('hidden');
  for (const n of ['3', '2', '1']) {
    el.textContent = n;
    el.style.color = n === '1' ? '#FFD400' : '#fff';  /* kuning = freeze! */
    await wait(650);
  }
  el.classList.add('hidden');
  const { canvas } = await engine.capture({ stamp: false });
  const blob = await new Promise(r => {
    stampOverlay(canvas, { date: new Date(), effectId: state.fx });
    canvas.toBlob(r, 'image/jpeg', 0.92);
  });
  captures[curSlot] = { url: URL.createObjectURL(blob), canvas };
  /* maju ke slot kosong berikutnya */
  let next = captures.findIndex(c => !c);
  if (next === -1) {
    counting = false;
    await compose();
    return;
  }
  curSlot = next;
  renderSlots();
  counting = false;
};

const wait = ms => new Promise(r => setTimeout(r, ms));

function showMsg(m) { const el = $('#camMsg'); el.textContent = m; el.classList.remove('hidden'); setTimeout(() => el.classList.add('hidden'), 2400); }

/* ---------------- komposisi strip ---------------- */
function crop34(srcCanvas) {
  /* crop tengah ke rasio 3:4 */
  const W = srcCanvas.width, H = srcCanvas.height;
  let sw, sh;
  if (W / H > 3 / 4) { sh = H; sw = Math.round(H * 3 / 4); }
  else { sw = W; sh = Math.round(W * 4 / 3); }
  const sx = Math.round((W - sw) / 2), sy = Math.round((H - sh) / 2);
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1440;
  c.getContext('2d').drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, 1080, 1440);
  return c;
}

/* dekorasi frame: hanya di area padding tepi biar nggak nutupin foto */
function drawDecor(ctx, theme, W, H, pad) {
  const fg = theme.fg;
  ctx.save();
  if (theme.id === 'kodak') {
    /* sprocket holes kiri-kanan */
    ctx.fillStyle = '#111110';
    const hw = 26, hh = 38;
    for (let y = 60; y < H - 40; y += 86) {
      roundRect(ctx, pad * 0.22, y, hw, hh, 6); ctx.fill();
      roundRect(ctx, W - pad * 0.22 - hw, y, hw, hh, 6); ctx.fill();
    }
  } else if (theme.id === 'y2k') {
    ctx.fillStyle = fg;
    let side = 0;
    for (let y = 90; y < H - 60; y += 170) {
      star(ctx, side % 2 ? W - pad * 0.5 : pad * 0.5, y, 18, 7);
      side++;
    }
  } else if (theme.id === 'coquette') {
    ctx.fillStyle = fg;
    for (let y = 60; y < H - 40; y += 74) {
      ctx.beginPath(); ctx.arc(pad * 0.5, y, 7, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(W - pad * 0.5, y + 37, 7, 0, 7); ctx.fill();
    }
    /* pita kecil di pojok atas */
    bow(ctx, pad * 0.5, 54, 26, fg);
    bow(ctx, W - pad * 0.5, 54, 26, fg);
  } else if (theme.id === 'mono') {
    ctx.strokeStyle = fg; ctx.lineWidth = 3;
    ctx.strokeRect(pad * 0.4, pad * 0.4, W - pad * 0.8, H - pad * 0.8);
  } else if (theme.id === 'midnight') {
    for (let y = 70; y < H - 40; y += 120) {
      glowDot(ctx, pad * 0.5, y, 5, fg);
      glowDot(ctx, W - pad * 0.5, y + 60, 4, fg);
    }
  }
  ctx.restore();
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function star(ctx, cx, cy, rOut, rIn) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = (Math.PI / 4) * i - Math.PI / 2;
    ctx[i ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath(); ctx.fill();
}
function bow(ctx, cx, cy, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - s, cy - s * 0.7); ctx.lineTo(cx - s, cy + s * 0.7); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + s, cy - s * 0.7); ctx.lineTo(cx + s, cy + s * 0.7); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, s * 0.32, 0, 7); ctx.fill();
}
function glowDot(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * 4, 0, 7); ctx.fill();
}

async function compose() {
  const theme = state.frame;
  const cols = state.layout.cols, rows = state.layout.rows;
  const pad = 70, gap = 40, cellW = 1080, cellH = 1440;
  const drawCellW = Math.round(cols === 2 ? cellW * 0.75 : cellW);
  const drawCellH = Math.round(cols === 2 ? cellH * 0.75 : cellH);
  const topPad = 130, footH = 340;
  const W = pad * 2 + cols * drawCellW + (cols - 1) * gap;
  const H = topPad + rows * drawCellH + (rows - 1) * gap + footH + 40;

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);

  /* header */
  ctx.fillStyle = theme.fg;
  ctx.font = `900 64px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const brand = theme.id === 'y2k' ? 'ROLLTIME ★ BOOTH' : theme.id === 'coquette' ? '♡ rolltime ♡' : theme.id === 'kodak' ? 'ROLLTIME®' : 'ROLLTIME';
  ctx.fillText(brand, W / 2, topPad / 2 + 10);

  /* foto */
  captures.forEach((cap, i) => {
    const col = i % cols, r = Math.floor(i / cols);
    const x = pad + col * (drawCellW + gap);
    const y = topPad + r * (drawCellH + gap);
    ctx.save();
    if (theme.id === 'mono') { ctx.strokeStyle = theme.fg; ctx.lineWidth = 4; ctx.strokeRect(x - 8, y - 8, drawCellW + 16, drawCellH + 16); }
    else { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x - 6, y - 6, drawCellW + 12, drawCellH + 12); }
    ctx.drawImage(crop34(cap.canvas), x, y, drawCellW, drawCellH);
    ctx.restore();
    ctx.strokeStyle = theme.id === 'mono' ? theme.fg : 'rgba(17,17,16,.9)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, drawCellW, drawCellH);
  });

  /* footer */
  const d = new Date();
  const dateStr = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  ctx.fillStyle = theme.fg;
  ctx.font = `700 44px "Courier New", monospace`;
  ctx.fillText(`${dateStr}`, W / 2, H - footH + 130);
  ctx.font = `900 58px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(theme.id === 'kodak' ? 'DEVELOPED BY ROLLTIME®' : 'DEVELOPED BY ROLLTIME', W / 2, H - footH + 220);
  ctx.font = `700 30px "Courier New", monospace`;
  ctx.globalAlpha = 0.7;
  ctx.fillText(theme.id.toUpperCase() + ' — FX_' + String(state.fx).padStart(2, '0'), W / 2, H - footH + 285);
  ctx.globalAlpha = 1;

  drawDecor(ctx, theme, W, H, pad);

  /* tampilkan */
  c.className = 'strip-canvas';
  c.style.maxWidth = cols === 2 ? 'min(420px,86vw)' : 'min(300px,72vw)';
  const holder = $('#stripHolder');
  holder.innerHTML = '';
  holder.appendChild(c);
  state.finalCanvas = c;

  if (engine) { engine.destroy(); engine = null; }
  $('#boothShoot').classList.add('hidden');
  $('#boothResult').classList.remove('hidden');
  window.scrollTo(0, 0);
}

$('#dlBtn').onclick = () => {
  if (!state.finalCanvas) return;
  const a = document.createElement('a');
  a.href = state.finalCanvas.toDataURL('image/png');
  a.download = `rolltime-strip-${Date.now()}.png`;
  a.click();
  toast(t('toast.saved'));
};
$('#againBtn').onclick = () => {
  $('#boothResult').classList.add('hidden');
  $('#boothSetup').classList.remove('hidden');
};
window.addEventListener('pagehide', () => engine && engine.destroy());
