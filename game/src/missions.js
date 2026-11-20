// SOLARA — missions.js
// The 8-job chain: yellow start beacon + pink safehouse (kept apart so the
// markers never overlap), a countdown clock, hold-to-complete, cash + rank.

import * as THREE from 'three';
import { S, rankFor } from './config.js';

const JOBS = [
  { title: 'First Fix', giver: 'LUPE', brief: 'Pick up the package at the docks and bring it back to MO\'S.', time: 200, sx: -40, sz: -192, tx: -224, tz: -128, reward: 400 },
  { title: 'Tow Job', giver: 'SULLY', brief: 'Tow the busted Comet from Neon Row to the garage.', time: 240, sx: 96, sz: -128, tx: 160, tz: -64, reward: 500 },
  { title: "Marco's Run", giver: 'MARCO', brief: 'Drive the ledger across town. Do not stop for anyone.', time: 260, sx: -96, sz: 64, tx: 192, tz: 128, reward: 650 },
  { title: 'The Ledger', giver: 'BRANDT', brief: 'Collect the ledger from the Downtown tower and vanish.', time: 300, sx: 32, sz: -64, tx: -128, tz: 192, reward: 800 },
  { title: "Aurora's Light", giver: 'AURORA', brief: 'Light the boardwalk beacons before the gala starts.', time: 280, sx: -192, sz: 128, tx: -256, tz: -64, reward: 750 },
  { title: 'Hot Wheels', giver: 'LUPE', brief: 'Steal the NIGHTHAWK from Palm Heights. Fast and quiet.', time: 240, sx: 128, sz: 192, tx: 0, tz: -192, reward: 900 },
  { title: 'Heat Wave', giver: 'SULLY', brief: 'Lose a 3-star tail, then deliver the car to Dockside.', time: 300, sx: 192, sz: -128, tx: -64, tz: -192, reward: 1000 },
  { title: 'The Solara Job', giver: 'BRANDT', brief: 'The big one: hit the bank vault and get to the beach.', time: 360, sx: 0, sz: 0, tx: -256, tz: 0, reward: 2500 },
];

let beacon = null;
let safehouse = null;
let beaconLight = null;

export function buildMissions(scene) {
  // yellow start beacon: a tall glowing cylinder at the current job start
  beacon = new THREE.Group();
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
  );
  cyl.position.y = 15;
  beacon.add(cyl);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.18, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23a })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.2;
  beacon.add(ring);
  beaconLight = new THREE.PointLight(0xffd23a, 12, 30);
  beaconLight.position.y = 4;
  beacon.add(beaconLight);
  scene.add(beacon);

  // pink safehouse marker — fixed at (-52, 3, -178), in front of the MO'S
  // neon sign and a good 14 m from the first job's start beacon (-40,-192),
  // so the two markers can never sit on top of each other.
  safehouse = new THREE.Group();
  const sh = new THREE.Mesh(
    new THREE.CylinderGeometry(2.0, 2.0, 6, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff2e88, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false })
  );
  sh.position.y = 3;
  safehouse.add(sh);
  const shRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.16, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xff2e88 })
  );
  shRing.rotation.x = Math.PI / 2;
  shRing.position.y = 0.2;
  safehouse.add(shRing);
  safehouse.position.set(-52, 0, -178);
  scene.add(safehouse);
  moveBeacon();
}

function moveBeacon() {
  const m = currentMission();
  if (!beacon) return;
  if (!m) { beacon.visible = false; return; }
  beacon.visible = true;
  beacon.position.set(m.sx, 0, m.sz);
}

export function currentMission() {
  return S.missionIdx < JOBS.length ? JOBS[S.missionIdx] : null;
}

export function missionTarget() {
  const m = currentMission();
  if (!m) return null;
  return S.missionActive ? [m.tx, m.tz] : [m.sx, m.sz];
}

export function missionDistance() {
  const t = missionTarget();
  if (!t) return 0;
  return Math.hypot(t[0] - S.px, t[1] - S.pz);
}

export function atMissionStart() {
  const m = currentMission();
  if (!m || S.missionActive) return false;
  return Math.hypot(m.sx - S.px, m.sz - S.pz) < 6;
}

export function startMission() {
  const m = currentMission();
  if (!m) return;
  S.missionActive = true;
  S.missionTime = m.time;
  S.missionHold = 0;
}

export function missionsTick(dt) {
  if (!beacon) return;
  // beacon pulses gently so it reads from across the city
  beacon.rotation.y += dt * 0.8;
  if (beaconLight) beaconLight.intensity = 10 + Math.sin(S.time * 3) * 3;

  const m = currentMission();
  if (!m) return;
  if (!S.missionActive) return;

  S.missionTime -= dt;
  if (S.missionTime <= 0) {
    // out of time: the job fails, step back to the beacon and try again
    S.missionActive = false;
    S.missionTime = 0;
    S.missionHold = 0;
    S.message = 'JOB FAILED — out of time. Head back to the beacon.';
    S.messageUntil = S.time + 5;
    return;
  }
  const d = Math.hypot(m.tx - S.px, m.tz - S.pz);
  if (d < 7) {
    S.missionHold += dt;
    if (S.missionHold >= 5) {
      // job done
      S.jobsDone += 1;
      S.cash += m.reward;
      S.rank = rankFor(S.jobsDone);
      S.missionActive = false;
      S.missionHold = 0;
      S.missionIdx += 1;
      S.message = 'JOB DONE — ' + m.title.toUpperCase() + ' · +$' + m.reward;
      S.messageUntil = S.time + 5;
      moveBeacon();
    }
  } else {
    S.missionHold = 0;
  }
}
