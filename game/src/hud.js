// SOLARA — hud.js
// All 2D interface: start screen, cash/rank/stars, mission panel, police
// response panel, vehicle HUD, crew cooldowns, two-way dialogue, minimap,
// map screen, toasts, pause/busted overlays, debug readout.

import { S, DISTRICTS, WORLD, WEAPONS, RADIO, fmtCash, fmtClock, districtAt } from './config.js';
import { currentMission, missionDistance, missionTarget } from './missions.js';
import { cruisers, officers, policeUnits } from './police.js';
import { nearestCar } from './vehicles.js';
import { geckoCount, geckoTotal, geckoSpots } from './world.js';

let el = {};
let mini = null;
let bigMap = null;
let zoom = 1;
let pan = { x: 0, z: 0 };

export function buildHUD(opts = {}) {
  document.getElementById('hud').innerHTML = `
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
  const grab = (id) => document.getElementById(id);
  el = {
    cash: grab('cash'), rank: grab('rank'), rpFill: grab('rp-fill'),
    district: grab('district'), geckos: grab('geckos'),
    missionTitle: grab('mission-title'), missionBrief: grab('mission-brief'),
    missionClock: grab('mission-clock'), missionDist: grab('mission-dist'),
    missionSegs: document.querySelectorAll('#mission-segs span'),
    responsePanel: grab('response-panel'), responseList: grab('response-list'),
    stars: grab('stars'), seenBadge: grab('seen-badge'),
    evadeWrap: grab('evade-wrap'), evadeFill: grab('evade-fill'),
    healthFill: grab('health-fill'), armourFill: grab('armour-fill'),
    weapon: grab('weapon'), ammo: grab('ammo'),
    vehicleHud: grab('vehicle-hud'), carName: grab('car-name'),
    carCondFill: grab('car-cond-fill'), carSpeed: grab('car-speed'),
    carGear: grab('car-gear'), carRadio: grab('car-radio'), carSong: grab('car-song'),
    crewMara: grab('crew-mara'), crewSully: grab('crew-sully'), crewKiki: grab('crew-kiki'),
    speed: grab('speed'), toast: grab('toast'), hint: grab('hint'),
    crosshair: grab('crosshair'), startScreen: grab('start-screen'),
    pauseScreen: grab('pause-screen'), mapScreen: grab('map-screen'),
    bustedScreen: grab('busted-screen'), debug: grab('debug'),
    dialogue: grab('dialogue'), dialogueName: grab('dialogue-name'),
    dialogueLine: grab('dialogue-line'), portrait: grab('portrait'),
    jackPrompt: grab('jack-prompt'),
  };
  mini = grab('minimap');
  bigMap = grab('map-canvas');
  bigMap.addEventListener('click', (e) => {
    const r = bigMap.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width;
    const my = (e.clientY - r.top) / r.height;
    const half = (WORLD.size / 2 + 40) / zoom;
    const wx = pan.x + (mx - 0.5) * 2 * half;
    const wz = pan.z + (my - 0.5) * 2 * half;
    S.waypoint = { x: Math.max(-320, Math.min(320, wx)), z: Math.max(-320, Math.min(320, wz)) };
    toast('Waypoint set — follow the yellow marker');
  });
  bigMap.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom = Math.max(1, Math.min(4, zoom * (e.deltaY < 0 ? 1.15 : 0.87)));
  }, { passive: false });
  grab('start-btn').addEventListener('click', () => {
    grab('start-screen').style.display = 'none';
    S.started = true;
    showDialogue('LUPE', 'Welcome back to Solara, Kai. Eight jobs, one city — make it yours.',
      'Eight jobs? Then let’s start with the first one, Lupe. I’m ready.');
    S.dialogueUntil = S.time + 9;
  });
  grab('load-btn').addEventListener('click', () => {
    if (opts.onLoad) opts.onLoad();
    grab('start-screen').style.display = 'none';
    S.started = true;
  });
  grab('settings-btn').addEventListener('click', () => {
    const p = grab('settings-panel');
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
  });
  grab('set-sound').addEventListener('change', (e) => { S.soundOn = e.target.checked; });
  grab('set-radio').addEventListener('change', (e) => { S.radioOn = e.target.checked; });
  grab('set-hud').addEventListener('change', (e) => {
    grab('top-left').style.display = e.target.checked ? '' : 'none';
    grab('top-right').style.display = e.target.checked ? '' : 'none';
  });
  return el;
}

// Drawn portraits: one colour per character, face + hair + eyes.
const FACES = {
  LUPE: { skin: '#c98e6a', hair: '#1a1210', bg: '#ff2e88', initial: 'L' },
  SULLY: { skin: '#8a5a3a', hair: '#3a2a1a', bg: '#4fc3f7', initial: 'S' },
  MARCO: { skin: '#e8b98a', hair: '#6b4a2a', bg: '#ffb74d', initial: 'M' },
  BRANDT: { skin: '#c98e6a', hair: '#888888', bg: '#9b59b6', initial: 'B' },
  AURORA: { skin: '#e8b98a', hair: '#ffd23a', bg: '#69f0ae', initial: 'A' },
  KAI: { skin: '#c98e6a', hair: '#2a1a0a', bg: '#22d3ee', initial: 'K' },
};

// Two-way dialogue: showDialogue(name, line, reply?) — when a reply is
// given, Kai answers after ~4.5 s so it reads as a conversation.
let pendingReply = '';
let replyAt = 0;
let replyDone = false;
export function showDialogue(name, line, reply) {
  if (!el.dialogue) return;
  pendingReply = reply || '';
  replyAt = reply ? S.time + 4.5 : 0;
  replyDone = false;
  paintDialogue(name, line);
}

function paintDialogue(name, line) {
  el.dialogueName.textContent = name;
  el.dialogueLine.textContent = line;
  el.dialogue.style.display = 'flex';
  const p = FACES[name] || FACES.LUPE;
  const g = el.portrait.getContext('2d');
  g.fillStyle = p.bg;
  g.fillRect(0, 0, 72, 72);
  g.fillStyle = p.skin;
  g.beginPath(); g.arc(36, 38, 22, 0, Math.PI * 2); g.fill();
  g.fillStyle = p.hair;
  g.beginPath(); g.arc(36, 28, 22, Math.PI, 0); g.fill();
  g.fillStyle = '#1a1210';
  g.beginPath(); g.arc(28, 38, 3, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(44, 38, 3, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#1a1210';
  g.lineWidth = 2;
  g.beginPath(); g.arc(36, 46, 8, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
}

export function toast(text, secs = 3.5) {
  el.toast.textContent = text;
  el.toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.toast.style.opacity = '0'; }, secs * 1000);
}

function drawMap(g, size, cx, cz, half, showPolice) {
  g.clearRect(0, 0, size, size);
  g.fillStyle = '#141a24';
  g.fillRect(0, 0, size, size);
  const toMap = (x, z) => [
    ((x - (cx - half)) / (2 * half)) * size,
    ((z - (cz - half)) / (2 * half)) * size,
  ];
  // ocean + beach
  g.fillStyle = '#1e6f8e';
  g.fillRect(0, 0, Math.max(0, toMap(WORLD.beachX, 0)[0]), size);
  g.fillStyle = '#e8cf9a';
  const bx0 = toMap(WORLD.beachX - 18, 0)[0];
  const bx1 = toMap(WORLD.beachX + 18, 0)[0];
  g.fillRect(bx0, 0, bx1 - bx0, size);
  // roads
  g.strokeStyle = '#4a4f5a';
  g.lineWidth = Math.max(2, size / 160);
  for (let c = -256; c <= 256; c += WORLD.roadGap) {
    let a = toMap(c, -320); let b = toMap(c, 320);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    a = toMap(-320, c); b = toMap(320, c);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
  // district labels
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.font = `bold ${Math.max(9, size / 34)}px Arial`;
  g.textAlign = 'center';
  for (const d of DISTRICTS) {
    const p = toMap(d.x, d.z);
    if (p[0] < -20 || p[0] > size + 20 || p[1] < -20 || p[1] > size + 20) continue;
    g.fillText(d.name, p[0], p[1]);
  }
  // waypoint
  if (S.waypoint) {
    const p = toMap(S.waypoint.x, S.waypoint.z);
    g.fillStyle = '#ffd23a';
    g.beginPath(); g.arc(p[0], p[1], 7, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffd23a';
    g.lineWidth = 2;
    g.beginPath(); g.arc(p[0], p[1], 12, 0, Math.PI * 2); g.stroke();
  }
  // mission target marker
  const t = missionTarget();
  if (t && currentMission()) {
    const p = toMap(t[0], t[1]);
    g.fillStyle = '#ffd23a';
    g.beginPath(); g.moveTo(p[0], p[1] - 10); g.lineTo(p[0] + 8, p[1] + 7); g.lineTo(p[0] - 8, p[1] + 7); g.closePath(); g.fill();
  }
  // golden geckos left to find (small gold dots)
  g.fillStyle = '#ffd23a';
  for (const sp of geckoSpots()) {
    if (sp.taken) continue;
    const p = toMap(sp.x, sp.z);
    g.beginPath(); g.arc(p[0], p[1], 3, 0, Math.PI * 2); g.fill();
  }
  // police blips (minimap only while Kiki's lookout runs; big map always)
  if (showPolice) {
    g.fillStyle = '#ff4040';
    for (const c of cruisers) {
      const p = toMap(c.x, c.z);
      g.beginPath(); g.arc(p[0], p[1], 4, 0, Math.PI * 2); g.fill();
    }
    for (const o of officers) {
      const p = toMap(o.x, o.z);
      g.fillRect(p[0] - 3, p[1] - 3, 6, 6);
    }
  }
  // search grid while wanted
  if (S.wanted > 0) {
    const p = toMap(S.px, S.pz);
    const r = (S.seen ? 90 : 140) / (2 * half) * size;
    g.strokeStyle = S.seen ? 'rgba(255,64,64,0.9)' : 'rgba(255,210,58,0.8)';
    g.setLineDash([6, 5]);
    g.lineWidth = 2;
    g.beginPath(); g.arc(p[0], p[1], r, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(255,64,64,0.08)';
    g.beginPath(); g.arc(p[0], p[1], r, 0, Math.PI * 2); g.fill();
  }
  // player arrow
  const p = toMap(S.px, S.pz);
  g.save();
  g.translate(p[0], p[1]);
  g.rotate(Math.atan2(Math.sin(S.heading), Math.cos(S.heading)));
  g.fillStyle = '#69f0ae';
  g.beginPath(); g.moveTo(0, -9); g.lineTo(7, 8); g.lineTo(-7, 8); g.closePath(); g.fill();
  g.restore();
}

export function hudTick(dt) {
  if (!el.cash) return;
  el.cash.textContent = fmtCash(S.cash);
  el.rank.textContent = S.rank + ' · ' + S.jobsDone + '/8 JOBS';
  el.rpFill.style.width = (100 * S.jobsDone / 8) + '%';
  const d = districtAt(S.px, S.pz);
  el.district.textContent = (d ? d.name : 'SOLARA') + ' · GRIP ' + (d ? (d.grip || 50) : 50) + '%';
  el.geckos.textContent = '🦎 GECKOS ' + geckoCount() + '/' + geckoTotal();

  // wanted stars
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < S.wanted ? '★' : '☆';
  el.stars.textContent = stars;
  el.stars.style.color = S.wanted >= 3 ? '#ff4040' : '#ffd23a';
  if (S.wanted > 0) {
    el.seenBadge.style.display = 'block';
    el.seenBadge.textContent = S.seen ? 'IN SIGHT' : 'HIDDEN';
    el.seenBadge.style.background = S.seen ? '#c62828' : '#1565c0';
  } else el.seenBadge.style.display = 'none';
  el.evadeWrap.style.visibility = S.wanted > 0 ? 'visible' : 'hidden';
  el.evadeFill.style.width = S.evading + '%';
  el.healthFill.style.width = S.health + '%';
  el.healthFill.style.background = S.health > 50 ? '#69f0ae' : S.health > 25 ? '#ffb74d' : '#ff5252';
  el.armourFill.style.width = (S.armour || 0) + '%';

  // police RESPONSE panel
  if (S.wanted > 0) {
    el.responsePanel.style.display = 'block';
    el.responseList.innerHTML = policeUnits().map((u) =>
      '<div class="resp-row"><span class="resp-name">' + u.name + '</span>' +
      '<span class="resp-dist">' + u.dist + 'm</span>' +
      '<span class="resp-status ' + u.status.toLowerCase() + '">' + u.status + '</span></div>'
    ).join('');
  } else el.responsePanel.style.display = 'none';

  // weapon + ammo
  const w = WEAPONS[S.weaponIdx];
  el.weapon.textContent = w.name + (S.inCar ? ' · DRIVING' : '');
  el.ammo.textContent = w.kind === 'melee' ? '—' : S.ammo + ' / ' + S.reserve;
  el.ammo.style.color = S.ammo <= 3 && w.kind !== 'melee' ? '#ff5252' : '#fff';

  // vehicle HUD
  if (S.inCar && S.car) {
    el.vehicleHud.style.display = 'block';
    el.carName.textContent = S.car.name || 'COMET';
    el.carCondFill.style.width = Math.max(0, S.car.health || 0) + '%';
    el.carCondFill.style.background = (S.car.health || 0) > 50 ? '#69f0ae' : (S.car.health || 0) > 25 ? '#ffb74d' : '#ff5252';
    const kmh = Math.round(Math.abs(S.carSpeed || 0) * 3.6);
    el.carSpeed.textContent = kmh + ' km/h';
    el.carGear.textContent = 'G' + (kmh < 30 ? 1 : kmh < 60 ? 2 : kmh < 90 ? 3 : kmh < 120 ? 4 : 5);
    const st = RADIO[S.station];
    el.carRadio.textContent = st.name + (S.radioOn ? '' : ' · OFF');
    el.carSong.textContent = S.radioOn ? st.song : '—';
  } else el.vehicleHud.style.display = 'none';

  // carjack prompt
  if (!S.inCar && S.started && !S.over) {
    el.jackPrompt.style.display = nearestCar(S.px, S.pz) ? 'block' : 'none';
  } else el.jackPrompt.style.display = 'none';

  // two-way dialogue: Kai's reply swaps in when its time arrives
  if (pendingReply && !replyDone && S.time >= replyAt) {
    replyDone = true;
    paintDialogue('KAI', pendingReply);
  }
  if (S.started && S.time < S.dialogueUntil) el.dialogue.style.display = 'flex';
  else el.dialogue.style.display = 'none';

  // crew cooldowns
  const cd = (name, node, key) => {
    const left = S.crewCd[key];
    node.textContent = name + (left > 0 ? ' ' + Math.ceil(left) + 's' : ' READY');
    node.style.opacity = left > 0 ? '0.45' : '1';
  };
  cd('Z MARA', el.crewMara, 'MARA');
  cd('X SULLY', el.crewSully, 'SULLY');
  cd('C KIKI', el.crewKiki, 'KIKI');

  // mission panel + 4-segment progress
  const setSegs = (frac) => {
    const filled = Math.round(frac * 4);
    el.missionSegs.forEach((sp, i) => {
      sp.style.background = i < filled ? '#ffd23a' : 'rgba(255,255,255,.18)';
    });
  };
  const m = currentMission();
  if (!m) {
    el.missionTitle.textContent = 'ALL JOBS DONE — FIXER OF SOLARA';
    el.missionBrief.textContent = 'Free roam. Jack cars, dodge the heat, hunt the Golden Geckos.';
    el.missionClock.textContent = '--:--';
    el.missionDist.textContent = '';
    setSegs(1);
  } else if (S.missionActive) {
    el.missionTitle.textContent = 'JOB ' + (S.missionIdx + 1) + '/8 — ' + m.title.toUpperCase() + ' · ' + m.giver;
    el.missionBrief.textContent = m.brief;
    el.missionClock.textContent = fmtClock(S.missionTime);
    el.missionClock.style.color = S.missionTime < 30 ? '#ff5252' : '#ffd23a';
    el.missionDist.textContent = Math.round(missionDistance()) + 'm' + (S.missionHold > 0 ? ' · HOLD ' + Math.ceil(5 - S.missionHold) + 's' : '');
    setSegs(1 - S.missionTime / m.time);
  } else {
    el.missionTitle.textContent = 'NEXT JOB — ' + m.title.toUpperCase() + ' · ' + m.giver;
    el.missionBrief.textContent = m.brief + ' (go to the yellow beacon, press E)';
    el.missionClock.textContent = fmtClock(m.time);
    el.missionClock.style.color = '#fff';
    el.missionDist.textContent = Math.round(missionDistance()) + 'm';
    setSegs(0);
  }

  // speed + crosshair + hint
  el.speed.textContent = S.inCar ? Math.round(Math.abs(S.carSpeed) * 3.6) + ' km/h' : '';
  el.crosshair.style.display = S.inCar || S.started ? 'block' : 'none';
  let hint = '';
  if (S.started && !S.over) {
    hint = S.inCar ? 'W/S drive · A/D steer · F exit · Click shoot' : 'WASD walk · F jack car · Click fire · E start job · M map';
  }
  el.hint.textContent = hint;

  // message toast from game events
  if (S.message && S.time < S.messageUntil) {
    el.toast.textContent = S.message;
    el.toast.style.opacity = '1';
  } else if (S.message && S.time >= S.messageUntil) {
    if (el.toast.textContent === S.message) el.toast.style.opacity = '0';
  }

  // overlays
  el.pauseScreen.style.display = S.paused ? 'flex' : 'none';
  el.mapScreen.style.display = S.mapOpen ? 'flex' : 'none';
  el.bustedScreen.style.display = S.over ? 'flex' : 'none';

  // minimap + big map
  if (mini) drawMap(mini.getContext('2d'), 220, S.px, S.pz, 170, S.time < S.lookoutUntil);
  if (S.mapOpen && bigMap) drawMap(bigMap.getContext('2d'), 900, pan.x, pan.z, (WORLD.size / 2 + 40) / zoom, true);
}

export function resetMapView() {
  zoom = 1;
  pan = { x: 0, z: 0 };
}
