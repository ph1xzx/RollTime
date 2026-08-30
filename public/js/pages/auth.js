import { initI18n, t } from '../i18n.js';
import { mountNav, api, toast } from '../shared.js';

mountNav({ ctaHref: '/', ctaKey: 'common.back' });
initI18n();

if (api.token) { try { await api.req('/api/me'); location.href = '/app'; } catch (e) { api.setToken(null); } }

let mode = location.hash === '#login' ? 'login' : 'signup';
const $ = s => document.querySelector(s);

function render() {
  $('#tabLogin').classList.toggle('on', mode === 'login');
  $('#tabSignup').classList.toggle('on', mode === 'signup');
  $('#authTitle').textContent = t(mode === 'login' ? 'auth.login' : 'auth.signup');
  $('#authSub').textContent = t(mode === 'login' ? 'auth.go.1' : 'auth.go.2');
  $('#authGo').textContent = t(mode === 'login' ? 'auth.submit.login' : 'auth.submit.signup');
  $('#nameField').style.display = mode === 'login' ? 'none' : 'flex';
  $('#authErr').classList.add('hidden');
}
$('#tabLogin').onclick = () => { mode = 'login'; render(); };
$('#tabSignup').onclick = () => { mode = 'signup'; render(); };

function showErr(key) {
  const e = $('#authErr');
  e.textContent = key;
  e.classList.remove('hidden');
}

$('#authGo').onclick = async () => {
  const email = $('#inEmail').value.trim();
  const password = $('#inPass').value;
  const name = $('#inName').value.trim();
  $('#authGo').disabled = true;
  try {
    const path = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
    const body = mode === 'login' ? { email, password } : { name, email, password };
    const { token } = await api.req(path, { method: 'POST', body });
    api.setToken(token);
    const next = new URLSearchParams(location.search).get('next') || '/create';
    location.href = next;
  } catch (err) {
    const map = {
      email_taken: 'Email ini udah terdaftar. Login aja.',
      bad_credentials: 'Email / password salah.',
      weak_password: 'Password kependekan (min 4).',
      missing_fields: 'Isi semua dulu ya.',
    };
    showErr(map[err.message] || 'Ada error. Coba lagi.');
  } finally {
    $('#authGo').disabled = false;
  }
};
document.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') $('#authGo').click(); }));
render();
