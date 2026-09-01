// ====================================================================
// Cel mai tare judet din Romania - pagina de afisaj (fara controale).
// Se conecteaza prin WebSocket la server si redeseneaza harta, top 3
// sustinatori, top 3 judete si animatiile de comentariu/cadou live.
// Format 9:16 (letterbox automat, indiferent de dimensiunea ferestrei).
// ====================================================================

const BUCURESTI_ID = 'RO-B';
const stageWrap = document.getElementById('stageWrap');
const svg = document.getElementById('map-svg');
const pathGroup = document.getElementById('path-group');
const supportersBar = document.getElementById('supportersBar');
const countiesBar = document.getElementById('countiesBar');
const giftLayer = document.getElementById('giftLayer');

const statusPill = document.getElementById('statusPill');
const statusLabel = document.getElementById('statusLabel');
const viewersCount = document.getElementById('viewersCount');

let counties = {};      // id -> {id, code, title, score}

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

function maxScore(){ return Object.values(counties).reduce((m,c) => Math.max(m, c.score), 0); }
function rankTierClass(idx){ return idx < 5 ? `tier-${idx+1}` : ''; }

// ---------------- desenarea hartii: doar top 5 judete au culoare, restul gri (fara etichete) ----------------
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

  renderTopCounties(ranked, rankIndexById);
}

function initials(name){
  return (name || '?').replace(/[._]/g,' ').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase() || '?';
}
function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ---------------- top 3 sustinatori (persoane, primite de la server) ----------------
function renderSupporters(list){
  supportersBar.innerHTML = (list || []).slice(0, 3).map((s, idx) => `
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

// ---------------- top 3 judete (sub top 3 jucatori) + chip separat pt Bucuresti ----------------
// Bucuresti e prea mic pe harta reala ca sa se vada ceva pe el, asa ca
// primeste mereu propriul chip aici, in loc de un cerc suprapus pe harta.
function renderTopCounties(rankedCounties, rankIndexById){
  const top = (rankedCounties || []).filter(c => c.score > 0).slice(0, 3);
  let html = top.map((c, idx) => `
    <div class="county-mini r${idx+1}">
      <span class="cm-rank">${idx+1}</span>
      <span class="cm-name">${escapeHtml(c.title)}</span>
      <span class="cm-pts">${c.score} pct</span>
    </div>`).join('');

  const bucInTop3 = top.some(c => c.id === BUCURESTI_ID);
  if (!bucInTop3){
    const buc = counties[BUCURESTI_ID];
    const bucRank = (rankIndexById[BUCURESTI_ID] ?? 0) + 1;
    html += `
      <div class="county-mini buc">
        <span class="cm-icon">🏛</span>
        <span class="cm-name">București</span>
        <span class="cm-pts">${buc ? buc.score : 0} pct</span>
      </div>`;
  }
  countiesBar.innerHTML = html;
}

// ---------------- animatie mica la fiecare comentariu (numele langa judet) ----------------
function popCommentName(countyId, name, points){
  const el = document.getElementById(countyId);
  if (!el) return;
  const svgRect = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const bb = el.getBBox();
  const x = svgRect.left + (bb.x + bb.width/2 - vb.x) * (svgRect.width / vb.width);
  const y = svgRect.top + (bb.y - vb.y) * (svgRect.height / vb.height);
  const pop = document.createElement('div');
  pop.className = 'comment-pop';
  pop.innerHTML = `<span class="cp-plus">+${points}</span> ${escapeHtml(name)}`;
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
      if (county) popCommentName(county.id, data.user, data.points);
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
