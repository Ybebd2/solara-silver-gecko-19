// SOLARA — police.js
// Wanted system: cruisers + officers chase on the ground, and at 3+ stars a
// detailed white helicopter joins with a searchlight. The beam is computed
// from the lamp's LIVE world position every frame — apex at the spotlight
// under the heli nose, bright pool at the exact ground hit point.

import * as THREE from 'three';
import { S } from './config.js';

export const cruisers = [];
export const officers = [];

let heli = null;
let heliLamp = null;
let heliBeam = null;
let heliPool = null;
let heliRotor = null;
let sceneRef = null;
let flashT = 0;

function buildCruiserMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.6, 4.3),
    new THREE.MeshLambertMaterial({ color: 0xf2f2f2 })
  );
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.5, 2.0),
    new THREE.MeshLambertMaterial({ color: 0x1a2433 })
  );
  cabin.position.set(0, 1.05, -0.2);
  g.add(cabin);
  // blue stripe along the side
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(1.92, 0.18, 4.32),
    new THREE.MeshLambertMaterial({ color: 0x1565c0 })
  );
  stripe.position.y = 0.62;
  g.add(stripe);
  // light bar on the roof: red left, blue right, flashing in policeTick
  const barL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  barL.position.set(-0.45, 1.4, -0.2);
  barL.name = 'barL';
  g.add(barL);
  const barR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
  barR.position.set(0.45, 1.4, -0.2);
  barR.name = 'barR';
  g.add(barR);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10), wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
  }
  return g;
}

function buildOfficerMesh() {
  const g = new THREE.Group();
  const uni = new THREE.MeshLambertMaterial({ color: 0x1a3a6b });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.3), uni);
  torso.position.y = 1.1;
  g.add(torso);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xc98e6a })
  );
  head.position.y = 1.62;
  g.add(head);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.21, 0.1, 10),
    new THREE.MeshLambertMaterial({ color: 0x0d2137 })
  );
  cap.position.y = 1.78;
  g.add(cap);
  for (const sx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.62, 0.17), new THREE.MeshLambertMaterial({ color: 0x14181f }));
    leg.position.set(sx, 0.35, 0);
    g.add(leg);
  }
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  g.add(blob);
  return g;
}

function buildHeli() {
  const g = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xf5f5f5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 5.2), white);
  body.position.y = 0;
  g.add(body);
  // blue stripe along the body
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.35, 5.24), new THREE.MeshLambertMaterial({ color: 0x1565c0 }));
  stripe.position.y = 0.25;
  g.add(stripe);
  // glass nose
  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(1.0, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0x1a2a3a })
  );
  nose.scale.set(1, 0.75, 1.1);
  nose.position.set(0, 0.1, 2.4);
  g.add(nose);
  // tail boom + tail fin
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 4.2, 8), white);
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, 0.25, -4.4);
  g.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 1.0), white);
  fin.position.set(0, 1.0, -6.3);
  g.add(fin);
  // skids
  const skidMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  for (const sx of [-0.9, 0.9]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.4, 6), skidMat);
    skid.rotation.x = Math.PI / 2;
    skid.position.set(sx, -1.0, 0.2);
    g.add(skid);
  }
  // main rotor mast + blades + blur disc
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 6), skidMat);
  mast.position.y = 1.1;
  g.add(mast);
  heliRotor = new THREE.Group();
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 7.6), bladeMat);
    blade.rotation.y = a;
    heliRotor.add(blade);
  }
  const blur = new THREE.Mesh(
    new THREE.CircleGeometry(3.9, 24),
    new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide })
  );
  blur.rotation.x = -Math.PI / 2;
  heliRotor.add(blur);
  heliRotor.position.y = 1.5;
  g.add(heliRotor);
  // SEARCHLIGHT: a real lamp under the nose, with a bright lens. The beam
  // cone below is positioned from THIS lamp's world position each frame.
  heliLamp = new THREE.Group();
  heliLamp.position.set(0, -0.85, 2.0);
  const lampBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.38, 0.35, 10),
    new THREE.MeshLambertMaterial({ color: 0x444444 })
  );
  heliLamp.add(lampBody);
  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 12),
    new THREE.MeshBasicMaterial({ color: 0xfffbe0 })
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.y = -0.19;
  heliLamp.add(lens);
  g.add(heliLamp);
  g.visible = false;
  return g;
}

export function buildPolice(scene) {
  sceneRef = scene;
  heli = buildHeli();
  scene.add(heli);
  // beam cone: apex narrow at the lamp, wide at the ground (opacity 0.3)
  heliBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 3.0, 1, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff6c9, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide,
    })
  );
  heliBeam.visible = false;
  scene.add(heliBeam);
  // bright pool on the ground at the exact hit point (opacity 0.65)
  heliPool = new THREE.Mesh(
    new THREE.CircleGeometry(3.0, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.65, depthWrite: false })
  );
  heliPool.rotation.x = -Math.PI / 2;
  heliPool.position.y = 0.06;
  heliPool.visible = false;
  scene.add(heliPool);
}

export function addWanted(n, reason) {
  S.wanted = Math.min(5, S.wanted + n);
  S.seen = true;
  S.evading = 0;
}

function spawnPos() {
  const a = Math.random() * Math.PI * 2;
  const r = 55 + Math.random() * 30;
  return {
    x: Math.max(-300, Math.min(300, S.px + Math.cos(a) * r)),
    z: Math.max(-300, Math.min(300, S.pz + Math.sin(a) * r)),
  };
}

function wantCounts() {
  switch (S.wanted) {
    case 1: return { cruisers: 1, officers: 1 };
    case 2: return { cruisers: 2, officers: 2 };
    case 3: return { cruisers: 3, officers: 4 };
    case 4: return { cruisers: 4, officers: 5 };
    case 5: return { cruisers: 5, officers: 6 };
    default: return { cruisers: 0, officers: 0 };
  }
}

export function policeTick(dt) {
  if (!sceneRef) return;
  flashT += dt;
  const want = wantCounts();

  // spawn up to the wanted level's counts
  while (cruisers.length < want.cruisers) {
    const p = spawnPos();
    const g = buildCruiserMesh();
    g.position.set(p.x, 0, p.z);
    sceneRef.add(g);
    cruisers.push({ group: g, x: p.x, z: p.z, heading: 0, name: 'MARLIN-' + (cruisers.length + 1) });
  }
  while (officers.length < want.officers) {
    const p = spawnPos();
    const g = buildOfficerMesh();
    g.position.set(p.x, 0, p.z);
    sceneRef.add(g);
    officers.push({ group: g, x: p.x, z: p.z, heading: 0, name: 'FOOT-' + (officers.length + 1) });
  }
  // remove extras when the heat drops
  while (cruisers.length > want.cruisers) {
    const c = cruisers.pop();
    sceneRef.remove(c.group);
  }
  while (officers.length > want.officers) {
    const o = officers.pop();
    sceneRef.remove(o.group);
  }

  // cruisers chase: steer toward the player at speed 32, flash the light bar
  const flash = Math.sin(flashT * 14) > 0;
  for (const c of cruisers) {
    const dx = S.px - c.x;
    const dz = S.pz - c.z;
    const dist = Math.hypot(dx, dz) || 1;
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - c.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    c.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
    const speed = dist > 6 ? 32 : 12;
    c.x += Math.sin(c.heading) * speed * dt;
    c.z += Math.cos(c.heading) * speed * dt;
    c.group.position.set(c.x, 0, c.z);
    c.group.rotation.y = c.heading;
    const barL = c.group.getObjectByName('barL');
    const barR = c.group.getObjectByName('barR');
    if (barL) barL.material.color.setHex(flash ? 0xff2222 : 0x661111);
    if (barR) barR.material.color.setHex(flash ? 0x111166 : 0x2244ff);
  }

  // officers run at the player at speed 5.6
  for (const o of officers) {
    const dx = S.px - o.x;
    const dz = S.pz - o.z;
    const dist = Math.hypot(dx, dz) || 1;
    o.heading = Math.atan2(dx, dz);
    if (dist > 1.6) {
      o.x += (dx / dist) * 5.6 * dt;
      o.z += (dz / dist) * 5.6 * dt;
    }
    o.group.position.set(o.x, Math.abs(Math.sin(S.time * 9 + o.x)) * 0.05, o.z);
    o.group.rotation.y = o.heading;
  }

  // seen / evading: a unit within 28 m means the cops have eyes on Kai
  let anyNear = false;
  for (const c of cruisers) if (Math.hypot(c.x - S.px, c.z - S.pz) < 28) anyNear = true;
  for (const o of officers) if (Math.hypot(o.x - S.px, o.z - S.pz) < 28) anyNear = true;
  if (S.wanted > 0) {
    if (anyNear) { S.seen = true; S.evading = 0; }
    else {
      S.seen = false;
      S.evading = Math.min(100, S.evading + dt * 14);
      if (S.evading >= 100) {
        S.wanted = Math.max(0, S.wanted - 1);
        S.evading = 0;
      }
    }
  }

  // helicopter at 3+ stars: hover above the player, bob, bank, beam on Kai
  const heliOn = S.wanted >= 3;
  heli.visible = heliOn;
  heliBeam.visible = heliOn;
  heliPool.visible = heliOn;
  if (heliOn) {
    const bob = Math.sin(S.time * 1.4) * 1.2;
    const hx = S.px + Math.sin(S.time * 0.5) * 6;
    const hz = S.pz + Math.cos(S.time * 0.4) * 6;
    const hy = 24 + bob;
    heli.position.set(hx, hy, hz);
    // bank into the turn: tilt with the sideways drift
    heli.rotation.z = Math.cos(S.time * 0.5) * 0.12;
    heli.rotation.x = Math.sin(S.time * 0.4) * 0.08;
    heli.rotation.y = Math.atan2(S.px - hx, S.pz - hz);
    if (heliRotor) heliRotor.rotation.y += dt * 28;

    // BEAM: apex = the lamp's live world position (under the nose),
    // direction straight to the player on the ground, pool at the hit point.
    const lampPos = new THREE.Vector3();
    heliLamp.getWorldPosition(lampPos);
    const hit = new THREE.Vector3(S.px, 0.06, S.pz);
    const dir = hit.clone().sub(lampPos);
    const len = dir.length();
    dir.normalize();
    heliBeam.scale.set(1, len, 1);
    heliBeam.position.copy(lampPos).addScaledVector(dir, len / 2);
    heliBeam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
    heliPool.position.set(hit.x, 0.06, hit.z);
  }
}

export function policeUnits() {
  const list = [];
  for (const c of cruisers) {
    const d = Math.round(Math.hypot(c.x - S.px, c.z - S.pz));
    list.push({ name: c.name, dist: d, status: d < 12 ? 'FIRING' : 'PURSUIT' });
  }
  for (const o of officers) {
    const d = Math.round(Math.hypot(o.x - S.px, o.z - S.pz));
    list.push({ name: o.name, dist: d, status: d < 4 ? 'FIRING' : 'PURSUIT' });
  }
  if (S.wanted >= 3 && heli) {
    const d = Math.round(Math.hypot(heli.position.x - S.px, heli.position.z - S.pz));
    list.push({ name: 'HELI-1', dist: d, status: 'PURSUIT' });
  }
  return list;
}
