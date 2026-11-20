// SOLARA — world.js
// Golden-hour coastal city: road grid, buildings with lit windows, neon
// storefront signs (canvas textures with real readable text), beach + ocean,
// palms, streetlights, props. Districts from config.js.

import * as THREE from 'three';
import { WORLD, DISTRICTS } from './config.js';

export const colliders = [];   // {x, z, hx, hz} building AABBs
export const neonSigns = [];   // {mesh, text}
export const roadLines = [];   // road centre lines for traffic routing

let windowTex = null;
let roadTex = null;

function makeWindowTexture(base, lit) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 246; y += 22) {
    for (let x = 8; x < 120; x += 18) {
      const on = Math.random() < 0.42;
      g.fillStyle = on ? lit : 'rgba(20,26,40,0.9)';
      g.fillRect(x, y, 12, 14);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeRoadTexture(alongX) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#23242c'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#3a3b44';
  g.fillRect(0, 0, 128, 6); g.fillRect(0, 122, 128, 6);
  // centre dashes run ALONG the road
  g.fillStyle = '#e8c33a';
  if (alongX) {
    for (let x = 8; x < 128; x += 42) g.fillRect(x, 60, 26, 8);
  } else {
    for (let y = 8; y < 128; y += 42) g.fillRect(60, y, 8, 26);
  }
  g.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 3, 3);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeNeonTexture(text, color, bg = '#12060f') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = color; g.lineWidth = 3;
  g.strokeRect(6, 6, 500, 116);
  g.font = 'bold 64px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 26;
  g.fillStyle = color;
  g.fillText(text, 256, 66);
  g.shadowBlur = 6;
  g.fillStyle = '#ffffff';
  g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function addNeon(scene, text, color, x, y, z, ry, w = 14, h = 3.5) {
  const tex = makeNeonTexture(text, color);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  scene.add(mesh);
  neonSigns.push({ mesh, text });
  return mesh;
}

function addBuilding(scene, x, z, w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, h / 2, z);
  scene.add(m);
  colliders.push({ x, z, hx: w / 2 + 0.6, hz: d / 2 + 0.6 });
  // rooftop box / AC unit for silhouette variety
  if (h > 18) {
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.3, 2.4, d * 0.3),
      new THREE.MeshLambertMaterial({ color: 0x3a3f4a })
    );
    roof.position.set(x - w * 0.2, h + 1.2, z);
    scene.add(roof);
  }
  return m;
}

function addPalm(scene, x, z) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.38, 7, 7),
    new THREE.MeshLambertMaterial({ color: 0x8a6b4a })
  );
  trunk.position.y = 3.5;
  trunk.rotation.z = (Math.random() - 0.5) * 0.16;
  g.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f9e44 });
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.4, 4), leafMat);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.3, 7.2, Math.sin(a) * 1.3);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    g.add(leaf);
  }
  g.position.set(x, 0, z);
  scene.add(g);
}

function addStreetlight(scene, x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.12, 6.4, 6),
    new THREE.MeshLambertMaterial({ color: 0x2c2f36 })
  );
  pole.position.y = 3.2;
  g.add(pole);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.22, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x44484f })
  );
  head.position.set(0.6, 6.4, 0);
  g.add(head);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd27a })
  );
  bulb.position.set(1.1, 6.25, 0);
  g.add(bulb);
  g.position.set(x, 0, z);
  scene.add(g);
}

export function buildWorld(scene) {
  windowTex = makeWindowTexture('#5a4a52', '#ffd27a');
  const roadTexEW = makeRoadTexture(true);
  roadTexEW.repeat.set(80, 1);
  const roadTexNS = makeRoadTexture(false);
  roadTexNS.repeat.set(1, 80);

  // --- ground: city slab + sand + ocean ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.size * 2.4, WORLD.size * 2.4),
    new THREE.MeshLambertMaterial({ color: 0x3d3a35 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(70, WORLD.size * 1.6),
    new THREE.MeshLambertMaterial({ color: 0xe8cf9a })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(WORLD.beachX - 12, 0.02, 0);
  scene.add(sand);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(320, WORLD.size * 1.8),
    new THREE.MeshLambertMaterial({ color: 0x1e6f8e })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(WORLD.oceanX - 130, 0.0, 0);
  scene.add(ocean);

  // boardwalk strip along the beach
  const walk = new THREE.Mesh(
    new THREE.PlaneGeometry(10, WORLD.size * 1.2),
    new THREE.MeshLambertMaterial({ color: 0x9a7d5a })
  );
  walk.rotation.x = -Math.PI / 2;
  walk.position.set(WORLD.beachX + 6, 0.04, 0);
  scene.add(walk);

  // --- roads: grid, every WORLD.roadGap metres ---
  const roadMatEW = new THREE.MeshLambertMaterial({ map: roadTexEW });
  const roadMatNS = new THREE.MeshLambertMaterial({ map: roadTexNS });
  const half = WORLD.size / 2;
  const coords = [];
  for (let c = -256; c <= 256; c += WORLD.roadGap) coords.push(c);
  for (const c of coords) {
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size, WORLD.roadWidth), roadMatEW);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(0, 0.06, c);
    scene.add(ew);
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, WORLD.size), roadMatNS);
    ns.rotation.x = -Math.PI / 2;
    ns.rotation.z = Math.PI / 2;
    ns.position.set(c, 0.06, 0);
    scene.add(ns);
    roadLines.push({ axis: 'x', at: c });
    roadLines.push({ axis: 'z', at: c });
  }

  // --- sidewalks: pale strips flanking every road ---
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x8d8578 });
  for (const c of coords) {
    for (const off of [-9.5, 9.5]) {
      const s1 = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size, 5), walkMat);
      s1.rotation.x = -Math.PI / 2; s1.position.set(0, 0.05, c + off); scene.add(s1);
      const s2 = new THREE.Mesh(new THREE.PlaneGeometry(5, WORLD.size), walkMat);
      s2.rotation.x = -Math.PI / 2; s2.position.set(c + off, 0.05, 0); scene.add(s2);
    }
  }

  // --- buildings: one per block, height by district ---
  const palette = [0x6b5a6e, 0x4a5a7a, 0x7a5a4a, 0x5a6e5a, 0x74604a, 0x54486e];
  const mats = palette.map((c, i) => new THREE.MeshLambertMaterial({
    color: c, map: i % 2 === 0 ? windowTex : null,
  }));
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x2a4a5a, map: windowTex });
  let bi = 0;
  for (let bx = -256; bx <= 256 - WORLD.roadGap; bx += WORLD.roadGap) {
    for (let bz = -256; bz <= 256 - WORLD.roadGap; bz += WORLD.roadGap) {
      const cx = bx + WORLD.roadGap / 2;
      const cz = bz + WORLD.roadGap / 2;
      if (cx < WORLD.beachX + 30) continue; // beach stays open
      if (Math.abs(cx) < 12 && Math.abs(cz) < 12) continue; // central plaza
      if (Math.random() < 0.14) continue; // empty lot / parking
      const downtown = Math.hypot(cx, cz) < 120;
      const h = downtown ? 26 + Math.random() * 42 : 9 + Math.random() * 16;
      const w = 26 + Math.random() * 14;
      const d = 26 + Math.random() * 14;
      const mat = downtown && Math.random() < 0.4 ? glassMat : mats[bi % mats.length];
      bi++;
      addBuilding(scene, cx, cz, w, h, d, mat);
    }
  }

  // --- central plaza: fountain + benches ---
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 9, 1.2, 24),
    new THREE.MeshLambertMaterial({ color: 0x7a9ab0 })
  );
  plaza.position.set(0, 0.6, 0);
  scene.add(plaza);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(7.6, 7.6, 0.4, 24),
    new THREE.MeshLambertMaterial({ color: 0x3fa7c7 })
  );
  water.position.set(0, 1.3, 0);
  scene.add(water);

  // --- neon storefront row: NEON ROW (z = -192 road; signs face the road) ---
  addNeon(scene, "MO'S", '#ff2e88', -40, 6, -178, Math.PI, 12, 3.2);
  addNeon(scene, 'SOLARA', '#22d3ee', -8, 7, -178, Math.PI, 16, 3.6);
  addNeon(scene, 'PAWN', '#ffd23a', 24, 6, -178, Math.PI, 12, 3.2);
  addNeon(scene, 'DINER', '#7CFC66', 56, 6, -178, Math.PI, 13, 3.2);
  addNeon(scene, 'MOTEL', '#ff7a1a', 88, 6, -178, Math.PI, 13, 3.2);
  addNeon(scene, "MO'S", '#ff2e88', -40, 6, 178, 0, 12, 3.2);
  addNeon(scene, 'SOLARA', '#22d3ee', 8, 8, 128, Math.PI / 2, 16, 3.6);
  addNeon(scene, 'TACOS', '#ff5e5e', -120, 5.5, -114, -Math.PI / 2, 11, 3);
  addNeon(scene, 'BAR', '#c084fc', 120, 5.5, 50, Math.PI / 2, 9, 3);
  addNeon(scene, 'CASINO', '#ffd23a', -128, 9, 64, Math.PI / 2, 15, 3.6);

  // storefront awnings under the neon row
  const awnMat = new THREE.MeshLambertMaterial({ color: 0x24303a });
  for (const ax of [-40, -8, 24, 56, 88]) {
    const awn = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 5), awnMat);
    awn.position.set(ax, 3.6, -176);
    scene.add(awn);
  }

  // --- palms along beach + marina, streetlights along roads ---
  for (let z = -280; z <= 280; z += 34) {
    addPalm(scene, WORLD.beachX + 2 + Math.random() * 4, z + (Math.random() - 0.5) * 8);
    if (Math.random() < 0.5) addPalm(scene, -236 + Math.random() * 8, z);
  }
  for (const c of coords) {
    for (let t = -256; t <= 256; t += 64) {
      addStreetlight(scene, c + 8.5, t);
      addStreetlight(scene, t, c - 8.5);
    }
  }

  // --- marina: pier + boats on the north-west water edge ---
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(6, 0.8, 60),
    new THREE.MeshLambertMaterial({ color: 0x6b4a2a })
  );
  pier.position.set(-292, 0.4, -200);
  scene.add(pier);
  for (let i = 0; i < 3; i++) {
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(4, 1.6, 12),
      new THREE.MeshLambertMaterial({ color: 0xe8e8e8 })
    );
    hull.position.set(-306 - i * 6, 0.6, -190 + i * 18);
    hull.rotation.y = 0.3;
    scene.add(hull);
  }

  // --- distant skyline silhouettes for depth ---
  const silMat = new THREE.MeshBasicMaterial({ color: 0x8a4a3a });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = 520 + Math.random() * 120;
    const h = 60 + Math.random() * 110;
    const sil = new THREE.Mesh(new THREE.BoxGeometry(40, h, 40), silMat);
    sil.position.set(Math.cos(a) * r, h / 2 - 4, Math.sin(a) * r);
    scene.add(sil);
  }

  // sun disc low on the horizon (golden hour)
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xffc46b, fog: false })
  );
  sun.position.set(-480, 70, -260);
  sun.lookAt(0, 20, 0);
  scene.add(sun);

  return { colliders, neonSigns };
}

// Keep a player/car inside the world and out of buildings.
export function resolveCollisions(x, z, radius) {
  let nx = x, nz = z;
  nx = Math.max(-WORLD.size / 2, Math.min(WORLD.size / 2, nx));
  nz = Math.max(-WORLD.size / 2, Math.min(WORLD.size / 2, nz));
  for (const b of colliders) {
    const dx = nx - b.x, dz = nz - b.z;
    const ox = b.hx + radius - Math.abs(dx);
    const oz = b.hz + radius - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      if (ox < oz) nx = b.x + Math.sign(dx || 1) * (b.hx + radius);
      else nz = b.z + Math.sign(dz || 1) * (b.hz + radius);
    }
  }
  return { x: nx, z: nz };
}

export function isOnRoad(x, z) {
  const r = WORLD.roadWidth / 2 + 1;
  const near = (v) => {
    const m = ((v % WORLD.roadGap) + WORLD.roadGap) % WORLD.roadGap;
    return m < r || m > WORLD.roadGap - r;
  };
  return near(x + 256) || near(z + 256);
}
