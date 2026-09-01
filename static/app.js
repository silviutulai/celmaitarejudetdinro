// ====================================================================
// Cel mai tare judet din Romania - pagina de afisaj (fara controale).
// Se conecteaza prin WebSocket la server si redeseneaza harta, top 5
// sustinatori si animatiile de comentariu/cadou in timp real.
// Format 9:16 (letterbox automat, indiferent de dimensiunea ferestrei).
// ====================================================================

const BUCURESTI_ID = 'RO-B';
const stageWrap = document.getElementById('stageWrap');
const svg = document.getElementById('map-svg');
const pathGroup = document.getElementById('path-group');
const bucCircle = document.getElementById('bucCircle');
const supportersBar = document.getElementById('supportersBar');
const giftLayer = document.getElementById('giftLayer');

const statusPill = document.getElementById('statusPill');
const statusLabel = document.getElementById('statusLabel');
const viewersCount = document.getElementById('viewersCount');

let counties = {};      // id -> {id, code, title, score}
let rankBadges = {};    // id -> element (in afara de Bucuresti)

// ---------------- pastreaza raportul 9:16, indiferent de fereastra ----------------
function fitStage(){
  const targetRatio = 9 / 16; // latime / inaltime
  const vw = window.innerWidth, vh = window.innerHeight;
  let w, h;
  if (vw / vh > targetRatio){
    h = vh; w = h * targetRatio;
  } else {
    w = vw; h = w / targetRatio;
  }
  stageWrap.style.width = w + 'px';
  stageWrap.style.height = h + 'px';
  requestAnimationFrame(positionBadges);
}
window.addEventListener('resize', fitStage);
fitStage();

// ---------------- construieste harta o singura data ----------------
ROMANIA_PATHS.forEach(c => {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', c.d);
  path.setAttribute('id', c.id);
  path.setAttribute('class', 'jud');
  pathGroup.appendChild(path);
  counties[c.id] = { id: c.id, code: c.code, title: c.title, score: 0 };
});

function ensureRankBadges(){
  ROMANIA_PATHS.forEach(c => {
    if (c.id === BUCURESTI_ID) return;
    if (rankBadges[c.id]) return;
    const el = document.createElement('div');
    el.className = 'rank-badge';
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

function maxScore(){ return Object.values(counties).reduce((m,c) => Math.max(m, c.score), 0); }
function rankTierClass(idx){ return idx < 5 ? `tier-${idx+1}` : ''; }

// ---------------- desenarea hartii: doar top 5 judete au culoare, restul gri ----------------
function paintMap(){
  const mx = maxScore();
  const ranked = Object.values(counties).sort((a,b) => b.score - a.score);
  const rankIndexById = {};
  ranked.forEach((c, idx) => { rankIndexById[c.id] = idx; });

  Object.values(counties).forEach(c => {
    const el = document.getElementById(c.id);
    if (!el) return;
    const idx = rankIndexById[c.id];
    const inTop5 = mx > 0 && idx < 5;
    el.classList.remove('tier-1','tier-2','tier-3','tier-4','tier-5','top5');
    if (inTop5){ el.classList.add('top5'); el.classList.add(rankTierClass(idx)); }
  });

  ensureRankBadges();
  ranked.forEach((c, idx) => {
    const badge = rankBadges[c.id];
    if (!badge) return;
    const inTop5 = mx > 0 && idx < 5;
    badge.className = 'rank-badge' + (inTop5 ? ` ${rankTierClass(idx)}` : '');
    badge.innerHTML = `<span class="cd">${c.code}</span><span class="rk">#${idx+1}</span>`;
  });

  const bucScore = counties[BUCURESTI_ID]?.score || 0;
  const bucIdx = rankIndexById[BUCURESTI_ID];
  const bucInTop5 = mx > 0 && bucIdx < 5;
  bucCircle.classList.remove('tier-1','tier-2','tier-3','tier-4','tier-5','top5');
  if (bucInTop5){ bucCircle.classList.add('top5'); bucCircle.classList.add(rankTierClass(bucIdx)); }
  bucCircle.querySelector('.buc-score').textContent = bucScore;
  bucCircle.querySelector('.buc-rank').textContent = `#${bucIdx + 1}`;

  requestAnimationFrame(positionBadges);
}

function initials(name){
  return (name || '?').replace(/[._]/g,' ').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase() || '?';
}
function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ---------------- top 5 sustinatori (persoane, primite de la server) ----------------
function renderSupporters(list){
  supportersBar.innerHTML = (list || []).slice(0, 5).map((s, idx) => `
    <div class="supporter-card r${idx+1}">
      <div class="sc-shield-wrap">
        <div class="sc-num">${idx+1}</div>
        <div class="sc-shield">
          <span class="sc-crown">👑</span>
          <span class="sc-initials">${initials(s.name)}</span>
        </div>
      </div>
      <div class="sc-name">${escapeHtml(s.name)}</div>
      <div class="sc-pts">${s.points} pct</div>
    </div>`).join('');
}

// ---------------- animatie mica la fiecare comentariu (numele langa judet) ----------------
function popCommentName(countyId, name){
  const el = document.getElementById(countyId);
  const isBuc = countyId === BUCURESTI_ID;
  let x, y;
  if (isBuc){
    const r = bucCircle.getBoundingClientRect();
    x = r.left + r.width/2; y = r.top;
  } else {
    if (!el) return;
    const svgRect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const bb = el.getBBox();
    x = svgRect.left + (bb.x + bb.width/2 - vb.x) * (svgRect.width / vb.width);
    y = svgRect.top + (bb.y - vb.y) * (svgRect.height / vb.height);
  }
  const pop = document.createElement('div');
  pop.className = 'comment-pop';
  pop.innerHTML = `<span class="cp-plus">+1</span> ${escapeHtml(name)}`;
  pop.style.left = x + 'px';
  pop.style.top = y + 'px';
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 1550);
}

// ---------------- animatia de cadou (fighter card) ----------------
function showGiftOverlay({ user, county, raw, points, rarity }){
  const rarityLabel = { common:'OBIȘNUIT', rare:'RAR', epic:'EPIC', legendary:'LEGENDAR' }[rarity] || 'OBIȘNUIT';
  giftLayer.innerHTML = `
    <div class="scrim ${rarity}"></div>
    <div class="fcard ${rarity} show">
      <div class="fcard-beams"></div>
      <div class="fcard-frame">
        <div class="fcard-rarity-tag">${rarityLabel}</div>
        <div class="fcard-avatar"><span>${initials(user)}</span></div>
        <div class="fcard-user">${escapeHtml(user)}</div>
        <div class="fcard-county">${escapeHtml(county)}</div>
        <div class="fcard-points">+${points} PUNCTE</div>
        <div class="fcard-sub">cadou ${raw} × 2</div>
      </div>
    </div>`;
  if (rarity === 'legendary'){
    for (let i=0;i<26;i++){
      const r = document.createElement('div');
      r.className = 'ray';
      r.style.transform = `rotate(${i * (360/26)}deg)`;
      r.style.animationDelay = (i*0.02)+'s';
      giftLayer.appendChild(r);
    }
  }
  setTimeout(() => { giftLayer.innerHTML = ''; }, rarity === 'legendary' ? 4400 : 2500);
}

// ---------------- status LIVE / viewers ----------------
function setConnectedUI(connected){
  statusPill.classList.toggle('live', !!connected);
  statusLabel.textContent = connected ? 'LIVE' : 'OFFLINE';
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
      setConnectedUI(data.connected);
      if (data.viewer_count) viewersCount.textContent = data.viewer_count;
      paintMap();
      renderSupporters(data.top_supporters || []);
      return;
    }

    if (data.event === 'hit'){
      const county = Object.values(counties).find(c => c.code === data.county);
      if (county) county.score = data.score;
      paintMap();
      if (data.top_supporters) renderSupporters(data.top_supporters);
      if (county) popCommentName(county.id, data.user);
      return;
    }

    if (data.event === 'gift' || data.event === 'mega_gift'){
      const county = Object.values(counties).find(c => c.code === data.county);
      if (county) county.score = data.score;
      paintMap();
      if (data.top_supporters) renderSupporters(data.top_supporters);
      showGiftOverlay({
        user: data.user, county: data.title, raw: data.value,
        points: data.points, rarity: data.rarity || (data.event === 'mega_gift' ? 'legendary' : 'common'),
      });
      return;
    }

    if (data.event === 'status'){
      setConnectedUI(data.connected);
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

paintMap();
