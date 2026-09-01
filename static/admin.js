// ====================================================================
// Panou de admin - login cu parola + controale (conectare TikTok, mod
// test pe cele 4 rarități, reset) + clasament live complet (județe si
// susținători). Separat de pagina de afișaj ("/"), ca butoanele să nu
// apară niciodată în cadrul filmat.
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
const btnTestCommon = document.getElementById('btnTestCommon');
const btnTestRare = document.getElementById('btnTestRare');
const btnTestEpic = document.getElementById('btnTestEpic');
const btnTestLegendary = document.getElementById('btnTestLegendary');
const btnReset = document.getElementById('btnReset');

const statTotal = document.getElementById('statTotal');
const statActive = document.getElementById('statActive');
const statSupporters = document.getElementById('statSupporters');
const statViewers = document.getElementById('statViewers');

const countyBoardBody = document.getElementById('countyBoardBody');
const countyBoardEmpty = document.getElementById('countyBoardEmpty');
const supporterBoardBody = document.getElementById('supporterBoardBody');
const supporterBoardEmpty = document.getElementById('supporterBoardEmpty');

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
      refreshState();
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
      refreshState();
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
    connStatusText.textContent = username ? `Conectat la @${username}` : 'Conectat';
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
  if (!confirm('Sigur resetezi tot (județe + susținători)? Nu poate fi anulat.')) return;
  await fetch('/api/reset', { method: 'POST' });
});

// ---------------- mod test ----------------
function submitTest(gift, value, userLabel){
  const val = testInput.value.trim();
  if (!val) { testInput.focus(); return; }
  fetch('/api/manual-hit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: val, gift, value: value || 0, user: userLabel || 'test_user' })
  }).then(r => r.json()).then(d => {
    if (!d.ok){
      testInput.style.borderColor = '#FF5C7A';
      setTimeout(() => testInput.style.borderColor = '', 500);
    }
  });
}
btnTestComment.addEventListener('click', () => submitTest(false, 0));
btnTestCommon.addEventListener('click', () => submitTest(true, 5, 'test_comun'));
btnTestRare.addEventListener('click', () => submitTest(true, 15, 'test_rar'));
btnTestEpic.addEventListener('click', () => submitTest(true, 50, 'test_epic'));
btnTestLegendary.addEventListener('click', () => submitTest(true, 150, 'test_legendar'));
testInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitTest(false, 0); });

// ---------------- clasament live (tabele) ----------------
function renderCountyBoard(counties){
  const ranked = [...counties].sort((a,b) => b.score - a.score).filter(c => c.score > 0).slice(0, 15);
  countyBoardEmpty.style.display = ranked.length ? 'none' : 'block';
  countyBoardBody.innerHTML = ranked.map((c, idx) => `
    <tr>
      <td class="bt-rank ${idx===0?'r1':idx===1?'r2':idx===2?'r3':''}">${idx+1}</td>
      <td class="bt-name">${c.title} <span style="color:#5A6072;">· ${c.code}</span></td>
      <td class="bt-score">${c.score}</td>
    </tr>`).join('');
}

function renderSupporterBoard(supporters){
  const ranked = (supporters || []).slice(0, 15);
  supporterBoardEmpty.style.display = ranked.length ? 'none' : 'block';
  supporterBoardBody.innerHTML = ranked.map((s, idx) => `
    <tr>
      <td class="bt-rank ${idx===0?'r1':idx===1?'r2':idx===2?'r3':''}">${idx+1}</td>
      <td class="bt-name">${escapeHtml(s.name)}</td>
      <td class="bt-score">${s.points}</td>
    </tr>`).join('');
}

function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function renderStats(data){
  const counties = data.counties_ranked || data.counties || [];
  const total = counties.reduce((s,c) => s + c.score, 0);
  const active = counties.filter(c => c.score > 0).length;
  statTotal.textContent = total;
  statActive.textContent = `${active} / ${counties.length}`;
  statSupporters.textContent = (data.top_supporters || []).length;
  statViewers.textContent = data.viewer_count || 0;
}

async function refreshState(){
  try {
    const res = await fetch('/api/state');
    const data = await res.json();
    setConnectedUI(data.connected, data.username);
    renderCountyBoard(data.counties_ranked || data.counties || []);
    renderSupporterBoard(data.top_supporters || []);
    renderStats(data);
  } catch (e){ /* tacut - se reincearca la urmatorul eveniment websocket */ }
}

// ---------------- websocket (actualizeaza tabelele live) ----------------
let ws;
function connectWs(){
  if (ws && ws.readyState === WebSocket.OPEN) return;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws`);

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.event === 'snapshot' || data.event === 'reset'){
      setConnectedUI(data.connected, data.username);
      renderCountyBoard(data.counties || []);
      renderSupporterBoard(data.top_supporters || []);
      renderStats(data);
    } else if (data.event === 'status'){
      setConnectedUI(data.connected, data.username);
    } else if (data.event === 'hit' || data.event === 'gift' || data.event === 'mega_gift'){
      // pentru actualizare completa si corecta, cerem un refresh usor de la server
      refreshState();
    } else if (data.event === 'viewers'){
      statViewers.textContent = data.viewer_count;
    }
  };
  ws.onclose = () => { setTimeout(connectWs, 1500); };
}

checkAuth();
