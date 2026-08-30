import { initI18n, t, applyI18n } from '../i18n.js';
import { api, guestSess, toast } from '../shared.js';
import { EFFECTS } from '../fx.js';
import { CameraEngine, loadImageFromFile } from '../cam.js';

initI18n();

const code = location.pathname.split('/')[2];
const $ = s => document.querySelector(s);
const sess = guestSess.get(code);
if (!sess || !sess.token) location.href = `/e/${code}`;

/* ---- state roll ---- */
let roll = null;
try { roll = await api.req(`/api/events/${code}/roll`, { guestToken: sess.token }); }
catch (e) { location.href = `/e/${code}`; }

let shotsLeft = roll.shots_per_guest - roll.guest.shots_used;
let frameNo = roll.guest.shots_used + 1;

let evName = 'ROLLTIME';
try { const { event } = await api.req(`/api/events/${code}`); evName = event.name; } catch (e) {}
$('#camEvName').textContent = evName.toUpperCase();
$('#doneGalleryBtn').href = `/e/${code}/gallery`;
$('#doneGalleryBtn').textContent = t('jn.togallery');

function renderShots() { $('#shotsLeft').textContent = `${shotsLeft} ${t('cam.left')}`; }

/* ---- date stamp live ---- */
function tickStamp() {
  const d = new Date();
  $('#dateStamp').textContent =
    `${String(d.getFullYear()).slice(2)} ${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getDate()).padStart(2,'0')}`;
}
tickStamp(); setInterval(tickStamp, 30000);

/* ---- kamera ---- */
const engine = new CameraEngine($('#glCanvas'));
engine.onError = () => { showMsg(t('cam.allow'), true); };
engine.effectId = roll.filter_id ?? 1;
const camOk = await engine.start('environment');
if (!camOk) showMsg(t('cam.allow') + ' ' + t('cam.hint'), true);

renderShots();
if (shotsLeft <= 0) showDone();

/* ---- fx row ---- */
const row = $('#fxRow');
row.innerHTML = EFFECTS.map(f =>
  `<button class="${f.id === engine.effectId ? 'on' : ''}" data-fx="${f.id}">${t('fx.' + f.key)}</button>`).join('');
row.querySelectorAll('button').forEach(b => b.onclick = () => {
  engine.setEffect(+b.dataset.fx);
  row.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
});

/* ---- tombol ---- */
$('#rotateBtn').onclick = () => engine.switchCamera();
$('#uploadBtn').onclick = () => $('#fileInput').click();

let busy = false;
function flashAnim() {
  const f = $('#camFlash');
  f.classList.add('go');
  setTimeout(() => f.classList.remove('go'), 90);
  if (navigator.vibrate) navigator.vibrate(18);
}

async function send(blob) {
  const form = new FormData();
  form.append('photo', blob, `shot-${frameNo}.jpg`);
  form.append('filter_id', String(engine.effectId));
  const res = await api.req(`/api/events/${code}/photos`, { method: 'POST', form, guestToken: sess.token });
  return res;
}

async function shoot(fromFile = null) {
  if (busy || shotsLeft <= 0) return;
  busy = true;
  showMsg(t('cam.uploading'));
  flashAnim();
  try {
    let cap;
    if (fromFile) {
      const img = await loadImageFromFile(fromFile);
      cap = await engine.captureFromImage(img, { frame: `${String(frameNo).padStart(2, '0')}A` });
      URL.revokeObjectURL(img.src);
    } else {
      cap = await engine.capture({ frame: `${String(frameNo).padStart(2, '0')}A` });
    }
    if (!cap.blob) throw new Error('no_blob');
    await send(cap.blob);
    shotsLeft--; frameNo++;
    renderShots();
    showMsg(t('cam.saved'));
    if (shotsLeft <= 0) setTimeout(showDone, 700);
  } catch (e) {
    if (e.message === 'roll_empty') showDone();
    else showMsg(t('cam.fail'));
  } finally { busy = false; }
}

$('#shutterBtn').onclick = () => shoot();
$('#fileInput').onchange = e => {
  if (e.target.files && e.target.files[0]) shoot(e.target.files[0]);
  e.target.value = '';
};

function showMsg(msg, sticky = false) {
  const m = $('#camMsg');
  m.textContent = msg;
  m.classList.remove('hidden');
  if (!sticky) setTimeout(() => m.classList.add('hidden'), 1600);
}
function showDone() {
  $('#camDone').classList.remove('hidden');
  $('#camMsg').classList.add('hidden');
  engine.destroy();
}

/* bersih-bersih saat pindah halaman */
window.addEventListener('pagehide', () => engine.destroy());
