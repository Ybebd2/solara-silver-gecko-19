// SOLARA — vehicles.js
// Shaped cars: hood wedge, sloped windshield, cabin, spoiler, wheels with
// hubcaps, headlight + horizontal taillight strip. Traffic AI follows the
// road grid. Player driving + carjacking live here.

import * as THREE from 'three';
import { S, WORLD, clamp } from './config.js';
import { resolveCollisions, isOnRoad } from './world.js';
import { sfxDoor } from './audio.js';

export const traffic = [];    // {group, wheels, road, dir, speed, color}
export const parked = [];     // {group, wheels, x, z, heading, taken}
let sceneRef = null;

const CAR_COLORS = [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x1c1c1e, 0x16a085, 0xd35400];

// A car that actually looks like a car: low wide body, wedge hood, sloped
// windshield, cabin with roof, rear spoiler, 4 wheels with hubcaps, and a
// full-width red taillight strip.
export function makeCar(color, opts = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14181f, metalness: 0.3, roughness: 0.25 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd8e8, metalness: 0.8, roughness: 0.12 });

  // main lower body
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 4.6), paint);
  body.position.y = 0.55;
  g.add(body);

  // hood wedge: sloped front (a rotated thin box reads as a wedge nose)
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 1.25), paint);
  hood.position.set(0, 0.88, 1.55);
  hood.rotation.x = -0.16;
  g.add(hood);

  // sloped windshield
  const shield = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 1.05), glass);
  shield.position.set(0, 1.12, 0.62);
  shield.rotation.x = -0.62;
  g.add(shield);

  // cabin + roof
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.5, 1.9), paint);
  cabin.position.set(0, 1.05, -0.35);
  g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.7), paint);
  roof.position.set(0, 1.34, -0.35);
  g.add(roof);

  // rear window, sloped the other way
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.9), glass);
  rearGlass.position.set(0, 1.1, -1.35);
  rearGlass.rotation.x = 0.55;
  g.add(rearGlass);

  // spoiler on the trunk
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.07, 0.42), dark);
  spoiler.position.set(0, 1.12, -2.18);
  g.add(spoiler);
  for (const sx of [-0.7, 0.7]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.24, 0.09), dark);
    strut.position.set(sx, 0.98, -2.18);
    g.add(strut);
  }

  // horizontal taillight strip (full width, red, emissive)
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(1.85, 0.14, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xff1a1a })
  );
  tail.position.set(0, 0.72, -2.32);
  g.add(tail);
  // headlights
  for (const hx of [-0.65, 0.65]) {
    const hl = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.14, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xfff6c9 })
    );
    hl.position.set(hx, 0.72, 2.32);
    g.add(hl);
  }

  // front grille + bumper
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.06), dark);
  grille.position.set(0, 0.5, 2.32);
  g.add(grille);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.16, 0.12), dark);
  bumper.position.set(0, 0.32, -2.32);
  g.add(bumper);

  // wheels with silver hubcaps
  const wheels = [];
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.9, roughness: 0.25 });
  for (const [wx, wz] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]]) {
    const wheel = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14), tyreMat);
    tyre.rotation.z = Math.PI / 2;
    wheel.add(tyre);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.32, 10), hubMat);
    hub.rotation.z = Math.PI / 2;
    wheel.add(hub);
    wheel.position.set(wx, 0.38, wz);
    g.add(wheel);
    wheels.push(wheel);
  }

  // side skirts (low side panels, read as a sporty stance)
  for (const sx of [-1.0, 1.0]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 3.4), dark);
    skirt.position.set(sx, 0.28, -0.2);
    g.add(skirt);
  }

  if (opts.police) {
    // white sedan, black hood + roof, thin gold line down the side,
    // red light bar on the roof (Tangerine Mile cruiser style)
    const hoodBlack = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 1.3), dark);
    hoodBlack.position.set(0, 0.98, 1.55);
    hoodBlack.rotation.x = -0.16;
    g.add(hoodBlack);
    const roofBlack = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.1, 1.7), dark);
    roofBlack.position.set(0, 1.36, -0.35);
    g.add(roofBlack);
    for (const sx of [-1.02, 1.02]) {
      const gold = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.08, 4.0),
        new THREE.MeshBasicMaterial({ color: 0xc9a227 })
      );
      gold.position.set(sx, 0.62, -0.2);
      g.add(gold);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.3), dark);
    bar.position.set(0, 1.48, -0.35);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.14, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(0, 1.56, -0.35);
    g.add(red);
    g.userData.lightRed = red; g.userData.lightBlue = null;
    const push = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.3, 0.12), dark);
    push.position.set(0, 0.45, 2.38);
    g.add(push);
  }

  if (opts.taxi) {
    // yellow roof sign + taxi checker band
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.28, 0.35),
      new THREE.MeshBasicMaterial({ color: 0xffd23a })
    );
    sign.position.set(0, 1.55, -0.35);
    g.add(sign);
    for (const sx of [-1.02, 1.02]) {
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.22, 3.2),
        new THREE.MeshBasicMaterial({ color: 0x111111 })
      );
      band.position.set(sx, 0.7, -0.2);
      g.add(band);
    }
  }

  if (opts.van) {
    // boxy van: tall cargo box instead of the low cabin
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 3.4), paint);
    box.position.set(0, 1.15, -0.6);
    g.add(box);
    const vwin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.08), glass);
    vwin.position.set(0, 1.35, 1.15);
    g.add(vwin);
  }

  if (opts.sports) {
    // pop-up headlights ON: two bright white squares raised above the hood
    for (const hx of [-0.65, 0.65]) {
      const pop = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.18, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      pop.position.set(hx, 1.05, 1.85);
      g.add(pop);
    }
  }

  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return { group: g, wheels };
}

const CAR_NAMES = {
  sedan: ['COMET', 'FALCON', 'DUCHESS', 'MERIDIAN', 'SOLSTICE', 'VAGABOND'],
  taxi: ['CABRIO TAXI', 'CITY CAB'],
  van: ['HAULER', 'CARGO VAN'],
  sports: ['VORTEX GT', 'NIGHTHAWK S'],
  police: ['CRUISER', 'INTERCEPTOR'],
};
function pickName(kind) {
  const list = CAR_NAMES[kind] || CAR_NAMES.sedan;
  return list[Math.floor(Math.random() * list.length)];
}

function spawnTrafficCar(scene, opts = {}) {
  const roads = [-256, -192, -128, -64, 0, 64, 128, 192, 256];
  const horizontal = Math.random() < 0.5;
  const road = roads[Math.floor(Math.random() * roads.length)];
  // 4 lanes: two each way — lane offset 2.5 (inner) or 7.5 (outer)
  const lane = Math.random() < 0.5 ? 2.5 : 7.5;
  const dir = Math.random() < 0.5 ? 1 : -1;
  const off = dir > 0 ? lane : -lane;
  let color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
  let carOpts = {};
  if (opts.police) { color = 0xf5f5f5; carOpts = { police: true }; }
  else if (opts.taxi) { color = 0xf1c40f; carOpts = { taxi: true }; }
  else if (opts.van) { color = [0xecf0f1, 0x7f8c8d, 0x2e86c1][Math.floor(Math.random() * 3)]; carOpts = { van: true }; }
  else if (opts.sports) { carOpts = { sports: true }; }
  const { group, wheels } = makeCar(color, carOpts);
  const t = (Math.random() - 0.5) * 500;
  if (horizontal) {
    group.position.set(t, 0, road + off);
    group.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    group.position.set(road + off, 0, t);
    group.rotation.y = dir > 0 ? 0 : Math.PI;
  }
  scene.add(group);
  const kind = opts.police ? 'police' : opts.taxi ? 'taxi' : opts.van ? 'van' : opts.sports ? 'sports' : 'sedan';
  const car = { group, wheels, road, dir, horizontal, speed: 7 + Math.random() * 6, color, kind, name: pickName(kind) };
  traffic.push(car);
  return car;
}

function spawnParkedCar(scene, x, z, heading) {
  const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
  const sports = Math.random() < 0.25;
  const { group, wheels } = makeCar(color, sports ? { sports: true } : {});
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  const car = { group, wheels, x, z, heading, taken: false, kind: sports ? 'sports' : 'sedan', name: pickName(sports ? 'sports' : 'sedan') };
  parked.push(car);
  return car;
}

export function buildVehicles(scene) {
  sceneRef = scene;
  // dense varied traffic: sedans, 2 taxis, 2 boxy vans, 2 sports cars,
  // 2 white police cruisers on patrol
  for (let i = 0; i < 16; i++) spawnTrafficCar(scene);
  spawnTrafficCar(scene, { taxi: true });
  spawnTrafficCar(scene, { taxi: true });
  spawnTrafficCar(scene, { van: true });
  spawnTrafficCar(scene, { van: true });
  spawnTrafficCar(scene, { sports: true });
  spawnTrafficCar(scene, { sports: true });
  spawnTrafficCar(scene, { police: true });
  spawnTrafficCar(scene, { police: true });
  // parked cars along roads near spawn and downtown
  const spots = [
    [-40, 74, 0], [-24, 74, Math.PI], [8, -50, Math.PI / 2], [72, 8, 0],
    [-120, -56, Math.PI], [136, -120, -Math.PI / 2], [-8, 136, Math.PI],
    [200, 72, 0], [-184, 8, Math.PI / 2], [56, 200, 0],
  ];
  for (const [x, z, h] of spots) spawnParkedCar(scene, x, z, h);
}

export function trafficTick(dt) {
  for (const c of traffic) {
    const step = c.speed * dt;
    if (c.horizontal) {
      c.group.position.x += step * c.dir;
      if (c.group.position.x > 310) c.group.position.x = -310;
      if (c.group.position.x < -310) c.group.position.x = 310;
    } else {
      c.group.position.z += step * c.dir;
      if (c.group.position.z > 310) c.group.position.z = -310;
      if (c.group.position.z < -310) c.group.position.z = 310;
    }
    for (const w of c.wheels) w.rotation.x += (c.speed * dt) / 0.38;
  }
}

// Nearest car the player could enter (traffic or parked), within 5 m.
export function nearestCar(px, pz) {
  let best = null, bestD = 5.5;
  for (const c of traffic) {
    const d = Math.hypot(c.group.position.x - px, c.group.position.z - pz);
    if (d < bestD) { bestD = d; best = { kind: 'traffic', ref: c, x: c.group.position.x, z: c.group.position.z, heading: c.group.rotation.y }; }
  }
  for (const c of parked) {
    if (c.taken) continue;
    const d = Math.hypot(c.x - px, c.z - pz);
    if (d < bestD) { bestD = d; best = { kind: 'parked', ref: c, x: c.x, z: c.z, heading: c.heading }; }
  }
  return best;
}

export function enterCar(cand) {
  if (!cand) return null;
  if (cand.kind === 'traffic') {
    const i = traffic.indexOf(cand.ref);
    if (i >= 0) traffic.splice(i, 1);
  } else {
    cand.ref.taken = true;
  }
  const car = {
    group: cand.ref.group, wheels: cand.ref.wheels,
    heading: cand.heading, speed: 0, health: 100,
    x: cand.x, z: cand.z, name: cand.ref.name || 'COMET', kind: cand.ref.kind || 'sedan',
  };
  S.inCar = true;
  S.car = car;
  S.carsJacked++;
  sfxDoor();
  return car;
}

export function exitCar() {
  if (!S.car) return;
  const c = S.car;
  S.px = c.x - Math.sin(c.heading) * 3;
  S.pz = c.z - Math.cos(c.heading) * 3;
  S.heading = c.heading;
  S.inCar = false;
  S.car = null;
  S.carSpeed = 0;
  // leave the car parked where it stopped
  parked.push({ group: c.group, wheels: c.wheels, x: c.x, z: c.z, heading: c.heading, taken: false });
  sfxDoor();
}

// Arcade driving: W accelerate, S brake/reverse, A/D steer.
export function driveTick(dt, keys) {
  const car = S.car;
  if (!car) return;
  const top = 38, accel = 16, brake = 26, drag = 0.6;
  if (keys['KeyW'] || keys['ArrowUp']) car.speed += accel * dt;
  if (keys['KeyS'] || keys['ArrowDown']) car.speed -= (car.speed > 0.5 ? brake : accel * 0.6) * dt;
  car.speed -= car.speed * drag * dt;
  car.speed = clamp(car.speed, -10, top);
  const steer = (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) - (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0);
  const dirSign = car.speed >= 0 ? 1 : -1;
  car.heading += steer * 1.9 * dt * dirSign * clamp(Math.abs(car.speed) / 8, 0, 1);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  const p = resolveCollisions(car.x, car.z, 2.2);
  if (p.x !== car.x || p.z !== car.z) car.speed *= 0.4;
  car.x = p.x; car.z = p.z;
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  // body roll + wheel spin
  car.group.rotation.z = -steer * 0.03 * clamp(Math.abs(car.speed) / 20, 0, 1);
  for (const w of car.wheels) w.rotation.x += (car.speed * dt) / 0.38;
  S.carSpeed = car.speed;
  S.px = car.x; S.pz = car.z;
}
