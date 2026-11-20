// SOLARA — police.js
// Wanted system: 5 stars, cruisers + officers chase, helicopter at 3 stars,
// EVADING meter fills while unseen — 100% drops a star.

import * as THREE from 'three';
import { S, clamp } from './config.js';
import { makeCar } from './vehicles.js';
import { addShootTarget, removeShootTarget } from './player.js';
import { resolveCollisions, colliders } from './world.js';
import { sfxSirenBlip } from './audio.js';

let sceneRef = null;
export const cruisers = [];  // {group, wheels, heading, speed, x, z}
export const officers = [];  // {group, target, hp, x, z, heading, shootCd}
let heli = null;             // {group, rotor, light}
let roadblock = null;        // {meshes, colliders, cruisers} — 3+ stars only
let flashT = 0;

function buildOfficer() {
  const g = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98e6a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.32), navy);
  torso.position.y = 1.15; g.add(torso);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.34), new THREE.MeshLambertMaterial({ color: 0x0e1420 }));
  vest.position.y = 1.2; g.add(vest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), skin);
  head.position.y = 1.68; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 10), navy);
  cap.position.y = 1.84; g.add(cap);
  for (const sx of [-0.15, 0.15]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), navy);
    leg.position.set(sx, 0.38, 0); g.add(leg);
  }
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.28), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.3, 1.1, 0.2); g.add(gun);
  return g;
}

function buildHeli() {
  const g = new THREE.Group();
  // WHITE police helicopter with blue stripe — reads clearly against the
  // blue sky, not a black blob. Body, tail boom, fin, tail rotor, skids,
  // glass cockpit, and a spotlight housing under the nose.
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f5f7, metalness: 0.35, roughness: 0.35 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x1a5fb4, metalness: 0.4, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd8e8, metalness: 0.8, roughness: 0.15 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 3.6), white);
  g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.4, 3.62), blue);
  stripe.position.y = -0.2;
  g.add(stripe);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 8), glass);
  nose.position.set(0, -0.1, 1.7); nose.scale.set(1, 0.8, 0.7); g.add(nose);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.4), white);
  tail.position.set(0, 0.3, -3.6); g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 1.0), blue);
  fin.position.set(0, 0.9, -5.6); g.add(fin);
  const tailRotor = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.12), dark);
    blade.rotation.z = (i * Math.PI) / 2;
    tailRotor.add(blade);
  }
  tailRotor.position.set(0.35, 0.9, -5.6);
  g.add(tailRotor);
  // main rotor: 2 thin blades + a translucent blur disc (reads as spinning)
  const rotor = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(9, 0.06, 0.35), dark);
    blade.rotation.y = (i * Math.PI) / 2;
    rotor.add(blade);
  }
  rotor.position.y = 1.1;
  g.add(rotor);
  const blur = new THREE.Mesh(
    new THREE.CircleGeometry(4.6, 28),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false })
  );
  blur.rotation.x = -Math.PI / 2;
  blur.position.y = 1.12;
  g.add(blur);
  // skids + struts
  for (const sx of [-0.9, 0.9]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.2), dark);
    skid.position.set(sx, -1.0, 0); g.add(skid);
    for (const sz of [-1.1, 1.1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), dark);
      strut.position.set(sx, -0.75, sz); g.add(strut);
    }
  }
  // spotlight housing under the nose + bright lens facing down
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.5, 10), dark);
  housing.position.set(0, -1.0, 1.2);
  g.add(housing);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), new THREE.MeshBasicMaterial({ color: 0xfffbe0 }));
  lens.rotation.x = Math.PI / 2; // face down
  lens.position.set(0, -1.26, 1.2);
  g.add(lens);
  return { group: g, rotor, tailRotor, blur, lampLocal: new THREE.Vector3(0, -1.26, 1.2) };
}

// Searchlight beam + ground pool. The beam is a cone whose APEX is at the
// spotlight lamp and whose wide base lands on the ground at the player —
// built as scene children and re-aimed every frame, so the light visibly
// comes FROM the helicopter TO the ground. (The old code called
// cone.lookAt(), which aligns +Z, not the cone's Y axis, so the beam lay
// sideways and never lined up with the heli.)
function buildBeam() {
  const beam = new THREE.Group();
  const geo = new THREE.ConeGeometry(6, 30, 16, 1, true);
  geo.translate(0, -15, 0); // apex at origin, base 30 m below
  const cone = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: 0xfff6c9, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.add(cone);
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(6, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff6c9, transparent: true, opacity: 0.65, depthWrite: false })
  );
  pool.rotation.x = -Math.PI / 2;
  return { beam, pool };
}

export function buildPolice(scene) {
  sceneRef = scene;
}

export function addWanted(n, reason) {
  const before = S.wanted;
  S.wanted = clamp(S.wanted + n, 0, 5);
  S.evading = 0;
  if (S.wanted > before) sfxSirenBlip();
  return S.wanted;
}

let unitSeq = 0;
const UNIT_NAMES = ['CORAL', 'MARLIN', 'KITE', 'REEF', 'TIDE', 'SURGE'];

function spawnCruiser() {
  const { group, wheels } = makeCar(0xf5f5f5, { police: true });
  const a = Math.random() * Math.PI * 2;
  const x = S.px + Math.cos(a) * 55;
  const z = S.pz + Math.sin(a) * 55;
  group.position.set(x, 0, z);
  sceneRef.add(group);
  unitSeq++;
  const c = { group, wheels, heading: Math.atan2(S.px - x, S.pz - z), speed: 0, x, z, name: UNIT_NAMES[unitSeq % UNIT_NAMES.length] + '-' + (unitSeq % 9 + 1), hp: 100 };
  cruisers.push(c);
  return c;
}

function spawnOfficer() {
  const g = buildOfficer();
  const a = Math.random() * Math.PI * 2;
  const x = S.px + Math.cos(a) * 22;
  const z = S.pz + Math.sin(a) * 22;
  g.position.set(x, 0, z);
  sceneRef.add(g);
  const o = { group: g, x, z, heading: 0, shootCd: 1 + Math.random(), hp: 100 };
  const t = addShootTarget(g, 'officer', 100, (target) => {
    if (target.hp <= 0) {
      const idx = officers.findIndex((oo) => oo.group === g);
      if (idx >= 0) officers.splice(idx, 1);
      removeShootTarget(target);
      addWanted(1, 'officer down');
    }
  });
  o.target = t;
  officers.push(o);
  return o;
}

function spawnHeli() {
  const h = buildHeli();
  h.group.position.set(S.px + 20, 42, S.pz - 10);
  sceneRef.add(h.group);
  const { beam, pool } = buildBeam();
  sceneRef.add(beam);
  sceneRef.add(pool);
  h.beam = beam; h.pool = pool;
  h.prevX = h.group.position.x; h.prevZ = h.group.position.z;
  heli = h;
}

function removeHeli() {
  if (!heli) return;
  sceneRef.remove(heli.group);
  if (heli.beam) sceneRef.remove(heli.beam);
  if (heli.pool) sceneRef.remove(heli.pool);
  heli = null;
}

// --- police roadblock (3+ stars): 2 cruisers + striped barriers across
// the road ahead of the player. A real GTA feature — chases feel real.
let barrierTex = null;
function makeBarrierTexture() {
  if (barrierTex) return barrierTex;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#f5f5f5'; g.fillRect(0, 0, 128, 32);
  g.fillStyle = '#d32f2f';
  for (let x = -32; x < 128; x += 32) {
    g.beginPath();
    g.moveTo(x, 32); g.lineTo(x + 16, 0); g.lineTo(x + 32, 0); g.lineTo(x + 16, 32);
    g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  barrierTex = t;
  return t;
}

function spawnRoadblock() {
  if (roadblock) return;
  // road ahead: snap to the nearest road centre line along the player's heading
  const fx = Math.sin(S.heading), fz = Math.cos(S.heading);
  const ahead = 45;
  const alongX = Math.abs(fx) > Math.abs(fz);
  const roads = [-256, -192, -128, -64, 0, 64, 128, 192, 256];
  const nearest = (v) => roads.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a);
  const cx = alongX ? S.px + fx * ahead : nearest(S.px);
  const cz = alongX ? nearest(S.pz) : S.pz + fz * ahead;
  const meshes = [];
  const cols = [];
  const rcs = [];
  const addCollider = (x, z, hx, hz) => {
    const c = { x, z, hx, hz };
    colliders.push(c);
    cols.push(c);
  };
  // two cruisers parked across the road (facing the player), one per side
  for (const side of [-1, 1]) {
    const { group } = makeCar(0xf5f5f5, { police: true });
    const ox = alongX ? 0 : side * 6.5;
    const oz = alongX ? side * 6.5 : 0;
    group.position.set(cx + ox, 0, cz + oz);
    group.rotation.y = alongX ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    sceneRef.add(group);
    meshes.push(group);
    rcs.push(group);
    addCollider(cx + ox, cz + oz, alongX ? 1.2 : 2.4, alongX ? 2.4 : 1.2);
  }
  // striped barriers filling the gaps between / beside the cruisers
  const tex = makeBarrierTexture();
  const barMat = new THREE.MeshBasicMaterial({ map: tex });
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  for (const off of [-9.5, -3.2, 3.2, 9.5]) {
    const bar = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 0.12), barMat);
    board.position.y = 0.85; bar.add(board);
    for (const lx of [-1.4, 1.4]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.5), legMat);
      leg.position.set(lx, 0.42, 0); bar.add(leg);
    }
    const bx = alongX ? cx : cx + off;
    const bz = alongX ? cz + off : cz;
    bar.position.set(bx, 0, bz);
    bar.rotation.y = alongX ? 0 : Math.PI / 2;
    sceneRef.add(bar);
    meshes.push(bar);
    addCollider(bx, bz, alongX ? 1.8 : 0.4, alongX ? 0.4 : 1.8);
  }
  roadblock = { meshes, cols, cruisers: rcs };
}

function removeRoadblock() {
  if (!roadblock) return;
  for (const m of roadblock.meshes) sceneRef.remove(m);
  for (const c of roadblock.cols) {
    const i = colliders.indexOf(c);
    if (i >= 0) colliders.splice(i, 1);
  }
  roadblock = null;
}

export function policeTick(dt) {
  flashT += dt;
  // --- maintain force levels from wanted stars ---
  const wantCruisers = S.wanted >= 1 ? Math.min(S.wanted, 4) : 0;
  while (cruisers.length < wantCruisers) spawnCruiser();
  while (cruisers.length > wantCruisers) {
    const c = cruisers.pop();
    sceneRef.remove(c.group);
  }
  const wantOfficers = S.wanted >= 2 ? Math.min((S.wanted - 1) * 2, 6) : 0;
  while (officers.length < wantOfficers) spawnOfficer();
  while (officers.length > wantOfficers) {
    const o = officers.pop();
    removeShootTarget(o.target);
  }
  if (S.wanted >= 3 && !heli) spawnHeli();
  if (S.wanted < 3 && heli) removeHeli();
  // roadblock at 3+ stars, gone when the heat drops
  if (S.wanted >= 3) spawnRoadblock();
  else removeRoadblock();

  // --- cruisers chase: steer toward the player, ram speed just under a good car ---
  for (const c of cruisers) {
    const dx = S.px - c.x, dz = S.pz - c.z;
    const dist = Math.hypot(dx, dz) || 1;
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - c.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    c.heading += clamp(dh, -1.6 * dt, 1.6 * dt);
    const targetSpeed = dist > 8 ? 32 : 12;
    c.speed += (targetSpeed - c.speed) * Math.min(1, dt * 0.9);
    c.x += Math.sin(c.heading) * c.speed * dt;
    c.z += Math.cos(c.heading) * c.speed * dt;
    // slide around buildings instead of stalling against a wall
    const cp = resolveCollisions(c.x, c.z, 2.2);
    if (cp.x !== c.x || cp.z !== c.z) c.speed *= 0.55;
    c.x = cp.x; c.z = cp.z;
    c.group.position.set(c.x, 0, c.z);
    c.group.rotation.y = c.heading;
    for (const w of c.wheels) w.rotation.x += (c.speed * dt) / 0.38;
    // flash the light bar
    const on = Math.sin(flashT * 10) > 0;
    if (c.group.userData.lightRed) c.group.userData.lightRed.material.color.setHex(on ? 0xff2020 : 0x550000);
    if (c.group.userData.lightBlue) c.group.userData.lightBlue.material.color.setHex(on ? 0x102060 : 0x2040ff);
    // ramming the player on foot hurts (not during staged shots)
    if (!S.shotMode && !S.inCar && dist < 2.4) {
      S.health = Math.max(0, S.health - 26 * dt);
      S.px += Math.sin(c.heading) * 6 * dt;
      S.pz += Math.cos(c.heading) * 6 * dt;
    }
    // ramming the player's car damages it (not during staged shots)
    if (!S.shotMode && S.inCar && S.car && dist < 4.2) {
      S.car.health = Math.max(0, S.car.health - 8 * dt);
      S.car.speed *= 0.995;
    }
  }

  // --- officers chase on foot and shoot when close ---
  for (const o of officers) {
    const dx = S.px - o.x, dz = S.pz - o.z;
    const dist = Math.hypot(dx, dz) || 1;
    o.heading = Math.atan2(dx, dz);
    if (dist > 6) {
      o.x += Math.sin(o.heading) * 5.6 * dt;
      o.z += Math.cos(o.heading) * 5.6 * dt;
      const op = resolveCollisions(o.x, o.z, 0.6);
      o.x = op.x; o.z = op.z;
    }
    o.group.position.set(o.x, 0, o.z);
    o.group.rotation.y = o.heading;
    o.group.position.y = Math.abs(Math.sin(S.time * 9 + o.x)) * 0.04;
    o.shootCd -= dt;
    if (dist < 45 && o.shootCd <= 0) {
      o.shootCd = 1.1 + Math.random() * 0.8;
      if (Math.random() < 0.45) S.health = Math.max(0, S.health - 6);
    }
  }

  // --- helicopter: hover above, rotor spins, spotlight tracks the player ---
  if (heli) {
    const hx = S.px + Math.sin(S.time * 0.35) * 14;
    const hz = S.pz + Math.cos(S.time * 0.27) * 14;
    heli.group.position.x += (hx - heli.group.position.x) * Math.min(1, dt * 0.8);
    heli.group.position.z += (hz - heli.group.position.z) * Math.min(1, dt * 0.8);
    heli.group.position.y = (S.heliAlt || 42) + Math.sin(S.time * 0.8) * 1.2;
    heli.group.rotation.y = Math.atan2(S.px - heli.group.position.x, S.pz - heli.group.position.z);
    heli.rotor.rotation.y += dt * 22;
    heli.tailRotor.rotation.z += dt * 30;
    // BANK + TILT: roll into turns, nose dips when moving forward (real aircraft feel)
    if (dt > 0) {
      const vx = (heli.group.position.x - heli.prevX) / dt;
      const vz = (heli.group.position.z - heli.prevZ) / dt;
      const h = heli.group.rotation.y;
      const fwd = vx * Math.sin(h) + vz * Math.cos(h);
      const lat = vx * Math.cos(h) - vz * Math.sin(h);
      heli.group.rotation.x = clamp(fwd * 0.012, -0.18, 0.18);
      heli.group.rotation.z = clamp(-lat * 0.012, -0.3, 0.3);
    }
    heli.prevX = heli.group.position.x; heli.prevZ = heli.group.position.z;
    // SEARCHLIGHT: beam apex AT the lamp, aimed at the player, ground pool
    // where it lands. Re-aimed every frame so it tracks the helicopter.
    const lampWorld = heli.group.localToWorld(heli.lampLocal.clone());
    const target = new THREE.Vector3(S.px, 0, S.pz);
    const toTarget = target.clone().sub(lampWorld);
    const dist = Math.max(1, toTarget.length());
    const dir = toTarget.normalize();
    heli.beam.position.copy(lampWorld);
    heli.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    const s = dist / 30;
    heli.beam.scale.set(s, s, s);
    heli.pool.position.set(S.px, 0.09, S.pz);
    heli.pool.scale.setScalar(s);
  }

  // --- seen? any police close, or the helicopter is up ---
  let seen = false;
  for (const c of cruisers) if (Math.hypot(c.x - S.px, c.z - S.pz) < 70) seen = true;
  for (const o of officers) if (Math.hypot(o.x - S.px, o.z - S.pz) < 55) seen = true;
  if (heli) seen = true;
  S.seen = seen;

  // --- EVADING: fills while unseen, 100% drops a star ---
  if (S.wanted > 0) {
    if (!seen) {
      S.evading = clamp(S.evading + dt * 14, 0, 100);
      if (S.evading >= 100) {
        S.wanted = Math.max(0, S.wanted - 1);
        S.evading = 0;
      }
    } else {
      S.evading = Math.max(0, S.evading - dt * 30);
    }
  } else {
    S.evading = 0;
  }

  // --- busted: health hits zero ---
  if (S.health <= 0 && !S.over) {
    S.over = true;
    S.wanted = 0;
  }
}

export function nearestPoliceDist() {
  let d = Infinity;
  for (const c of cruisers) d = Math.min(d, Math.hypot(c.x - S.px, c.z - S.pz));
  for (const o of officers) d = Math.min(d, Math.hypot(o.x - S.px, o.z - S.pz));
  return d;
}

// Police RESPONSE panel data: unit name + distance + status, for the HUD.
// Status: SEARCHING (unseen), PURSUIT (seen, closing), FIRING (officer shooting).
export function policeUnits() {
  const units = [];
  for (const c of cruisers) {
    const d = Math.hypot(c.x - S.px, c.z - S.pz);
    const status = d < 10 ? 'PURSUIT' : S.seen ? 'PURSUIT' : 'SEARCHING';
    units.push({ name: c.name || 'UNIT', dist: Math.round(d), status });
  }
  for (let i = 0; i < officers.length; i++) {
    const o = officers[i];
    const d = Math.hypot(o.x - S.px, o.z - S.pz);
    const status = d < 45 ? 'FIRING' : S.seen ? 'PURSUIT' : 'SEARCHING';
    units.push({ name: 'FOOT-' + (i + 1), dist: Math.round(d), status });
  }
  if (S.wanted >= 3) {
    const hd = heli ? Math.round(Math.hypot(heli.group.position.x - S.px, heli.group.position.z - S.pz)) : 0;
    units.push({ name: 'HELI-1', dist: hd, status: 'PURSUIT' });
  }
  return units;
}
