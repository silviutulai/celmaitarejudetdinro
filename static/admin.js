// ====================================================================
// Panou de admin - login cu parola + controale (conectare TikTok,
// mod test, reset). Separat de pagina de afisaj ("/"), ca butoanele
// sa nu apara niciodata in cadrul filmat.
// ====================================================================

const loginScreen = document.getElementById('loginScreen');
const adminPanel = document.getElementById('adminPanel');
const passwordInput = document.getElementById('passwordInput');
const btnLogin = document.getElementById('btnLogin');
const loginError = document.getElementById('loginError');

const connStatus = document.getElementById('connStatus');
const connStatusText = document.getElementById('connStatusText');
const usernameInput = document.getElementById('usernameInput');
const btnConnect = document.getElementById('btnConnect');
const btnDisconnect = document.getElementById('btnDisconnect');
const btnLogout = document.getElementById('btnLogout');

const testInput = document.getElementById('testInput');
const btnTestComment = document.getElementById('btnTestComment');
const btnTestGift = document.getElementById('btnTestGift');
const btnTestMega = document.getElementById('btnTestMega');
const btnReset = document.getElementById('btnReset');

function showLogin(message){
  loginScreen.style.display = 'flex';
  adminPanel.style.display = 'none';
  if (message){
    loginError.textContent = message;
    loginError.style.display = 'block';
  }
}

function showPanel(){
  loginScreen.style.display = 'none';
  adminPanel.style.display = 'block';
}

async function checkAuth(){
  try {
    const res = await fetch('/api/admin/check');
    const data = await res.json();
    if (data.authenticated){
      showPanel();
      connectWs();
    } else if (!data.configured){
      showLogin('Nu ai setat ADMIN_PASSWORD pe server (vezi README.md).');
    } else {
      showLogin();
    }
  } catch (e){
    showLogin('Eroare de rețea.');
  }
}

btnLogin.addEventListener('click', doLogin);
passwordInput.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

async function doLogin(){
  const password = passwordInput.value;
  if (!password) { passwordInput.focus(); return; }
  btnLogin.disabled = true;
  btnLogin.textContent = 'Se verifică...';
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (data.ok){
      passwordInput.value = '';
      loginError.style.display = 'none';
      showPanel();
      connectWs();
    } else {
      loginError.textContent = data.message || 'Parolă greșită.';
      loginError.style.display = 'block';
    }
  } catch (e){
    loginError.textContent = 'Eroare de rețea.';
    loginError.style.display = 'block';
  }
  btnLogin.disabled = false;
  btnLogin.textContent = 'Intră';
}

btnLogout.addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' });
  location.reload();
});

// ---------------- connection status ----------------
function setConnectedUI(connected, username){
  if (connected){
    connStatus.classList.add('on');
    connStatusText.textContent = `Conectat la @${username}`;
    btnConnect.style.display = 'none';
    btnDisconnect.style.display = 'block';
  } else {
    connStatus.classList.remove('on');
    connStatusText.textContent = 'Neconectat';
    btnConnect.style.display = 'block';
    btnDisconnect.style.display = 'none';
  }
}

btnConnect.addEventListener('click', async () => {
  const username = usernameInput.value.trim();
  if (!username) { usernameInput.focus(); return; }
  btnConnect.disabled = true;
  btnConnect.textContent = 'Se conectează...';
  try {
    const res = await fetch('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    const data = await res.json();
    if (!data.ok) alert(data.message || 'Nu s-a putut realiza conexiunea.');
  } catch (e){
    alert('Eroare de rețea la conectare.');
  }
  btnConnect.disabled = false;
  btnConnect.textContent = 'Conectează-te la live';
});

btnDisconnect.addEventListener('click', async () => {
  await fetch('/api/disconnect', { method: 'POST' });
});

btnReset.addEventListener('click', async () => {
  if (!confirm('Sigur resetezi tot clasamentul? Nu poate fi anulat.')) return;
  await fetch('/api/reset', { method: 'POST' });
});

function submitTest(gift, value){
  const val = testInput.value.trim();
  if (!val) return;
  fetch('/api/manual-hit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: val, gift, value: value || 0 })
  }).then(r => r.json()).then(d => {
    if (!d.ok){
      testInput.style.borderColor = 'var(--flag-red)';
      setTimeout(() => testInput.style.borderColor = '', 500);
    } else {
      testInput.value = '';
    }
  });
}
btnTestComment.addEventListener('click', () => submitTest(false, 0));
btnTestGift.addEventListener('click', () => submitTest(true, 10));
btnTestMega.addEventListener('click', () => submitTest(true, 150));
testInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitTest(false, 0); });

// ---------------- websocket (doar ca sa arate statusul curent) ----------------
let ws;
function connectWs(){
  if (ws && ws.readyState === WebSocket.OPEN) return;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws`);

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.event === 'snapshot' || data.event === 'status'){
      setConnectedUI(data.connected, data.username);
    }
  };
  ws.onclose = () => { setTimeout(connectWs, 1500); };
}

checkAuth();
