// SOLARA — vehicles.js
// Traffic sedans on the road grid, parked cars on Neon Row, and the
// drive/jack system. Cars are built from boxes with headlights at the front
// and sit ON the asphalt — never floating, never on the sidewalk.

import * as THREE from 'three';
import { S } from './config.js';
import { solidAt } from './world.js';

export const traffic = [];
const parked = [];

const CAR_COLORS = [0xe63946, 0x2a9d8f, 0xf4a261, 0x4361ee, 0xffe066, 0x9b5de5, 0x06d6a0, 0xef476f, 0x118ab2, 0xffffff];
const CAR_NAMES = ['COMET', 'FALCON', 'NIGHTHAWK', 'SOLSTICE', 'MARLIN', 'COUGAR', 'VORTEX', 'DUCHESS'];

function buildCarMesh(color, isPlayer) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.3), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.55, 2.1),
    new THREE.MeshLambertMaterial({ color: 0x1a2433 })
  );
  cabin.position.set(0, 1.05, -0.25);
  g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 2.0), bodyMat);
  roof.position.set(0, 1.36, -0.25);
  g.add(roof);
  // wheels — planted on the asphalt (radius 0.36, centre at 0.36)
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    g.add(wheel);
  }
  // headlights at the FRONT (+Z), taillights at the back — light comes from
  // the lamps, so they sit exactly on the body, not floating ahead of it.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const hx of [-0.62, 0.62]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.06), headMat);
    h.position.set(hx, 0.62, 2.16);
    g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const hx of [-0.62, 0.62]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), tailMat);
    t.position.set(hx, 0.62, -2.16);
    g.add(t);
  }
  if (isPlayer) {
    // a gold stripe so the player's ride reads at a glance
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 4.32), new THREE.MeshBasicMaterial({ color: 0xffd23a }));
    stripe.position.set(0, 0.88, 0);
    g.add(stripe);
  }
  return g;
}

function makeCar(scene, x, z, heading, color, name, speed) {
  const group = buildCarMesh(color, false);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  return { group, x, z, heading, speed, name, health: 100, color };
}

export function buildVehicles(scene) {
  const ROADS = [-256, -192, -128, -64, 0, 64, 128, 192, 256];
  // 20 traffic sedans, in platoons of 3-4 per road so the street reads
  // bumper-to-bumper, both directions, lanes at +/-3.2 from the centre line.
  let placed = 0;
  let roadIdx = 0;
  while (placed < 20) {
    const road = ROADS[roadIdx % ROADS.length];
    const horizontal = roadIdx % 2 === 0;
    const lane = (placed % 2 === 0 ? 3.2 : -3.2);
    const dir = placed % 2 === 0 ? 1 : -1;
    const platoon = 3 + (placed % 2);
    for (let i = 0; i < platoon && placed < 20; i++) {
      const along = -120 + ((placed * 53 + i * 9) % 240);
      const x = horizontal ? along : road + lane;
      const z = horizontal ? road + lane : along;
      const heading = horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      const car = makeCar(scene, x, z, heading, CAR_COLORS[placed % CAR_COLORS.length],
        CAR_NAMES[placed % CAR_NAMES.length], 8 + (placed % 5) * 1.4);
      car.horizontal = horizontal;
      car.road = road;
      car.lane = lane;
      car.dir = dir;
      traffic.push(car);
      placed++;
    }
    roadIdx++;
  }
  // 2 parked cars on Neon Row (z = -192), on the asphalt by the curb
  for (let i = 0; i < 2; i++) {
    const car = makeCar(scene, -20 + i * 26, -192 + 3.2, Math.PI / 2,
      CAR_COLORS[(i + 3) % CAR_COLORS.length], CAR_NAMES[(i + 2) % CAR_NAMES.length], 0);
    car.horizontal = true;
    car.road = -192;
    car.lane = 3.2;
    car.dir = 1;
    car.parked = true;
    parked.push(car);
  }
}

export function trafficTick(dt) {
  for (const c of traffic) {
    // keep a gap to the car ahead in the same lane
    let targetSpeed = c.speed;
    for (const o of traffic) {
      if (o === c || o.road !== c.road || o.lane !== c.lane || o.horizontal !== c.horizontal) continue;
      const gap = c.horizontal ? (o.x - c.x) * c.dir : (o.z - c.z) * c.dir;
      if (gap > 0 && gap < 9) { targetSpeed = Math.min(targetSpeed, o.speed * 0.6); break; }
    }
    if (c.horizontal) {
      c.x += c.dir * targetSpeed * dt;
      if (c.x > 310) c.x = -310;
      if (c.x < -310) c.x = 310;
    } else {
      c.z += c.dir * targetSpeed * dt;
      if (c.z > 310) c.z = -310;
      if (c.z < -310) c.z = 310;
    }
    c.group.position.set(c.x, 0, c.z);
    c.group.rotation.y = c.heading;
  }
}

export function nearestCar(px, pz) {
  let best = null;
  let bestD = 16;
  for (const c of traffic) {
    const d = Math.hypot(c.x - px, c.z - pz);
    if (d < bestD) { bestD = d; best = c; }
  }
  for (const c of parked) {
    const d = Math.hypot(c.x - px, c.z - pz);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (S.car) {
    const d = Math.hypot(S.car.x - px, S.car.z - pz);
    if (d < bestD) { bestD = d; best = S.car; }
  }
  return best;
}

export function enterCar(car) {
  const idx = traffic.indexOf(car);
  if (idx >= 0) traffic.splice(idx, 1);
  const pIdx = parked.indexOf(car);
  if (pIdx >= 0) parked.splice(pIdx, 1);
  S.inCar = true;
  S.car = car;
  S.carSpeed = 0;
  S.px = car.x;
  S.pz = car.z;
  S.heading = car.heading;
  // rebuild the mesh with the player stripe so the jacked ride is marked
  car.group.clear();
  const fresh = buildCarMesh(car.color, true);
  for (const child of fresh.children) car.group.add(child);
}

export function exitCar() {
  if (!S.car) return;
  const car = S.car;
  S.inCar = false;
  S.car = null;
  S.carSpeed = 0;
  S.autopilot = false;
  // step out to the side of the car, on the road
  S.px = car.x + Math.cos(car.heading) * 2.2;
  S.pz = car.z - Math.sin(car.heading) * 2.2;
  // the car stays where it stopped, as a parked car
  car.parked = true;
  car.speed = 0;
  parked.push(car);
}

export function driveTick(dt, k) {
  const car = S.car;
  if (!car) return;
  const accel = 22;
  const maxSpeed = 40;
  const maxReverse = 10;
  if (k.KeyW || k.ArrowUp) S.carSpeed += accel * dt;
  else if (k.KeyS || k.ArrowDown) S.carSpeed -= accel * 1.4 * dt;
  else S.carSpeed *= Math.pow(0.4, dt);
  S.carSpeed = Math.max(-maxReverse, Math.min(maxSpeed, S.carSpeed));
  const steer = (k.KeyA || k.ArrowLeft ? 1 : 0) - (k.KeyD || k.ArrowRight ? 1 : 0);
  if (Math.abs(S.carSpeed) > 0.5) {
    car.heading += steer * 1.5 * dt * Math.sign(S.carSpeed) * Math.min(1, Math.abs(S.carSpeed) / 12);
  }
  const nx = car.x + Math.sin(car.heading) * S.carSpeed * dt;
  const nz = car.z + Math.cos(car.heading) * S.carSpeed * dt;
  // stop at buildings instead of driving through them
  if (!solidAt(nx, nz)) {
    car.x = nx;
    car.z = nz;
  } else {
    S.carSpeed *= 0.25;
  }
  car.x = Math.max(-315, Math.min(315, car.x));
  car.z = Math.max(-315, Math.min(315, car.z));
  S.px = car.x;
  S.pz = car.z;
  S.heading = car.heading;
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  if (S.carSpeed < 0.2 && S.carSpeed > -0.2) S.carSpeed = 0;
}
