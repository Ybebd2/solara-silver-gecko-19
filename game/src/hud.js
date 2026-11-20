// SOLARA — hud.js
// All 2D interface: wanted stars, health, ammo, cash, rank, mission panel
// with the timed-job clock, minimap, radio toast, messages, pause + map
// overlays, crew cooldowns, crosshair, start screen.

import { S, DISTRICTS, WORLD, WEAPONS, fmtCash, fmtClock, districtAt } from './config.js';
import { currentMission, missionDistance, missionTarget } from './missions.js';
import { cruisers, officers } from './police.js';

let els = {};
let minimap = null;
let mapCanvas = null;
let mapZoom = 1;
let mapPan = { x: 0, z: 0 };

export function buildHUD() {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div id="start-screen">
      <div class="title">SOLARA</div>
      <div class="subtitle">an open-world crime game · golden-hour coastal city</div>
      <div class="start-body">
        You are <b>Kai Mercer</b>. Lupe has work for you — 8 jobs across 7 districts.<br>
        Jack cars, lose the heat, climb from <b>ROOKIE</b> to <b>FIXER</b>.
      </div>
      <div class="controls-grid">
        <span>WASD</span><span>walk / drive</span>
        <span>Shift</span><span>sprint</span>
        <span>F</span><span>enter / jack car</span>
        <span>Click</span><span>fire VESPER pistol</span>
        <span>1–5</span><span>switch weapon</span>
        <span>Z / X / C</span><span>crew: Mara · Sully · Kiki</span>
        <span>R</span><span>radio station</span>
        <span>M</span><span>map · click to set waypoint</span>
        <span>F8 / F9</span><span>save / load</span>
        <span>P</span><span>pause</span>
      </div>
      <button id="start-btn">START ENGINE</button>
      <div class="start-foot">Wanted stars rise when you jack cars or hit cops. Lose the heat to drop them.</div>
    </div>
    <div id="top-left">
      <div id="cash">$250</div>
      <div id="rank">ROOKIE · 0/8 JOBS</div>
      <div id="district">DOWNTOWN</div>
      <div id="mission-panel">
        <div id="mission-title">NO JOB ACTIVE</div>
        <div id="mission-brief">Find the yellow beacon — press E to start the job.</div>
        <div id="mission-meta"><span id="mission-clock">--:--</span><span id="mission-dist"></span></div>
        <div id="mission-bar"><div id="mission-fill"></div></div>
      </div>
    </div>
    <div id="top-right">
      <div id="stars">☆☆☆☆☆</div>
      <div id="evade-wrap"><div id="evade-label">EVADING</div><div id="evade-bar"><div id="evade-fill"></div></div></div>
      <div id="health-wrap"><div id="health-label">HEALTH</div><div id="health-bar"><div id="health-fill"></div></div></div>
    </div>
    <div id="bottom-left">
      <div id="weapon">VESPER</div>
      <div id="ammo">12 / 48</div>
      <div id="crew">
        <span id="crew-mara">Z MARA</span>
        <span id="crew-sully">X SULLY</span>
        <span id="crew-kiki">C KIKI</span>
      </div>
    </div>
    <div id="bottom-right">
      <canvas id="minimap" width="220" height="220"></canvas>
      <div id="speed"></div>
    </div>
    <div id="crosshair">+</div>
    <div id="toast"></div>
    <div id="hint"></div>
    <div id="pause-screen"><div class="pause-title">PAUSED</div><div>P — resume · M — map · F8 — save</div></div>
    <div id="map-screen">
      <div class="map-title">SOLARA — CITY MAP</div>
      <canvas id="map-canvas" width="900" height="900"></canvas>
      <div class="map-foot">Click to set a waypoint · wheel to zoom · M to close</div>
    </div>
    <div id="busted-screen"><div class="busted-title">BUSTED</div><div>Kai got caught. Press F9 to load your last save.</div></div>
    <div id="debug"></div>
  `;
  els = {
    cash: document.getElementById('cash'),
    rank: document.getElementById('rank'),
    district: document.getElementById('district'),
    missionTitle: document.getElementById('mission-title'),
    missionBrief: document.getElementById('mission-brief'),
    missionClock: document.getElementById('mission-clock'),
    missionDist: document.getElementById('mission-dist'),
    missionFill: document.getElementById('mission-fill'),
    stars: document.getElementById('stars'),
    evadeWrap: document.getElementById('evade-wrap'),
    evadeFill: document.getElementById('evade-fill'),
    healthFill: document.getElementById('health-fill'),
    weapon: document.getElementById('weapon'),
    ammo: document.getElementById('ammo'),
    crewMara: document.getElementById('crew-mara'),
    crewSully: document.getElementById('crew-sully'),
    crewKiki: document.getElementById('crew-kiki'),
    speed: document.getElementById('speed'),
    toast: document.getElementById('toast'),
    hint: document.getElementById('hint'),
    crosshair: document.getElementById('crosshair'),
    startScreen: document.getElementById('start-screen'),
    pauseScreen: document.getElementById('pause-screen'),
    mapScreen: document.getElementById('map-screen'),
    bustedScreen: document.getElementById('busted-screen'),
    debug: document.getElementById('debug'),
  };
  minimap = document.getElementById('minimap');
  mapCanvas = document.getElementById('map-canvas');
  mapCanvas.addEventListener('click', (e) => {
    const r = mapCanvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width;
    const my = (e.clientY - r.top) / r.height;
    const half = WORLD.size / 2 / mapZoom;
    const wx = mapPan.x + (mx - 0.5) * 2 * half;
    const wz = mapPan.z + (my - 0.5) * 2 * half;
    S.waypoint = { x: Math.max(-320, Math.min(320, wx)), z: Math.max(-320, Math.min(320, wz)) };
    toast('Waypoint set — follow the yellow marker');
  });
  mapCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    mapZoom = Math.max(1, Math.min(4, mapZoom * (e.deltaY < 0 ? 1.15 : 0.87)));
  }, { passive: false });
  document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('start-screen').style.display = 'none';
    S.started = true;
  });
  return els;
}

export function toast(text, secs = 3) {
  els.toast.textContent = text;
  els.toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { els.toast.style.opacity = '0'; }, secs * 1000);
}

function drawCityMap(g, size, cx, cz, half, showPolice) {
  g.clearRect(0, 0, size, size);
  g.fillStyle = '#141a24';
  g.fillRect(0, 0, size, size);
  const toMap = (x, z) => [
    ((x - (cx - half)) / (2 * half)) * size,
    ((z - (cz - half)) / (2 * half)) * size,
  ];
  // ocean + beach
  g.fillStyle = '#1e6f8e';
  const [ox] = toMap(-320, 0);
  g.fillRect(0, 0, Math.max(0, toMap(WORLD.beachX, 0)[0]), size);
  g.fillStyle = '#e8cf9a';
  const [bx0] = toMap(WORLD.beachX - 18, 0);
  const [bx1] = toMap(WORLD.beachX + 18, 0);
  g.fillRect(bx0, 0, bx1 - bx0, size);
  // roads
  g.strokeStyle = '#4a4f5a';
  g.lineWidth = Math.max(2, size / 160);
  for (let c = -256; c <= 256; c += WORLD.roadGap) {
    let [x0, y0] = toMap(c, -320); let [x1, y1] = toMap(c, 320);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    [x0, y0] = toMap(-320, c); [x1, y1] = toMap(320, c);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
  // district labels
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.font = `bold ${Math.max(9, size / 34)}px Arial`;
  g.textAlign = 'center';
  for (const d of DISTRICTS) {
    const [dx, dy] = toMap(d.x, d.z);
    if (dx < -20 || dx > size + 20 || dy < -20 || dy > size + 20) continue;
    g.fillText(d.name, dx, dy);
  }
  // waypoint
  if (S.waypoint) {
    const [wx, wy] = toMap(S.waypoint.x, S.waypoint.z);
    g.fillStyle = '#ffd23a';
    g.beginPath(); g.arc(wx, wy, 7, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffd23a'; g.lineWidth = 2;
    g.beginPath(); g.arc(wx, wy, 12, 0, Math.PI * 2); g.stroke();
  }
  // mission target
  const t = missionTarget();
  if (t && currentMission()) {
    const [tx, ty] = toMap(t[0], t[1]);
    g.fillStyle = '#ffd23a';
    g.beginPath(); g.moveTo(tx, ty - 10); g.lineTo(tx + 8, ty + 7); g.lineTo(tx - 8, ty + 7); g.closePath(); g.fill();
  }
  // police (only when Kiki's lookout is live, or on the big map always when wanted)
  if (showPolice) {
    g.fillStyle = '#ff4040';
    for (const c of cruisers) {
      const [px, py] = toMap(c.x, c.z);
      g.beginPath(); g.arc(px, py, 4, 0, Math.PI * 2); g.fill();
    }
    for (const o of officers) {
      const [px, py] = toMap(o.x, o.z);
      g.fillRect(px - 3, py - 3, 6, 6);
    }
  }
  // player arrow
  const [px, py] = toMap(S.px, S.pz);
  g.save();
  g.translate(px, py);
  g.rotate(Math.atan2(Math.sin(S.heading), Math.cos(S.heading)));
  g.fillStyle = '#69f0ae';
  g.beginPath(); g.moveTo(0, -9); g.lineTo(7, 8); g.lineTo(-7, 8); g.closePath(); g.fill();
  g.restore();
}

export function hudTick(dt) {
  if (!els.cash) return;
  els.cash.textContent = fmtCash(S.cash);
  els.rank.textContent = S.rank + ' · ' + S.jobsDone + '/8 JOBS';
  const d = districtAt(S.px, S.pz);
  els.district.textContent = d ? d.name : 'SOLARA';

  // wanted stars — big and readable
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < S.wanted ? '★' : '☆';
  els.stars.textContent = stars;
  els.stars.style.color = S.wanted >= 3 ? '#ff4040' : '#ffd23a';
  els.evadeWrap.style.visibility = S.wanted > 0 ? 'visible' : 'hidden';
  els.evadeFill.style.width = S.evading + '%';
  els.healthFill.style.width = S.health + '%';
  els.healthFill.style.background = S.health > 50 ? '#69f0ae' : S.health > 25 ? '#ffb74d' : '#ff5252';

  // weapon + ammo
  const w = WEAPONS[S.weaponIdx];
  els.weapon.textContent = w.name + (S.inCar ? ' · DRIVING' : '');
  els.ammo.textContent = w.kind === 'melee' ? '—' : S.ammo + ' / ' + S.reserve;
  els.ammo.style.color = S.ammo <= 3 && w.kind !== 'melee' ? '#ff5252' : '#fff';

  // crew cooldowns
  const cd = (name, el, key) => {
    const left = S.crewCd[key];
    el.textContent = (name + (left > 0 ? ' ' + Math.ceil(left) + 's' : ' READY'));
    el.style.opacity = left > 0 ? '0.45' : '1';
  };
  cd('Z MARA', els.crewMara, 'MARA');
  cd('X SULLY', els.crewSully, 'SULLY');
  cd('C KIKI', els.crewKiki, 'KIKI');

  // mission panel + timed-job clock
  const m = currentMission();
  if (!m) {
    els.missionTitle.textContent = 'ALL JOBS DONE — FIXER OF SOLARA';
    els.missionBrief.textContent = 'Free roam. Jack cars, dodge the heat, enjoy the golden hour.';
    els.missionClock.textContent = '--:--';
    els.missionDist.textContent = '';
    els.missionFill.style.width = '100%';
  } else if (S.missionActive) {
    els.missionTitle.textContent = 'JOB ' + (S.missionIdx + 1) + '/8 — ' + m.title.toUpperCase() + ' · ' + m.giver;
    els.missionBrief.textContent = m.brief;
    els.missionClock.textContent = fmtClock(S.missionTime);
    els.missionClock.style.color = S.missionTime < 30 ? '#ff5252' : '#ffd23a';
    els.missionDist.textContent = Math.round(missionDistance()) + 'm' + (S.missionHold > 0 ? ' · HOLD ' + Math.ceil(5 - S.missionHold) + 's' : '');
    els.missionFill.style.width = (100 * S.missionTime / m.time) + '%';
  } else {
    els.missionTitle.textContent = 'NEXT JOB — ' + m.title.toUpperCase() + ' · ' + m.giver;
    els.missionBrief.textContent = m.brief + ' (go to the yellow beacon, press E)';
    els.missionClock.textContent = fmtClock(m.time);
    els.missionClock.style.color = '#fff';
    els.missionDist.textContent = Math.round(missionDistance()) + 'm';
    els.missionFill.style.width = '0%';
  }

  // speed
  els.speed.textContent = S.inCar ? Math.round(Math.abs(S.carSpeed) * 3.6) + ' km/h' : '';
  els.crosshair.style.display = S.inCar || S.started ? 'block' : 'none';

  // contextual hint
  let hint = '';
  if (!S.started) hint = '';
  else if (S.over) hint = '';
  else if (S.inCar) hint = 'W/S drive · A/D steer · F exit · Click shoot';
  else hint = 'WASD walk · F jack car · Click fire · E start job · M map';
  els.hint.textContent = hint;

  // message toast from game events
  if (S.message && S.time < S.messageUntil) {
    els.toast.textContent = S.message;
    els.toast.style.opacity = '1';
  } else if (!S.message || S.time >= S.messageUntil) {
    if (els.toast.textContent === S.message) els.toast.style.opacity = '0';
  }

  // overlays
  els.pauseScreen.style.display = S.paused ? 'flex' : 'none';
  els.mapScreen.style.display = S.mapOpen ? 'flex' : 'none';
  els.bustedScreen.style.display = S.over ? 'flex' : 'none';

  // minimap
  if (minimap) {
    const g = minimap.getContext('2d');
    drawCityMap(g, 220, S.px, S.pz, 170, S.time < S.lookoutUntil);
  }
  // big map
  if (S.mapOpen && mapCanvas) {
    const g = mapCanvas.getContext('2d');
    drawCityMap(g, 900, mapPan.x, mapPan.z, (WORLD.size / 2 + 40) / mapZoom, true);
  }
}

export function resetMapView() {
  mapZoom = 1; mapPan = { x: 0, z: 0 };
}
