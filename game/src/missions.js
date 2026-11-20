// SOLARA — missions.js
// The 8-job chain: Lupe, Sully, Marco, Brandt, Aurora. Each job has a timed
// clock, a 3D beacon + HUD distance, and a rank payout. Ranks: ROOKIE → FIXER.

import * as THREE from 'three';
import { S, fmtCash, rankFor, DISTRICTS } from './config.js';
import { sfxCash, sfxFail } from './audio.js';

export const MISSIONS = [
  { giver: 'LUPE',   title: 'First Fix',      type: 'goto',    target: [-40, -192], time: 200, reward: 400,  brief: 'Meet Lupe at MO’S on Neon Row. She has your first job.' },
  { giver: 'SULLY',  title: 'Tow Job',        type: 'driveTo', target: [192, 192],  time: 240, reward: 650,  brief: 'Sully needs a car moved to Dockside. Grab wheels and drive it there.' },
  { giver: 'MARCO',  title: 'Marco’s Run', type: 'driveTo', target: [-192, 192], time: 210, reward: 800,  brief: 'Marco’s package goes to Old Port. Drive it there, no scratches.' },
  { giver: 'BRANDT', title: 'The Ledger',     type: 'hold',    target: [64, 64],    time: 240, reward: 1100, brief: 'Brandt’s ledger is in the Downtown office. Hold the spot 5s to lift it.' },
  { giver: 'AURORA', title: 'Aurora’s Light', type: 'goto',  target: [-262, -40], time: 200, reward: 900,  brief: 'Aurora waits on the beach boardwalk. Walk the sand, hear her out.' },
  { giver: 'LUPE',   title: 'Hot Wheels',     type: 'carjack', target: [0, -128],   time: 180, reward: 1000, brief: 'Lupe wants a fresh ride. Jack any car on Neon Row and bring it to the mark.' },
  { giver: 'SULLY',  title: 'Heat Wave',      type: 'escape',  target: [256, -192], time: 300, reward: 1400, brief: 'The heat is on. Lose the cops, then reach Sully’s hideout in Palm Heights.' },
  { giver: 'BRANDT', title: 'The Solara Job', type: 'finale',  target: [-128, 0],   time: 360, reward: 5000, brief: 'The big one. Hold the bank door 5s, then drive the getaway to the Marina.' },
];

let sceneRef = null;
let beacon = null;      // pulsing ring + beam at the current target
let markerRing = null;
let startCyl = null;    // big yellow cylinder at the mission start (before E)
let safeCyl = null;     // pink cylinder at the safehouse (MO'S / Lupe's)

export function buildMissions(scene) {
  sceneRef = scene;
  beacon = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.2, 4.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  beacon.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 2.2, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = 30;
  beacon.add(beam);
  markerRing = ring;
  beacon.visible = false;
  scene.add(beacon);

  // big yellow start cylinder at the mission target (visible until the job starts)
  startCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.6, 7, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
  );
  startCyl.position.set(-40, 3.5, -192);
  scene.add(startCyl);

  // pink safehouse cylinder at MO'S / Lupe's — offset from the yellow start
  // cylinder (which sits at the mission target) so the two markers never
  // overlap; it stands in front of the MO'S neon sign instead.
  safeCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 6, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff2e88, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
  );
  safeCyl.position.set(-52, 3, -178);
  scene.add(safeCyl);
}

export function currentMission() {
  return MISSIONS[S.missionIdx] || null;
}

export function missionTarget() {
  const m = currentMission();
  if (!m) return null;
  if (m.type === 'finale' && S.missionStage === 1) return [ -192, -192 ]; // getaway: Marina
  return m.target;
}

export function startMission() {
  const m = currentMission();
  if (!m) return false;
  S.missionActive = true;
  S.missionTime = m.time;
  S.missionStage = 0;
  S.missionHold = 0;
  beacon.visible = true;
  return true;
}

export function failMission(reason) {
  S.missionActive = false;
  S.missionTime = 0;
  beacon.visible = false;
  sfxFail();
  return reason;
}

export function completeMission() {
  const m = currentMission();
  if (!m) return;
  S.cash += m.reward;
  S.jobsDone++;
  S.rank = rankFor(S.jobsDone);
  // district grip rises where the job was done
  const t = m.target;
  let best = null, bestD = Infinity;
  for (const d of DISTRICTS) {
    const dd = Math.hypot(t[0] - d.x, t[1] - d.z);
    if (dd < bestD) { bestD = dd; best = d; }
  }
  if (best) best.grip = Math.min(95, (best.grip || 50) + 5);
  S.missionActive = false;
  S.missionTime = 0;
  beacon.visible = false;
  sfxCash();
  S.missionIdx++;
  if (S.missionIdx >= MISSIONS.length) {
    S.message = 'ALL 8 JOBS DONE — YOU ARE THE FIXER OF SOLARA';
  } else {
    S.message = 'JOB DONE: ' + m.title + '  +' + fmtCash(m.reward) + '  — next: ' + MISSIONS[S.missionIdx].title;
  }
  S.messageUntil = S.time + 6;
}

// Called every frame while a mission is active.
export function missionsTick(dt) {
  if (!beacon) return;
  const m = currentMission();
  // yellow start cylinder marks the job start until the job begins
  if (startCyl) {
    if (!m) { startCyl.visible = false; }
    else if (!S.missionActive) {
      const t0 = m.target;
      startCyl.position.set(t0[0], 3.5, t0[1]);
      startCyl.visible = true;
      startCyl.rotation.y += dt * 0.6;
    } else startCyl.visible = false;
  }
  if (!m || !S.missionActive) { beacon.visible = false; return; }

  S.missionTime -= dt;
  if (S.missionTime <= 0) {
    failMission('TIME UP — ' + m.title + ' failed. Press E at the mark to retry.');
    S.message = 'TIME UP — ' + m.title + ' failed. Press E at the mark to retry.';
    S.messageUntil = S.time + 5;
    return;
  }

  const t = missionTarget();
  beacon.position.set(t[0], 0, t[1]);
  beacon.visible = true;
  const pulse = 1 + Math.sin(S.time * 4) * 0.12;
  beacon.scale.set(pulse, 1, pulse);
  markerRing.rotation.z += dt * 0.8;

  const dist = Math.hypot(S.px - t[0], S.pz - t[1]);
  const near = dist < 6;

  switch (m.type) {
    case 'goto':
      if (near) completeMission();
      break;
    case 'driveTo':
      if (near && S.inCar) completeMission();
      break;
    case 'hold':
      if (near) {
        S.missionHold += dt;
        if (S.missionHold >= 5) completeMission();
      } else S.missionHold = 0;
      break;
    case 'carjack':
      // completes when the player is in a car inside the target radius
      if (near && S.inCar) completeMission();
      break;
    case 'escape':
      // reach the hideout only once the heat is off
      if (near && S.wanted === 0) completeMission();
      else if (near) { S.message = 'LOSE THE HEAT first — reach the hideout clean'; S.messageUntil = S.time + 2; }
      break;
    case 'finale':
      if (S.missionStage === 0) {
        if (near) {
          S.missionHold += dt;
          if (S.missionHold >= 5) { S.missionStage = 1; S.missionHold = 0; S.message = 'GETAWAY — drive to the Marina, fast!'; S.messageUntil = S.time + 5; }
        } else S.missionHold = 0;
      } else if (near && S.inCar) {
        completeMission();
      }
      break;
    default:
      break;
  }
}

// Distance to the current objective (HUD + arrow).
export function missionDistance() {
  const t = missionTarget();
  if (!t) return 0;
  return Math.hypot(S.px - t[0], S.pz - t[1]);
}

// Is the player standing at the mission start mark (to press E)?
export function atMissionStart() {
  const m = currentMission();
  if (!m || S.missionActive) return false;
  const d = Math.hypot(S.px - m.target[0], S.pz - m.target[1]);
  return d < 8;
}
