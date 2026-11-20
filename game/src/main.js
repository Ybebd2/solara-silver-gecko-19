// SOLARA — main.js
// Entrypoint + game loop. Builds the scene, wires every system, runs the
// third-person camera, and exposes window.__solara for debugging.

import * as THREE from 'three';
import { S, WORLD, WEAPONS, RADIO, CREW, clamp, lerp, rankFor } from './config.js';
import { keys, pressed, mouse, initInput, endFrameInput } from './input.js';
import { buildWorld, worldTick, collectiblesTick, geckoCount, geckoTotal } from './world.js';
import { buildVehicles, trafficTick, nearestCar, enterCar, exitCar, driveTick, traffic } from './vehicles.js';
import { buildPlayer, playerTick, tryFire, reloadWeapon } from './player.js';
import { buildPolice, policeTick, addWanted, cruisers, officers } from './police.js';
import { buildMissions, missionsTick, currentMission, missionTarget, startMission, atMissionStart } from './missions.js';
import { buildHUD, hudTick, toast, resetMapView } from './hud.js';
import { ensureAudio, audioTick, sfxClick, sfxCash } from './audio.js';
import { getShotParam, applyShot } from './shots.js';

const VERSION = 'solara-fresh-1.0';

let renderer, scene, camera, raycaster;
let camYaw = 0, camPitch = 0.32, camDist = 9;
let camYawOffset = 0;
let fixedCam = null;
let pedestrians = [];
let clock = null;
let lastT = 0;
let menuT = 0;

// ---------- pedestrians: VISIBLE citizens on the sidewalks ----------
// Round 6: the city looked empty because 28 peds were scattered over a
// 480x480 m area and wandered off-road. Now 64 walkers live ON the
// sidewalks (offset +/-12.5 from the road centre lines), in GROUPS of 2-4
// walking together, scaled 1.3x so they read as people, in hot bright
// shirts (pink, yellow, cyan, purple, orange, lime) that pop against the
// cream sidewalk. They RUN AWAY when a carjack happens nearby.
const PED_SHIRTS = [0xff2e63, 0xffd23a, 0x00d4ff, 0x9b59b6, 0xff5722, 0x76ff03, 0xff4081, 0xffffff];
const ROADS = [-256, -192, -128, -64, 0, 64, 128, 192, 256];

function buildPedestrians() {
  for (let i = 0; i < 64; i++) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: PED_SHIRTS[i % PED_SHIRTS.length] });
    const skin = new THREE.MeshLambertMaterial({ color: [0xc98e6a, 0x8a5a3a, 0xe8b98a][i % 3] });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.3), shirt);
    torso.position.y = 1.1; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skin);
    head.position.y = 1.62; g.add(head);
    // variety: teal hair on some, a cone hat on others
    if (i % 5 === 0) {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshLambertMaterial({ color: 0x1abc9c }));
      hair.position.y = 1.66; g.add(hair);
    } else if (i % 7 === 0) {
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.42, 10), new THREE.MeshLambertMaterial({ color: 0xf1c40f }));
      hat.position.y = 1.86; g.add(hat);
    }
    for (const sx of [-0.14, 0.14]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.62, 0.17), new THREE.MeshLambertMaterial({ color: 0x2e3a4a }));
      leg.position.set(sx, 0.35, 0); g.add(leg);
    }
    // blob shadow so the walker reads grounded in daylight
    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 14),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })
    );
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; g.add(blob);
    // sidewalk-bound: pick a road, a side, and a spot along it. Peds spawn
    // in GROUPS of 2-4 sharing a road stretch so the street reads crowded.
    const groupIdx = Math.floor(i / 3);
    const horizontal = groupIdx % 2 === 0;
    const road = ROADS[groupIdx % ROADS.length];
    const side = (groupIdx % 4 < 2 ? 1 : -1) * 12.5;
    const along = -240 + ((groupIdx * 37 + (i % 3) * 4) % 480);
    const x = horizontal ? along : road + side;
    const z = horizontal ? road + side : along;
    g.position.set(x, 0, z);
    g.scale.setScalar(1.45); // BIG enough to read as people from the screenshot camera
    scene.add(g);
    pedestrians.push({
      group: g, x, z,
      heading: horizontal ? (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (Math.random() < 0.5 ? 0 : Math.PI),
      speed: 1 + Math.random() * 1.2,
      tx: x, tz: z, wait: 0, fleeUntil: 0,
      horizontal, road, side, dir: Math.random() < 0.5 ? 1 : -1,
    });
  }
  // scooter riders cruising the roads (pink scooter + rider)
  for (let i = 0; i < 2; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.6), new THREE.MeshLambertMaterial({ color: 0xff69b4 }));
    body.position.y = 0.45; g.add(body);
    const rider = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), new THREE.MeshLambertMaterial({ color: [0xf1c40f, 0x3498db][i] }));
    rider.position.y = 1.0; g.add(rider);
    const rhead = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshLambertMaterial({ color: 0xc98e6a }));
    rhead.position.y = 1.45; g.add(rhead);
    for (const wz of [-0.6, 0.6]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0, 0.28, wz);
      g.add(wheel);
    }
    const roads = [-128, -64, 0, 64, 128];
    const road = roads[Math.floor(Math.random() * roads.length)];
    const horizontal = Math.random() < 0.5;
    const x = horizontal ? -200 + Math.random() * 400 : road + 7.5;
    const z = horizontal ? road + 7.5 : -200 + Math.random() * 400;
    g.position.set(x, 0, z);
    scene.add(g);
    pedestrians.push({
      group: g, x, z, heading: horizontal ? Math.PI / 2 : 0,
      speed: 9 + Math.random() * 3, tx: x, tz: z, wait: 0, fleeUntil: 0,
      scooter: true, horizontal, road,
    });
  }
}

function pedestriansTick(dt) {
  // a fresh carjack scares nearby pedestrians into running away
  const jackFresh = S.time - S.jackedAt < 4;
  for (const p of pedestrians) {
    if (p.scooter) {
      // scooter cruises its road, wraps around the city edge
      if (p.horizontal) {
        p.x += p.speed * dt;
        if (p.x > 310) p.x = -310;
      } else {
        p.z += p.speed * dt;
        if (p.z > 310) p.z = -310;
      }
      p.group.position.set(p.x, 0, p.z);
      p.group.rotation.y = p.horizontal ? Math.PI / 2 : 0;
      continue;
    }
    if (jackFresh && Math.hypot(p.x - S.px, p.z - S.pz) < 20) {
      // run away from the player, fast
      const dx = p.x - S.px, dz = p.z - S.pz;
      const d = Math.hypot(dx, dz) || 1;
      p.heading = Math.atan2(dx, dz);
      p.x += Math.sin(p.heading) * 5.5 * dt;
      p.z += Math.cos(p.heading) * 5.5 * dt;
      p.group.position.set(p.x, Math.abs(Math.sin(S.time * 12 + p.x)) * 0.06, p.z);
      p.group.rotation.y = p.heading;
      continue;
    }
    if (p.wait > 0) { p.wait -= dt; continue; }
    // sidewalk stroll: walk along the sidewalk, reverse at the city edge
    if (p.horizontal) {
      p.x += p.dir * p.speed * dt;
      if (p.x > 300) { p.x = 300; p.dir = -1; }
      if (p.x < -300) { p.x = -300; p.dir = 1; }
      p.heading = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      p.z += p.dir * p.speed * dt;
      if (p.z > 300) { p.z = 300; p.dir = -1; }
      if (p.z < -300) { p.z = -300; p.dir = 1; }
      p.heading = p.dir > 0 ? 0 : Math.PI;
    }
    if (Math.random() < dt * 0.02) p.wait = 1 + Math.random() * 2; // occasional pause
    p.group.position.set(p.x, Math.abs(Math.sin(S.time * 6 + p.x)) * 0.03, p.z);
    p.group.rotation.y = p.heading;
  }
}

// Stage pedestrians for a screenshot: move the first N walkers onto the
// sidewalks right next to the shot location so citizens are GUARANTEED in
// frame (groups of 2-3, both sides of the road).
function stagePedsForShot(n) {
  const spots = [];
  if (n === 2) {
    // drive shot: road z=64, sidewalks at z=51.5 / 76.5, ahead of the car
    for (let i = 0; i < 12; i++) {
      const side = i % 2 === 0 ? 51.5 : 76.5;
      spots.push({ x: -52 + (i >> 1) * 7 + (i % 3), z: side });
    }
  } else if (n === 3) {
    // Kai on foot at (-40,-184): sidewalk z=-179.5 right beside him
    for (let i = 0; i < 6; i++) spots.push({ x: -46 + i * 3.5, z: -179.5 });
    for (let i = 0; i < 4; i++) spots.push({ x: -30 + i * 3, z: -204.5 });
  } else if (n === 4) {
    // chase: road z=-192, sidewalks at -179.5 / -204.5 near the player
    for (let i = 0; i < 10; i++) {
      const side = i % 2 === 0 ? -179.5 : -204.5;
      spots.push({ x: -28 + (i >> 1) * 8, z: side });
    }
  }
  for (let i = 0; i < spots.length && i < pedestrians.length; i++) {
    const p = pedestrians[i];
    p.x = spots[i].x; p.z = spots[i].z;
    p.horizontal = true; p.road = Math.round(spots[i].z / 64) * 64; p.side = 12.5;
    p.dir = 1; p.wait = 9999; // hold the pose for the shot
    p.group.position.set(p.x, 0, p.z);
    p.group.rotation.y = Math.PI / 2;
  }
}

// ---------- save / load ----------
function saveGame() {
  try {
    const data = {
      px: S.px, pz: S.pz, heading: S.heading, cash: S.cash, health: S.health,
      wanted: S.wanted, missionIdx: S.missionIdx, jobsDone: S.jobsDone,
      weaponIdx: S.weaponIdx, time: S.time,
    };
    localStorage.setItem('solara-save-v1', JSON.stringify(data));
    toast('Game saved (F8)');
  } catch (e) { toast('Save failed'); }
}

function loadGame() {
  try {
    const raw = localStorage.getItem('solara-save-v1');
    if (!raw) { toast('No save found'); return; }
    const d = JSON.parse(raw);
    S.px = d.px; S.pz = d.pz; S.heading = d.heading;
    S.cash = d.cash; S.health = d.health; S.wanted = d.wanted;
    S.missionIdx = d.missionIdx; S.jobsDone = d.jobsDone;
    S.rank = rankFor(d.jobsDone);
    S.weaponIdx = d.weaponIdx || 0;
    S.ammo = WEAPONS[S.weaponIdx].mag;
    S.over = false; S.missionActive = false;
    toast('Save loaded');
  } catch (e) { toast('Load failed'); }
}

// ---------- camera ----------
function cameraTick(dt) {
  if (fixedCam) {
    // staged shot: snap fast to the fixed camera (the spawn camera starts
    // ~250 m away, so a slow lerp never converges before the screenshot)
    camera.position.lerp(new THREE.Vector3(fixedCam.camPos[0], fixedCam.camPos[1], fixedCam.camPos[2]), Math.min(1, dt * 8));
    camera.lookAt(fixedCam.camLook[0], fixedCam.camLook[1], fixedCam.camLook[2]);
    return;
  }
  // start menu: slow cinematic orbit over downtown — towers, beach, bright day
  if (!S.started) {
    menuT += dt;
    const a = menuT * 0.05;
    const cx = Math.sin(a) * 120;
    const cz = Math.cos(a) * 120;
    camera.position.lerp(new THREE.Vector3(cx, 42, cz), Math.min(1, dt * 1.2));
    camera.lookAt(-80, 18, -40);
    return;
  }
  // mouse drag orbits; otherwise the camera settles behind the heading
  camYawOffset -= mouse.dx * 0.004;
  camPitch = clamp(camPitch + mouse.dy * 0.003, 0.08, 0.9);
  camYawOffset *= Math.pow(0.12, dt); // ease back to behind-view
  const targetYaw = S.heading + Math.PI + camYawOffset;
  let dy = targetYaw - camYaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  camYaw += dy * Math.min(1, dt * 4);

  const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
  const dist = S.inCar ? 11 : 8.5;
  const height = S.inCar ? 4.2 : 3.4;
  const px = S.px + fx * dist;
  const pz = S.pz + fz * dist;
  const py = height + Math.sin(camPitch) * 2.2;
  camera.position.x = lerp(camera.position.x, px, Math.min(1, dt * 7));
  camera.position.y = lerp(camera.position.y, py, Math.min(1, dt * 7));
  camera.position.z = lerp(camera.position.z, pz, Math.min(1, dt * 7));
  camera.lookAt(S.px - fx * 6, 1.6, S.pz - fz * 6);
}

// ---------- autopilot: drives the car toward the mission mark ----------
// Steers along the road grid: head for the target's nearest road, then along it.
function autopilotKeys() {
  const car = S.car;
  if (!car) return null;
  const t = missionTarget();
  if (!t) return null;
  const dx = t[0] - car.x, dz = t[1] - car.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 8) { S.autopilot = false; toast('AUTOPILOT — arrived at the mark'); return null; }
  const wantHeading = Math.atan2(dx, dz);
  let dh = wantHeading - car.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  // grid-friendly: prefer moving along the axis with the bigger remaining gap
  const k = { KeyW: true, KeyS: false, KeyA: false, KeyD: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
  if (dh > 0.12) k.KeyA = true;
  else if (dh < -0.12) k.KeyD = true;
  if (dist < 20) k.KeyW = Math.abs(dh) < 0.5;
  return k;
}
function handleKeys() {
  if (pressed['KeyP']) {
    S.paused = !S.paused;
    sfxClick();
  }
  if (pressed['KeyM']) {
    S.mapOpen = !S.mapOpen;
    if (S.mapOpen) resetMapView();
    sfxClick();
  }
  if (pressed['F8']) saveGame();
  if (pressed['F2']) { saveGame(); toast('Quick saved (F2)'); }
  if (pressed['F9']) {
    if (S.inCar && S.car) {
      S.autopilot = !S.autopilot;
      toast(S.autopilot ? 'AUTOPILOT ON — driving to the job mark (F9 to take over)' : 'AUTOPILOT OFF — you drive');
      sfxClick();
    } else toast('AUTOPILOT — get in a car first (F9)');
  }
  if (pressed['KeyR']) {
    S.station = (S.station + 1) % RADIO.length;
    toast('RADIO — ' + RADIO[S.station].name + ' · ' + RADIO[S.station].desc);
    sfxClick();
  }
  if (pressed['KeyT']) reloadWeapon();
  for (let i = 0; i < 5; i++) {
    if (pressed['Digit' + (i + 1)]) {
      S.weaponIdx = i;
      S.ammo = WEAPONS[i].mag;
      S.reserve = 48;
      toast(WEAPONS[i].name + ' equipped');
      sfxClick();
    }
  }
  // crew abilities
  if (pressed[CREW.MARA.key] && S.crewCd.MARA <= 0) {
    if (S.wanted > 0) {
      S.wanted = Math.max(0, S.wanted - 1);
      S.evading = 0;
      S.crewCd.MARA = CREW.MARA.cooldown;
      toast('MARA / GHOST — one star wiped. You were never here.');
    } else toast('MARA — no heat to wipe right now');
  }
  if (pressed[CREW.SULLY.key] && S.crewCd.SULLY <= 0) {
    if (S.inCar && S.car) {
      S.car.health = 100;
      S.crewCd.SULLY = CREW.SULLY.cooldown;
      toast('SULLY / PIT CREW — ride fully repaired');
    } else toast('SULLY — get in a car first');
  }
  if (pressed[CREW.KIKI.key] && S.crewCd.KIKI <= 0) {
    S.lookoutUntil = S.time + 20;
    S.crewCd.KIKI = CREW.KIKI.cooldown;
    toast('KIKI / LOOKOUT — patrols revealed for 20s');
  }
  // enter / exit car
  if (pressed['KeyF']) {
    if (S.inCar) {
      S.autopilot = false;
      exitCar();
    } else {
      const cand = nearestCar(S.px, S.pz);
      if (cand) {
        enterCar(cand);
        S.jackedAt = S.time; // nearby pedestrians run away
        addWanted(1, 'carjack');
        toast('Carjacked! +1 wanted star — lose the heat');
      }
    }
  }
  // start a mission
  if (pressed['KeyE'] && atMissionStart()) {
    startMission();
    const m = currentMission();
    toast('JOB STARTED — ' + m.title + ' · ' + m.giver + ' · ' + Math.round(m.time / 60) + ' min on the clock');
  }
  // click to fire
  if (mouse.clicked || (mouse.down && WEAPONS[S.weaponIdx].auto)) {
    ensureAudio();
    tryFire(camera, raycaster);
  }
  if (pressed['Space']) ensureAudio();
}

// ---------- main loop ----------
function loop(t) {
  requestAnimationFrame(loop);
  const now = t / 1000;
  let dt = Math.min(0.05, now - (lastT || now));
  lastT = now;
  if (S.paused || S.mapOpen) dt = 0;

  if (!S.paused && !S.mapOpen && S.started && !S.over) {
    S.time += dt;
    for (const k of ['MARA', 'SULLY', 'KIKI']) S.crewCd[k] = Math.max(0, S.crewCd[k] - dt);
    handleKeys();
    if (S.inCar) {
      const dk = S.autopilot ? autopilotKeys() : null;
      driveTick(dt, dk || keys);
    } else playerTick(dt, camera);
    trafficTick(dt);
    pedestriansTick(dt);
    policeTick(dt);
    missionsTick(dt);
    worldTick(dt, S.time);
    if (collectiblesTick(S.px, S.pz)) {
      toast('GOLDEN GECKO ' + geckoCount() + '/' + geckoTotal() + ' — nice find, Kai');
      sfxCash();
    }
    if (S.wanted === 0 && S.health < 100) S.health = Math.min(100, S.health + 2 * dt);
    if (S.car && S.car.health <= 0) {
      toast('Your ride is wrecked — bail out!');
      exitCar();
    }
  } else if (S.over) {
    handleKeys();
  }

  cameraTick(S.paused ? 0.0001 : dt);
  audioTick(dt);
  hudTick(dt);

  // debug state for headless verification
  const dbg = document.getElementById('debug');
  if (dbg) {
    dbg.textContent = JSON.stringify({
      v: VERSION, px: +S.px.toFixed(1), pz: +S.pz.toFixed(1),
      wanted: S.wanted, health: Math.round(S.health), cash: S.cash,
      inCar: S.inCar, carSpeed: +(S.carSpeed || 0).toFixed(1),
      ammo: S.ammo, mission: S.missionIdx, active: S.missionActive,
      jobs: S.jobsDone, rank: S.rank, started: S.started,
    });
  }
  renderer.render(scene, camera);
  endFrameInput();
}

function init() {
  const canvas = document.getElementById('game-canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x35a3e8);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x35a3e8);
  scene.fog = new THREE.Fog(0x8ec8f0, 150, 700);

  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
  camera.position.set(S.px + 8, 4, S.pz + 8);
  camYaw = S.heading + Math.PI;

  // BRIGHT DAYTIME lighting (~14:00): high white sun + blue sky fill, so the
  // city's colours actually show instead of drowning in a dusk-orange wash.
  const sun = new THREE.DirectionalLight(0xfff3d6, 2.8);
  sun.position.set(-180, 150, -100);
  scene.add(sun);
  const sky = new THREE.HemisphereLight(0x7ec0ee, 0x3f7d4a, 1.25);
  scene.add(sky);

  raycaster = new THREE.Raycaster();
  initInput(canvas);
  buildWorld(scene);
  buildVehicles(scene);
  buildPlayer(scene);
  buildPolice(scene);
  buildMissions(scene);
  buildPedestrians();
  buildHUD({ onLoad: loadGame });
  ensureAudio();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // screenshot setups (?shot=1..4) — also auto-starts the game
  const shot = getShotParam();
  if (shot > 0) {
    fixedCam = applyShot(shot);
    stagePedsForShot(shot); // citizens guaranteed in frame for the shot
  }

  window.__solara = {
    version: VERSION,
    S, traffic, cruisers, officers,
    policeCount: () => cruisers.length + officers.length,
    getState: () => ({
      px: S.px, pz: S.pz, heading: S.heading, wanted: S.wanted,
      health: S.health, cash: S.cash, inCar: S.inCar, carSpeed: S.carSpeed,
      ammo: S.ammo, missionIdx: S.missionIdx, missionActive: S.missionActive,
      jobsDone: S.jobsDone, rank: S.rank, started: S.started, over: S.over,
      missionTime: S.missionTime,
    }),
  };

  clock = performance.now();
  requestAnimationFrame(loop);
}

init();
