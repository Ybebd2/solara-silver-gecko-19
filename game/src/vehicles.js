// SOLARA — vehicles.js (fresh build from spec, round 8)
// Traffic cars + the player's car: spawn, drive, jack, park.

import * as THREE from 'three';
import { WORLD } from './config.js';

const CAR_COLORS = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa', '#fb8c00', '#00acc1', '#f5f5f5', '#212121', '#ec407a'];

function makeCarMesh(color, sporty = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(sporty ? 4.6 : 4.2, 0.85, 2.0), bodyMat);
  body.position.y = 0.75;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.7, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.2 })
  );
  cabin.position.set(-0.2, 1.45, 0);
  g.add(cabin);
  // headlights — light comes FROM its source
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff176, emissiveIntensity: 2.0 });
  for (const z of [-0.65, 0.65]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.4), lightMat);
    lamp.position.set(2.15, 0.75, z);
    g.add(lamp);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.2 });
  for (const z of [-0.65, 0.65]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.4), tailMat);
    tail.position.set(-2.15, 0.75, z);
    g.add(tail);
  }
  // wheels, ON the asphalt
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  for (const [wx, wz] of [[1.4, 0.95], [1.4, -0.95], [-1.4, 0.95], [-1.4, -0.95]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    g.add(wheel);
  }
  return g;
}

function randLane(rand) {
  // pick a road line and a lane offset (+/- 5)
  const lines = [];
  for (let k = -4; k <= 4; k++) lines.push(k * WORLD.roadGap);
  const line = lines[Math.floor(rand() * lines.length)];
  return { line, lane: rand() > 0.5 ? 5 : -5 };
}

export function createVehicles(scene, S) {
  let seed = 4242;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const traffic = [];
  const group = new THREE.Group();
  scene.add(group);

  function spawnTrafficCar(x, z, heading, speed) {
    const color = CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)];
    const mesh = makeCarMesh(color);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    group.add(mesh);
    const car = { mesh, x, z, heading, speed, color, sporty: false };
    traffic.push(car);
    return car;
  }

  // Ambient traffic: cars cruising the road grid in both directions.
  for (let i = 0; i < 26; i++) {
    const horiz = rand() > 0.5;
    const { line, lane } = randLane(rand);
    const along = -300 + rand() * 600;
    const speed = 8 + rand() * 10;
    if (horiz) {
      spawnTrafficCar(along, line + lane, rand() > 0.5 ? 0 : Math.PI, speed * (rand() > 0.5 ? 1 : -1));
    } else {
      spawnTrafficCar(line + lane, along, rand() > 0.5 ? Math.PI / 2 : -Math.PI / 2, speed * (rand() > 0.5 ? 1 : -1));
    }
  }

  // A red sports car parked near the spawn for the player to grab.
  const starter = makeCarMesh('#e53935', true);
  starter.position.set(-32, 0, 52);
  starter.rotation.y = Math.PI * 0.75;
  group.add(starter);
  const starterCar = { mesh: starter, x: -32, z: 52, heading: Math.PI * 0.75, speed: 0, color: '#e53935', sporty: true };
  traffic.push(starterCar);

  function nearestCar(x, z, maxDist = 6) {
    let best = null, bestD = maxDist;
    for (const c of traffic) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }

  function update(dt, S, input) {
    // ambient traffic drives along its road, wraps at the edge
    for (const c of traffic) {
      if (S.inCar && S.car === c) continue; // player drives this one
      if (S.shotMode) continue; // staged shots freeze traffic
      const vx = Math.cos(c.heading) * c.speed;
      const vz = -Math.sin(c.heading) * c.speed;
      c.x += vx * dt;
      c.z += vz * dt;
      if (c.x > 315) c.x = -315;
      if (c.x < -315) c.x = 315;
      if (c.z > 315) c.z = -315;
      if (c.z < -315) c.z = 315;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
    }
    // player car follows the player state
    if (S.inCar && S.car) {
      S.car.x = S.px;
      S.car.z = S.pz;
      S.car.heading = S.heading;
      S.car.mesh.position.set(S.px, 0, S.pz);
      S.car.mesh.rotation.y = S.heading;
    }
  }

  return { traffic, starterCar, nearestCar, spawnTrafficCar, makeCarMesh, update };
}
