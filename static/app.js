// ====================================================================
// Cel mai tare judet din Romania - frontend
// Se conecteaza prin WebSocket la server si redeseneaza harta +
// clasamentul in timp real pe masura ce vin comentarii/cadouri.
// ====================================================================

const BUCURESTI_ID = 'RO-B';
const RANK_TIER_COLORS = ['#F6C400', '#B9C0CC', '#C97A4A', '#0FE6D6', '#FF2D6A']; // 1..5

const svg = document.getElementById('map-svg');
const pathGroup = document.getElementById('path-group');
const boardList = document.getElementById('boardList');
const feedList = document.getElementById('feedList');
const giftOverlay = document.getElementById('giftOverlay');
const bucCircle = document.getElementById('bucCircle');
const bucScoreEl = document.getElementById('bucScore');
const bucRankEl = document.getElementById('bucRank');

const livePill = document.getElementById('livePill');
const liveLabel = document.getElementById('liveLabel');
const viewersCount = document.getElementById('viewersCount');

const statTotal = document.getElementById('statTotal');
const statActive = document.getElementById('statActive');
const statGap = document.getElementById('statGap');
const statTime = document.getElementById('statTime');

let counties = {};        // id -> {id, code, title, score}
let connectedSince = null;
let rankBadges = {};      // id -> DOM element (exclude Bucuresti, are propriul cerc)

// ---------------- build the map once ----------------
ROMANIA_PATHS.forEach(c => {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', c.d);
  path.setAttribute('id', c.id);
  path.setAttribute('class', 'jud');
  path.dataset.code = c.code;
  path.dataset.title = c.title;
  pathGroup.appendChild(path);
  counties[c.id] = { id: c.id, code: c.code, title: c.title, score: 0 };
});

// rank badges (positioned after layout, via getBBox) - toate judetele in afara de Bucuresti
function ensureRankBadges(){
  ROMANIA_PATHS.forEach(c => {
    if (c.id === BUCURESTI_ID) return; // Bucuresti are cercul lui separat
    if (rankBadges[c.id]) return;
    const el = document.createElement('div');
    el.className = 'rank-badge';
    el.innerHTML = `<span class="cd">${c.code}</span>`;
    document.body.appendChild(el);
    rankBadges[c.id] = el;
  });
}

function positionBadges(){
  const svgRect = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const scaleX = svgRect.width / vb.width;
  const scaleY = svgRect.height / vb.height;
  ROMANIA_PATHS.forEach(c => {
    if (c.id === BUCURESTI_ID) return;
    const pathEl = document.getElementById(c.id);
    const badge = rankBadges[c.id];
    if (!pathEl || !badge) return;
    const bb = pathEl.getBBox();
    const cx = svgRect.left + (bb.x + bb.width/2 - vb.x) * scaleX;
    const cy = svgRect.top + (bb.y + bb.height/2 - vb.y) * scaleY;
    badge.style.left = cx + 'px';
    badge.style.top = cy + 'px';
  });
}

// ---------------- colors ----------------
function colorForScore(score, maxScore){
  if (score <= 0) return '#EEEFF2';
  const ratio = maxScore > 0 ? score / maxScore : 0;
  const stops = [
    {p:0.0,  c:[255,241,199]},
    {p:0.35, c:[246,196,0]},
    {p:0.7,  c:[255,110,90]},
    {p:1.0,  c:[217,30,54]}
  ];
  let a = stops[0], b = stops[stops.length-1];
  for (let i=0; i<stops.length-1; i++){
    if (ratio >= stops[i].p && ratio <= stops[i+1].p){ a = stops[i]; b = stops[i+1]; break; }
  }
  const span = (b.p - a.p) || 1;
  const local = (ratio - a.p) / span;
  const rgb = a.c.map((v,i) => Math.round(v + (b.c[i]-v) * local));
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

function maxScore(){
  return Object.values(counties).reduce((m,c) => Math.max(m, c.score), 0);
}

function rankTierClass(idx){
  return idx < 5 ? `tier-${idx+1}` : '';
}

// ---------------- map painting (culori + badge-uri + top 5 special) ----------------
function paintMap(){
  const mx = maxScore();
  const ranked = Object.values(counties).sort((a,b) => b.score - a.score);
  const rankIndexById = {};
  ranked.forEach((c, idx) => { rankIndexById[c.id] = idx; });

  Object.values(counties).forEach(c => {
    const el = document.getElementById(c.id);
    if (!el) return;
    el.setAttribute('fill', colorForScore(c.score, mx));
    const idx = rankIndexById[c.id];
    const inTop5 = mx > 0 && idx < 5;
    el.classList.toggle('top5', inTop5);
    // curata clasele de tier anterioare, apoi pune tier-ul curent
    el.classList.remove('tier-1','tier-2','tier-3','tier-4','tier-5');
    if (inTop5) el.classList.add(rankTierClass(idx));
  });

  ensureRankBadges();
  ranked.forEach((c, idx) => {
    const badge = rankBadges[c.id];
    if (!badge) return;
    const inTop5 = mx > 0 && idx < 5;
    badge.className = 'rank-badge' + (inTop5 ? ` ${rankTierClass(idx)}` : '');
    badge.innerHTML = `<span class="cd">${c.code}</span><span class="rk">#${idx+1}</span>`;
  });

  // cercul separat pentru Bucuresti
  const bucScore = counties[BUCURESTI_ID]?.score || 0;
  const bucIdx = rankIndexById[BUCURESTI_ID];
  const bucInTop5 = mx > 0 && bucIdx < 5;
  bucCircle.style.background = colorForScore(bucScore, mx);
  bucCircle.classList.remove('tier-1','tier-2','tier-3','tier-4','tier-5');
  if (bucInTop5) bucCircle.classList.add(rankTierClass(bucIdx));
  bucCircle.classList.toggle('top5', bucInTop5);
  bucScoreEl.textContent = bucScore;
  bucRankEl.textContent = `#${bucIdx + 1}`;

  requestAnimationFrame(positionBadges);
}

// ---------------- leaderboard ----------------
function renderBoard(){
  const mx = maxScore();
  const top = Object.values(counties).sort((a,b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 10);

  top.forEach((c, idx) => {
    let row = document.getElementById('brow-' + c.id);
    if (!row){
      row = document.createElement('div');
      row.className = 'board-row';
      row.id = 'brow-' + c.id;
      row.innerHTML = `
        <span class="rank"></span>
        <div class="board-main">
          <div class="board-top">
            <span class="board-name"></span>
            <span class="board-score num"></span>
          </div>
          <div class="board-bar-track"><div class="board-bar-fill"></div></div>
        </div>`;
      boardList.appendChild(row);
    }
    row.querySelector('.rank').textContent = idx + 1;
    row.querySelector('.board-name').textContent = `${c.title} · ${c.code}`;
    row.querySelector('.board-score').textContent = c.score;
    row.querySelector('.board-bar-fill').style.width = (mx > 0 ? (c.score / mx * 100) : 0) + '%';
    row.classList.remove('tier-1','tier-2','tier-3','tier-4','tier-5');
    if (mx > 0 && idx < 5) row.classList.add(rankTierClass(idx));
    boardList.appendChild(row); // reorder into place
  });

  [...boardList.children].forEach(row => {
    const id = row.id.replace('brow-', '');
    if (!top.find(c => c.id === id)) row.remove();
  });
}

function bumpRow(id){
  const row = document.getElementById('brow-' + id);
  if (!row) return;
  row.classList.remove('bump');
  void row.offsetWidth;
  row.classList.add('bump');
}

// ---------------- activity feed ----------------
function pushFeedItem({ user, code, title, points, gift, mega, giftName, value }){
  const empty = feedList.querySelector('.feed-empty');
  if (empty) empty.remove();

  const item = document.createElement('div');
  item.className = 'feed-item' + (gift ? ' gift' : '') + (mega ? ' mega' : '');
  const icon = mega ? '🔥' : (gift ? '🎁' : '💬');
  const desc = gift ? `a susținut ${title}${value ? ` (${value} 💎)` : ''}` : `→ ${code}`;
  item.innerHTML = `
    <span>${icon}</span>
    <span class="fu">${escapeHtml(user || 'cineva')}</span>
    <span class="fc">${desc}</span>
    <span class="fp">+${points}${gift ? ' ×2' : ''}</span>`;
  feedList.appendChild(item);

  while (feedList.children.length > 25) feedList.removeChild(feedList.firstChild);
  feedList.scrollTop = feedList.scrollHeight;
}

function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ---------------- floating pop + county glow ----------------
function getCountyScreenPos(countyId){
  if (countyId === BUCURESTI_ID){
    const r = bucCircle.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  }
  const el = document.getElementById(countyId);
  if (!el) return null;
  const svgRect = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const bb = el.getBBox();
  return {
    x: svgRect.left + (bb.x + bb.width/2 - vb.x) * (svgRect.width / vb.width),
    y: svgRect.top + (bb.y + bb.height/2 - vb.y) * (svgRect.height / vb.height)
  };
}

function popFloat(countyId, text, isGift){
  const pos = getCountyScreenPos(countyId);
  if (!pos) return;
  const { x, y } = pos;

  const pop = document.createElement('div');
  pop.className = 'float-pop' + (isGift ? ' gift' : '');
  pop.textContent = text;
  pop.style.left = x + 'px';
  pop.style.top = y + 'px';
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 1200);

  const badge = document.createElement('div');
  badge.className = 'hit-badge' + (isGift ? ' gift' : '');
  badge.textContent = isGift ? `🎁 ${counties[countyId]?.title || ''}` : (counties[countyId]?.title || '');
  badge.style.left = x + 'px';
  badge.style.top = y + 'px';
  document.body.appendChild(badge);
  setTimeout(() => badge.remove(), 1250);

  if (isGift){
    if (countyId === BUCURESTI_ID){
      bucCircle.classList.remove('pulseGift');
      void bucCircle.offsetWidth;
      bucCircle.classList.add('pulseGift');
    } else {
      const el = document.getElementById(countyId);
      if (el){
        el.classList.remove('pulseGift');
        void el.offsetWidth;
        el.classList.add('pulseGift');
      }
    }
  }
}

// ---------------- gift celebration overlays ----------------
const CONFETTI_COLORS = ['#0FE6D6','#FF2D6A','#F6C400','#1B3B8C','#ffffff'];
function launchConfetti(count){
  for (let i=0; i<count; i++){
    const p = document.createElement('div');
    p.className = 'confetti';
    p.style.left = (Math.random()*100) + 'vw';
    p.style.background = CONFETTI_COLORS[Math.floor(Math.random()*CONFETTI_COLORS.length)];
    p.style.animationDuration = (1.6 + Math.random()*1.2) + 's';
    p.style.animationDelay = (Math.random()*0.3) + 's';
    p.style.width = (6 + Math.random()*6) + 'px';
    p.style.height = (10 + Math.random()*8) + 'px';
    p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 3200);
  }
}

function showGiftCard({ user, title, giftName }){
  giftOverlay.innerHTML = `
    <div class="gift-card show">
      <span class="ic">🎁</span>
      <div class="gu">${escapeHtml(user || 'cineva')} a trimis ${escapeHtml(giftName || 'un cadou')}</div>
      <div class="jn">${escapeHtml(title)}</div>
      <div class="sub">PUNCTE ×2</div>
    </div>`;
  launchConfetti(80);
  setTimeout(() => { giftOverlay.innerHTML = ''; }, 2500);
}

// Animatie mega, pentru cadouri cu valoare peste prag (implicit 99) -
// mai mare, mai lunga, cu accent pe cine a dat cadoul si din ce judet e.
function showMegaGiftCard({ user, title, giftName, value }){
  giftOverlay.innerHTML = `
    <div class="gift-card mega show">
      <div class="mega-tag">🔥 SUPER SUSȚINĂTOR LIVE</div>
      <span class="ic">🎉</span>
      <div class="gu">
        <span class="gu-user">${escapeHtml(user || 'cineva')}</span>
        a trimis <b>${escapeHtml(giftName || 'un cadou')}</b>${value ? ` · ${value} 💎` : ''}
      </div>
      <div class="jn">${escapeHtml(title)}</div>
      <div class="sub">PUNCTE ×2</div>
    </div>`;
  launchConfetti(160);
  setTimeout(() => { giftOverlay.innerHTML = ''; }, 4200);
}

// ---------------- stats bar ----------------
function renderStats(){
  const arr = Object.values(counties).sort((a,b) => b.score - a.score);
  const total = arr.reduce((s,c) => s + c.score, 0);
  const activeCount = arr.filter(c => c.score > 0).length;
  const gap = arr.length > 1 ? (arr[0].score - arr[1].score) : (arr[0]?.score || 0);

  statTotal.textContent = total;
  statActive.textContent = `${activeCount} / ${arr.length}`;
  statGap.textContent = gap;
}

function tickTimer(){
  if (!connectedSince){ statTime.textContent = '--:--:--'; return; }
  const diff = Math.max(0, Math.floor(Date.now()/1000 - connectedSince));
  const h = String(Math.floor(diff/3600)).padStart(2,'0');
  const m = String(Math.floor((diff%3600)/60)).padStart(2,'0');
  const s = String(diff%60).padStart(2,'0');
  statTime.textContent = `${h}:${m}:${s}`;
}
setInterval(tickTimer, 1000);

// ---------------- connection status UI (doar pill-ul din header) ----------------
function setConnectedUI(connected, username){
  if (connected){
    livePill.classList.add('live');
    liveLabel.textContent = 'LIVE';
    livePill.title = `Conectat la @${username}`;
  } else {
    livePill.classList.remove('live');
    liveLabel.textContent = 'OFFLINE';
    livePill.title = '';
    connectedSince = null;
  }
}

// ---------------- websocket ----------------
let ws;
function connectWs(){
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws`);

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);

    if (data.event === 'snapshot' || data.event === 'reset'){
      data.counties.forEach(c => { counties[c.id] = c; });
      connectedSince = data.connected_since || null;
      setConnectedUI(data.connected, data.username);
      if (data.viewer_count) viewersCount.textContent = data.viewer_count;
      paintMap(); renderBoard(); renderStats();
      if (data.event === 'reset'){
        feedList.innerHTML = '<div class="feed-empty">Aici apar comentariile și cadourile pe măsură ce vin.</div>';
      }
      return;
    }

    if (data.event === 'hit' || data.event === 'gift' || data.event === 'mega_gift'){
      const isGift = data.event === 'gift' || data.event === 'mega_gift';
      const isMega = data.event === 'mega_gift';
      const county = Object.values(counties).find(c => c.code === data.county);
      if (county) county.score = data.score;
      paintMap(); renderBoard(); renderStats();
      if (county) bumpRow(county.id);
      if (county) popFloat(county.id, `+${data.points}${isGift ? ' ×2' : ''}`, isGift);
      pushFeedItem({
        user: data.user, code: data.county, title: data.title,
        points: data.points, gift: isGift, mega: isMega,
        giftName: data.gift_name, value: data.value
      });
      if (isMega){
        showMegaGiftCard({ user: data.user, title: data.title, giftName: data.gift_name, value: data.value });
      } else if (isGift){
        showGiftCard({ user: data.user, title: data.title, giftName: data.gift_name });
      }
      return;
    }

    if (data.event === 'status'){
      setConnectedUI(data.connected, data.username);
      return;
    }

    if (data.event === 'viewers'){
      viewersCount.textContent = data.viewer_count;
      return;
    }
  };

  ws.onclose = () => { setTimeout(connectWs, 1500); };
}
connectWs();

// ---------------- controale ----------------
// Conectarea la TikTok, modul test si resetarea s-au mutat in /admin,
// ca butoanele sa nu apara niciodata in cadrul filmat.

window.addEventListener('resize', () => requestAnimationFrame(positionBadges));

// initial paint (before websocket snapshot arrives)
paintMap();
renderBoard();
renderStats();
