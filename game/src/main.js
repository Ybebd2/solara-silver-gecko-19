// SOLARA — main.js
// Entrypoint + game loop. Builds the scene, wires every system, runs the
// third-person camera, and exposes window.__solara for debugging.

import * as THREE from 'three';
import { S, WORLD, WEAPONS, RADIO, CREW, clamp, lerp, rankFor } from './config.js';
import { keys, pressed, mouse, initInput, endFrameInput } from './input.js';
import { buildWorld } from './world.js';
import { buildVehicles, trafficTick, nearestCar, enterCar, exitCar, driveTick, traffic } from './vehicles.js';
import { buildPlayer, playerTick, tryFire, reloadWeapon } from './player.js';
import { buildPolice, policeTick, addWanted, cruisers, officers } from './police.js';
import { buildMissions, missionsTick, currentMission, startMission, atMissionStart } from './missions.js';
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

// ---------- pedestrians: simple walkers on the sidewalks ----------
function buildPedestrians() {
  const shirts = [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0xe67e22];
  for (let i = 0; i < 18; i++) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: shirts[i % shirts.length] });
    const skin = new THREE.MeshLambertMaterial({ color: [0xc98e6a, 0x8a5a3a, 0xe8b98a][i % 3] });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.3), shirt);
    torso.position.y = 1.1; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skin);
    head.position.y = 1.62; g.add(head);
    for (const sx of [-0.14, 0.14]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.62, 0.17), new THREE.MeshLambertMaterial({ color: 0x2e3a4a }));
      leg.position.set(sx, 0.35, 0); g.add(leg);
    }
    const x = -240 + Math.random() * 480;
    const z = -240 + Math.random() * 480;
    g.position.set(x, 0, z);
    scene.add(g);
    pedestrians.push({
      group: g, x, z,
      heading: Math.random() * Math.PI * 2,
      speed: 1 + Math.random() * 1.2,
      tx: x, tz: z, wait: 0,
    });
  }
}

function pedestriansTick(dt) {
  for (const p of pedestrians) {
    if (p.wait > 0) { p.wait -= dt; continue; }
    const dx = p.tx - p.x, dz = p.tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.5) {
      // pick a new nearby stroll target
      p.tx = clamp(p.x + (Math.random() - 0.5) * 90, -250, 250);
      p.tz = clamp(p.z + (Math.random() - 0.5) * 90, -250, 250);
      if (Math.random() < 0.3) p.wait = 1 + Math.random() * 3;
      continue;
    }
    const want = Math.atan2(dx, dz);
    let dh = want - p.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    p.heading += clamp(dh, -2.5 * dt, 2.5 * dt);
    p.x += Math.sin(p.heading) * p.speed * dt;
    p.z += Math.cos(p.heading) * p.speed * dt;
    p.group.position.set(p.x, Math.abs(Math.sin(S.time * 6 + p.x)) * 0.03, p.z);
    p.group.rotation.y = p.heading;
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
    toast('Save loaded (F9)');
  } catch (e) { toast('Load failed'); }
}

// ---------- camera ----------
function cameraTick(dt) {
  if (fixedCam) {
    camera.position.lerp(new THREE.Vector3(fixedCam.camPos[0], fixedCam.camPos[1], fixedCam.camPos[2]), Math.min(1, dt * 2));
    camera.lookAt(fixedCam.camLook[0], fixedCam.camLook[1], fixedCam.camLook[2]);
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

// ---------- one-shot key actions ----------
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
  if (pressed['F9']) loadGame();
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
      exitCar();
    } else {
      const cand = nearestCar(S.px, S.pz);
      if (cand) {
        enterCar(cand);
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
    if (S.inCar) driveTick(dt, keys);
    else playerTick(dt, camera);
    trafficTick(dt);
    pedestriansTick(dt);
    policeTick(dt);
    missionsTick(dt);
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
  renderer.setClearColor(0xffb36b);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xff9e57);
  scene.fog = new THREE.Fog(0xff9e57, 120, 620);

  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
  camera.position.set(S.px + 8, 4, S.pz + 8);
  camYaw = S.heading + Math.PI;

  // golden-hour lighting: warm sun + soft sky fill
  const sun = new THREE.DirectionalLight(0xffc98a, 2.4);
  sun.position.set(-180, 90, -120);
  scene.add(sun);
  const sky = new THREE.HemisphereLight(0xffd9a0, 0x4a3a3a, 1.1);
  scene.add(sky);

  raycaster = new THREE.Raycaster();
  initInput(canvas);
  buildWorld(scene);
  buildVehicles(scene);
  buildPlayer(scene);
  buildPolice(scene);
  buildMissions(scene);
  buildPedestrians();
  buildHUD();
  ensureAudio();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // screenshot setups (?shot=1..4) — also auto-starts the game
  const shot = getShotParam();
  if (shot > 0) fixedCam = applyShot(shot);

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
