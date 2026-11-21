// SOLARA — main.js (fresh build from spec, round 8)
// Entrypoint: renderer, loop (dt clamped), camera, start screen,
// E to start missions, F9 autopilot, debug API on window.__solara.

import * as THREE from 'three';
import { createState, districtAt } from './config.js';
import { createInput } from './input.js';
import { buildWorld } from './world.js';
import { createVehicles } from './vehicles.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { applyShot, shotFromUrl } from './shots.js';

const VERSION = 'r8-fresh-1.0.0';

const S = createState();
const input = createInput();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game-canvas').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

const world = buildWorld(scene, S);
window.__solaraWorld = world;
const vehicles = createVehicles(scene, S);
const player = createPlayer(scene, S);
const police = createPolice(scene, S);
const missions = createMissions(S, world);
const hud = createHud(S, missions, world);
const audio = createAudio(S);

// Debug API — the trial and the dossier screenshots use this.
window.__solara = {
  version: VERSION,
  S,
  traffic: vehicles.traffic,
  cruisers: police.cruisers,
  officers: police.officers,
  policeCount: () => police.policeCount(),
  getState() {
    return JSON.parse(JSON.stringify({
      ...S,
      car: S.car ? { x: S.car.x, z: S.car.z, color: S.car.color } : null,
    }));
  },
};

// ---- start screen ----
const menu = document.getElementById('start-menu');
const pauseEl = document.getElementById('pause-menu');
const mapEl = document.getElementById('map-overlay');

function startGame() {
  S.started = true;
  S.paused = false;
  if (menu) menu.style.display = 'none';
  audio.ensure();
  audio.startEngine();
  audio.startRadio();
  const m = missions.current();
  if (m && !S.missionActive) {
    S.message = m.name + ' — press E at the yellow marker';
    S.messageUntil = S.time + 6;
  }
}
const startBtn = document.getElementById('start-btn');
if (startBtn) startBtn.addEventListener('click', startGame);
const loadBtn = document.getElementById('load-btn');
if (loadBtn) loadBtn.addEventListener('click', startGame);
const settingsBtn = document.getElementById('settings-btn');
if (settingsBtn) settingsBtn.addEventListener('click', () => {
  S.soundOn = !S.soundOn;
  settingsBtn.textContent = 'SETTINGS — SOUND ' + (S.soundOn ? 'ON' : 'OFF');
});

// ---- staged screenshots ----
const shotNum = shotFromUrl();
let shotCam = null;
if (shotNum > 0) {
  shotCam = applyShot(shotNum, { S, missions, vehicles, world });
  if (shotCam && shotCam.keepMenu) {
    if (menu) menu.style.display = 'flex';
  } else if (menu) {
    menu.style.display = 'none';
    S.started = true;
    audio.ensure();
  }
  // hide the menu HUD clutter for clean shots, keep HUD visible
  document.body.classList.add('shot-mode');
}

// ---- shooting (mouse click, not drag) ----
let downAt = 0;
renderer.domElement.addEventListener('mousedown', () => { downAt = performance.now(); });
renderer.domElement.addEventListener('mouseup', () => {
  if (!S.started || S.paused || performance.now() - downAt > 200) return;
  const w = [12, 30, 8, 6, Infinity][S.weaponIdx];
  if (S.ammo > 0 && S.ammo !== Infinity) S.ammo--;
  S.shotsFired++;
  audio.shot();
  // hit test: nearest officer/cruiser in front within range
  const range = [90, 70, 160, 40, 3][S.weaponIdx];
  const fx = Math.cos(S.heading), fz = -Math.sin(S.heading);
  for (const o of police.officers) {
    if (!o.active) continue;
    const dx = o.x - S.px, dz = o.z - S.pz;
    const d = Math.hypot(dx, dz);
    if (d < range && dx * fx + dz * fz > 0.7 * d) {
      S.hits++;
      o.x += dx / d * 6; o.z += dz / d * 6;
      S.wanted = Math.min(5, S.wanted + 1);
      break;
    }
  }
});

// ---- main loop ----
// Manual frame timer (not THREE.Clock — r187 deprecates it).
let lastT = performance.now();
let lastJobsDone = 0;

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const rawDt = (now - lastT) / 1000;
  lastT = now;
  const dt = Math.min(0.05, rawDt); // dt clamp (spec)
  if (!S.paused) S.time += dt;

  // one-shot keys
  if (input.wasPressed('Escape')) {
    if (S.started) {
      S.paused = !S.paused;
      if (pauseEl) pauseEl.style.display = S.paused ? 'flex' : 'none';
    }
  }
  if (input.wasPressed('KeyM')) {
    S.mapOpen = !S.mapOpen;
    if (mapEl) mapEl.style.display = S.mapOpen ? 'block' : 'none';
  }
  // E: start mission at the marker / talk
  if (input.wasPressed('KeyE') && S.started && !S.paused) {
    const m = missions.current();
    if (m && !S.missionActive) {
      const d = Math.hypot(m.start[0] - S.px, m.start[1] - S.pz);
      if (d <= 10) {
        missions.startMission();
        audio.pickup();
      } else {
        S.message = 'Go to the yellow marker — ' + Math.round(d) + 'm away';
        S.messageUntil = S.time + 3;
      }
    }
  }
  // H: toggle HUD (clean screenshots)
  if (input.wasPressed('KeyH')) {
    document.body.classList.toggle('hide-hud');
  }

  if (S.started && !S.paused) {
    input.consumeMouse();
    player.update(dt, input, vehicles, missions);
    vehicles.update(dt, S, input);
    police.update(dt, S.time);
    missions.update(dt);
    world.update(dt, S.time);
    audio.updateEngine();
    // crew cooldowns tick down
    for (const k of Object.keys(S.crewCd)) {
      if (S.crewCd[k] > 0) S.crewCd[k] = Math.max(0, S.crewCd[k] - dt);
    }
    if (S.jobsDone > lastJobsDone) {
      audio.jobDone();
      lastJobsDone = S.jobsDone;
    }
    // grip bonus from district
    S.gripBonus = districtAt(S.px, S.pz).grip;
  } else if (!S.started && !shotCam) {
    // menu idle: slow orbit over downtown
    world.update(dt, S.time);
  } else if (shotCam) {
    world.update(dt, S.time);
    police.update(dt, S.time);
  }

  // ---- camera ----
  if (shotCam) {
    camera.position.set(shotCam.camPos[0], shotCam.camPos[1], shotCam.camPos[2]);
    camera.lookAt(shotCam.camLook[0], shotCam.camLook[1], shotCam.camLook[2]);
  } else if (S.started) {
    const yaw = input.camYaw;
    const pitch = input.camPitch;
    const dist = S.inCar ? 11 : 9.5;
    const cx = S.px + Math.sin(yaw) * Math.cos(pitch) * dist;
    const cz = S.pz + Math.cos(yaw) * Math.cos(pitch) * dist;
    const cy = 3.4 + Math.sin(pitch) * dist * 0.6;
    camera.position.set(cx, cy, cz);
    camera.lookAt(S.px, 1.6, S.pz);
    // face the camera direction when walking (camYaw follows heading slowly)
    if (Math.abs(S.speed) > 0.5 && !S.inCar) {
      // keep camYaw as the player steers with the mouse; nothing forced
    }
  } else {
    // menu camera: slow drift over downtown
    const t = S.time * 0.08;
    camera.position.set(Math.sin(t) * 120 - 40, 55, Math.cos(t) * 120);
    camera.lookAt(0, 12, 0);
  }

  hud.update();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
console.log('[SOLARA] ' + VERSION + ' booted. spawn=(' + S.px + ',' + S.pz + ')');
