// SOLARA — hud.js
// All 2D interface: wanted stars, health, ammo, cash, rank, mission panel
// with the timed-job clock, minimap, radio toast, messages, pause + map
// overlays, crew cooldowns, crosshair, start screen.

import { S, DISTRICTS, WORLD, WEAPONS, RADIO, fmtCash, fmtClock, districtAt } from './config.js';
import { currentMission, missionDistance, missionTarget } from './missions.js';
import { cruisers, officers, policeUnits } from './police.js';
import { nearestCar } from './vehicles.js';
import { geckoCount, geckoTotal, geckoSpots } from './world.js';

let els = {};
let minimap = null;
let mapCanvas = null;
let mapZoom = 1;
let mapPan = { x: 0, z: 0 };

export function buildHUD(opts = {}) {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div id="start-screen">
      <div class="title">SOLARA</div>
      <div class="subtitle">ACT I — FIRST FIX · an open-world crime game</div>
      <div class="start-body">
        You are <b>Kai Mercer</b>. Lupe has work for you — 8 jobs across 7 districts.<br>
        Jack cars, lose the heat, climb from <b>ROOKIE</b> to <b>FIXER</b>.<br>
        20 <b>Golden Geckos</b> are hidden around the city — find them all.
      </div>
      <div class="start-btns">
        <button id="start-btn">NEW GAME</button>
        <button id="load-btn" class="menu-btn">LOAD GAME</button>
        <button id="settings-btn" class="menu-btn">SETTINGS</button>
      </div>
      <div id="settings-panel" style="display:none">
        <label><input type="checkbox" id="set-sound" checked> Sound</label>
        <label><input type="checkbox" id="set-radio" checked> Radio</label>
        <label><input type="checkbox" id="set-hud" checked> Full HUD</label>
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
        <span>F2 / F8</span><span>quick save / save</span>
        <span>F9</span><span>autopilot (in car)</span>
        <span>P</span><span>pause</span>
      </div>
      <div class="start-foot">Wanted stars rise when you jack cars or hit cops. Lose the heat to drop them.</div>
    </div>
    <div id="top-left">
      <div id="cash">$250</div>
      <div id="rank">ROOKIE · 0/8 JOBS</div>
      <div id="rp-bar"><div id="rp-fill"></div></div>
      <div id="district">DOWNTOWN · GRIP 30%</div>
      <div id="geckos">🦎 GECKOS 0/20</div>
      <div id="mission-panel">
        <div id="mission-title">NO JOB ACTIVE</div>
        <div id="mission-brief">Find the yellow beacon — press E to start the job.</div>
        <div id="mission-meta"><span id="mission-clock">--:--</span><span id="mission-dist"></span></div>
        <div id="mission-segs"><span></span><span></span><span></span><span></span></div>
      </div>
      <div id="response-panel" style="display:none">
        <div id="response-title">POLICE RESPONSE</div>
        <div id="response-list"></div>
      </div>
    </div>
    <div id="top-right">
      <div id="stars">☆☆☆☆☆</div>
      <div id="seen-badge" style="display:none">HIDDEN</div>
      <div id="evade-wrap"><div id="evade-label">EVADING</div><div id="evade-bar"><div id="evade-fill"></div></div></div>
      <div id="health-wrap"><div id="health-label">HEALTH</div><div id="health-bar"><div id="health-fill"></div></div></div>
      <div id="armour-wrap"><div id="armour-label">ARMOUR</div><div id="armour-bar"><div id="armour-fill"></div></div></div>
    </div>
    <div id="bottom-left">
      <div id="weapon">VESPER</div>
      <div id="ammo">12 / 48</div>
      <div id="vehicle-hud" style="display:none">
        <div id="car-name">COMET</div>
        <div id="car-cond"><div id="car-cond-fill"></div></div>
        <div id="car-line"><span id="car-speed">0 km/h</span> · <span id="car-gear">G1</span> · <span id="car-radio">SOLARA 98.3</span></div>
        <div id="car-song">Bright Day — Kai &amp; The Coast</div>
      </div>
      <div id="crew">
        <span id="crew-mara">Z MARA</span>
        <span id="crew-sully">X SULLY</span>
        <span id="crew-kiki">C KIKI</span>
      </div>
    </div>
    <div id="dialogue" style="display:none">
      <canvas id="portrait" width="72" height="72"></canvas>
      <div id="dialogue-text"><b id="dialogue-name">LUPE</b><span id="dialogue-line"></span></div>
    </div>
    <div id="jack-prompt" style="display:none">Press <b>F</b> to jack this car</div>
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
    rpFill: document.getElementById('rp-fill'),
    district: document.getElementById('district'),
    geckos: document.getElementById('geckos'),
    missionTitle: document.getElementById('mission-title'),
    missionBrief: document.getElementById('mission-brief'),
    missionClock: document.getElementById('mission-clock'),
    missionDist: document.getElementById('mission-dist'),
    missionSegs: document.querySelectorAll('#mission-segs span'),
    responsePanel: document.getElementById('response-panel'),
    responseList: document.getElementById('response-list'),
    stars: document.getElementById('stars'),
    seenBadge: document.getElementById('seen-badge'),
    evadeWrap: document.getElementById('evade-wrap'),
    evadeFill: document.getElementById('evade-fill'),
    healthFill: document.getElementById('health-fill'),
    armourFill: document.getElementById('armour-fill'),
    weapon: document.getElementById('weapon'),
    ammo: document.getElementById('ammo'),
    vehicleHud: document.getElementById('vehicle-hud'),
    carName: document.getElementById('car-name'),
    carCondFill: document.getElementById('car-cond-fill'),
    carSpeed: document.getElementById('car-speed'),
    carGear: document.getElementById('car-gear'),
    carRadio: document.getElementById('car-radio'),
    carSong: document.getElementById('car-song'),
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
    dialogue: document.getElementById('dialogue'),
    dialogueName: document.getElementById('dialogue-name'),
    dialogueLine: document.getElementById('dialogue-line'),
    portrait: document.getElementById('portrait'),
    jackPrompt: document.getElementById('jack-prompt'),
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
    showDialogue('LUPE', 'Welcome back to Solara, Kai. Eight jobs, one city — make it yours.', 'Eight jobs? Then let’s start with the first one, Lupe. I’m ready.');
    S.dialogueUntil = S.time + 9;
  });
  document.getElementById('load-btn').addEventListener('click', () => {
    if (opts.onLoad) opts.onLoad();
    document.getElementById('start-screen').style.display = 'none';
    S.started = true;
  });
  document.getElementById('settings-btn').addEventListener('click', () => {
    const p = document.getElementById('settings-panel');
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('set-sound').addEventListener('change', (e) => { S.soundOn = e.target.checked; });
  document.getElementById('set-radio').addEventListener('change', (e) => { S.radioOn = e.target.checked; });
  document.getElementById('set-hud').addEventListener('change', (e) => {
    document.getElementById('top-left').style.display = e.target.checked ? '' : 'none';
    document.getElementById('top-right').style.display = e.target.checked ? '' : 'none';
  });
  return els;
}

// Character portraits: simple drawn faces, one colour per character.
const PORTRAITS = {
  LUPE: { skin: '#c98e6a', hair: '#1a1210', bg: '#ff2e88', initial: 'L' },
  SULLY: { skin: '#8a5a3a', hair: '#3a2a1a', bg: '#4fc3f7', initial: 'S' },
  MARCO: { skin: '#e8b98a', hair: '#6b4a2a', bg: '#ffb74d', initial: 'M' },
  BRANDT: { skin: '#c98e6a', hair: '#888888', bg: '#9b59b6', initial: 'B' },
  AURORA: { skin: '#e8b98a', hair: '#ffd23a', bg: '#69f0ae', initial: 'A' },
  KAI: { skin: '#c98e6a', hair: '#2a1a0a', bg: '#22d3ee', initial: 'K' },
};

// Two-way dialogue: showDialogue(name, line, reply?) — when a reply is
// given, Kai answers after ~4.5 s so it reads as a conversation, not a
// monologue. The swap is driven from hudTick so it respects game time.
let replyAt = 0, replyLine = '', replyShown = false;
export function showDialogue(name, line, reply) {
  if (!els.dialogue) return;
  replyLine = reply || '';
  replyAt = reply ? S.time + 4.5 : 0;
  replyShown = false;
  drawDialogue(name, line);
}

function drawDialogue(name, line) {
  els.dialogueName.textContent = name;
  els.dialogueLine.textContent = line;
  els.dialogue.style.display = 'flex';
  const p = PORTRAITS[name] || PORTRAITS.LUPE;
  const g = els.portrait.getContext('2d');
  g.fillStyle = p.bg; g.fillRect(0, 0, 72, 72);
  g.fillStyle = p.skin;
  g.beginPath(); g.arc(36, 38, 22, 0, Math.PI * 2); g.fill();
  g.fillStyle = p.hair;
  g.beginPath(); g.arc(36, 28, 22, Math.PI, 0); g.fill();
  g.fillStyle = '#1a1210';
  g.beginPath(); g.arc(28, 38, 3, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(44, 38, 3, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#1a1210'; g.lineWidth = 2;
  g.beginPath(); g.arc(36, 46, 8, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
}

export function toast(text, secs = 3.5) {
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
  // golden gecko collectibles (untaken only, small gold dots)
  g.fillStyle = '#ffd23a';
  for (const sp of geckoSpots()) {
    if (sp.taken) continue;
    const [gx, gy] = toMap(sp.x, sp.z);
    g.beginPath(); g.arc(gx, gy, 3, 0, Math.PI * 2); g.fill();
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
  // search grid: red dashed circle around the player while the heat is on
  if (S.wanted > 0) {
    const [px, py] = toMap(S.px, S.pz);
    const r = (S.seen ? 90 : 140) / (2 * half) * size;
    g.strokeStyle = S.seen ? 'rgba(255,64,64,0.9)' : 'rgba(255,210,58,0.8)';
    g.setLineDash([6, 5]);
    g.lineWidth = 2;
    g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(255,64,64,0.08)';
    g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
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
  els.rpFill.style.width = (100 * S.jobsDone / 8) + '%';
  const d = districtAt(S.px, S.pz);
  els.district.textContent = (d ? d.name : 'SOLARA') + ' · GRIP ' + (d ? (d.grip || 50) : 50) + '%';
  els.geckos.textContent = '🦎 GECKOS ' + geckoCount() + '/' + geckoTotal();

  // wanted stars — gold when gained
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < S.wanted ? '★' : '☆';
  els.stars.textContent = stars;
  els.stars.style.color = S.wanted >= 3 ? '#ff4040' : '#ffd23a';
  // HIDDEN (blue, unseen) / IN SIGHT (red, seen) badge
  if (S.wanted > 0) {
    els.seenBadge.style.display = 'block';
    els.seenBadge.textContent = S.seen ? 'IN SIGHT' : 'HIDDEN';
    els.seenBadge.style.background = S.seen ? '#c62828' : '#1565c0';
  } else els.seenBadge.style.display = 'none';
  els.evadeWrap.style.visibility = S.wanted > 0 ? 'visible' : 'hidden';
  els.evadeFill.style.width = S.evading + '%';
  els.healthFill.style.width = S.health + '%';
  els.healthFill.style.background = S.health > 50 ? '#69f0ae' : S.health > 25 ? '#ffb74d' : '#ff5252';
  els.armourFill.style.width = (S.armour || 0) + '%';

  // police RESPONSE panel: unit name + distance + status
  if (S.wanted > 0) {
    els.responsePanel.style.display = 'block';
    const units = policeUnits();
    els.responseList.innerHTML = units.map((u) =>
      '<div class="resp-row"><span class="resp-name">' + u.name + '</span>' +
      '<span class="resp-dist">' + (u.dist > 0 ? u.dist + 'm' : 'AIR') + '</span>' +
      '<span class="resp-status ' + u.status.toLowerCase() + '">' + u.status + '</span></div>'
    ).join('');
  } else els.responsePanel.style.display = 'none';

  // weapon + ammo
  const w = WEAPONS[S.weaponIdx];
  els.weapon.textContent = w.name + (S.inCar ? ' · DRIVING' : '');
  els.ammo.textContent = w.kind === 'melee' ? '—' : S.ammo + ' / ' + S.reserve;
  els.ammo.style.color = S.ammo <= 3 && w.kind !== 'melee' ? '#ff5252' : '#fff';

  // vehicle HUD: car name + condition + speed + gear + radio + song
  if (S.inCar && S.car) {
    els.vehicleHud.style.display = 'block';
    els.carName.textContent = S.car.name || 'COMET';
    els.carCondFill.style.width = Math.max(0, S.car.health || 0) + '%';
    els.carCondFill.style.background = (S.car.health || 0) > 50 ? '#69f0ae' : (S.car.health || 0) > 25 ? '#ffb74d' : '#ff5252';
    const kmh = Math.round(Math.abs(S.carSpeed || 0) * 3.6);
    els.carSpeed.textContent = kmh + ' km/h';
    els.carGear.textContent = 'G' + (kmh < 30 ? 1 : kmh < 60 ? 2 : kmh < 90 ? 3 : kmh < 120 ? 4 : 5);
    const st = RADIO[S.station];
    els.carRadio.textContent = st.name + (S.radioOn ? '' : ' · OFF');
    els.carSong.textContent = S.radioOn ? st.song : '—';
  } else els.vehicleHud.style.display = 'none';

  // carjack prompt: "Press F" when a car is close
  if (!S.inCar && S.started && !S.over) {
    const cand = nearestCar(S.px, S.pz);
    els.jackPrompt.style.display = cand ? 'block' : 'none';
  } else els.jackPrompt.style.display = 'none';

  // dialogue box: shows until dialogueUntil, with the character portrait.
  // Two-way: when a reply is queued and its time arrives, swap to Kai.
  if (replyLine && !replyShown && S.time >= replyAt) {
    replyShown = true;
    drawDialogue('KAI', replyLine);
  }
  if (S.started && S.time < S.dialogueUntil) els.dialogue.style.display = 'flex';
  else els.dialogue.style.display = 'none';

  // crew cooldowns
  const cd = (name, el, key) => {
    const left = S.crewCd[key];
    el.textContent = (name + (left > 0 ? ' ' + Math.ceil(left) + 's' : ' READY'));
    el.style.opacity = left > 0 ? '0.45' : '1';
  };
  cd('Z MARA', els.crewMara, 'MARA');
  cd('X SULLY', els.crewSully, 'SULLY');
  cd('C KIKI', els.crewKiki, 'KIKI');

  // mission panel + segmented stage progress bar (4 segments)
  const setSegs = (frac) => {
    const filled = Math.round(frac * 4);
    els.missionSegs.forEach((sp, i) => {
      sp.style.background = i < filled ? '#ffd23a' : 'rgba(255,255,255,.18)';
    });
  };
  const m = currentMission();
  if (!m) {
    els.missionTitle.textContent = 'ALL JOBS DONE — FIXER OF SOLARA';
    els.missionBrief.textContent = 'Free roam. Jack cars, dodge the heat, hunt the Golden Geckos.';
    els.missionClock.textContent = '--:--';
    els.missionDist.textContent = '';
    setSegs(1);
  } else if (S.missionActive) {
    els.missionTitle.textContent = 'JOB ' + (S.missionIdx + 1) + '/8 — ' + m.title.toUpperCase() + ' · ' + m.giver;
    els.missionBrief.textContent = m.brief;
    els.missionClock.textContent = fmtClock(S.missionTime);
    els.missionClock.style.color = S.missionTime < 30 ? '#ff5252' : '#ffd23a';
    els.missionDist.textContent = Math.round(missionDistance()) + 'm' + (S.missionHold > 0 ? ' · HOLD ' + Math.ceil(5 - S.missionHold) + 's' : '');
    setSegs(1 - S.missionTime / m.time);
  } else {
    els.missionTitle.textContent = 'NEXT JOB — ' + m.title.toUpperCase() + ' · ' + m.giver;
    els.missionBrief.textContent = m.brief + ' (go to the yellow beacon, press E)';
    els.missionClock.textContent = fmtClock(m.time);
    els.missionClock.style.color = '#fff';
    els.missionDist.textContent = Math.round(missionDistance()) + 'm';
    setSegs(0);
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
