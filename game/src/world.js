// SOLARA — world.js
// Golden-hour coastal city: road grid, buildings with lit windows, neon
// storefront signs (canvas textures with real readable text), beach + ocean,
// palms, streetlights, props. Districts from config.js.

import * as THREE from 'three';
import { WORLD, DISTRICTS } from './config.js';

// Deterministic RNG (mulberry32) so the city layout is IDENTICAL on every
// load — reproducible screenshots, and the dev trial sees the verified city.
let _seed = 1337;
function srand() {
  _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

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
      const on = srand() < 0.42;
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
  // yellow centre line, dashed, runs ALONG the road
  g.fillStyle = '#e8c33a';
  if (alongX) {
    for (let x = 8; x < 128; x += 42) g.fillRect(x, 60, 26, 8);
  } else {
    for (let y = 8; y < 128; y += 42) g.fillRect(60, y, 8, 26);
  }
  // white dashed lane dividers at 1/4 and 3/4 across (4 lanes)
  g.fillStyle = 'rgba(235,235,235,0.85)';
  if (alongX) {
    for (let x = 4; x < 128; x += 32) {
      g.fillRect(x, 30, 18, 4); g.fillRect(x, 94, 18, 4);
    }
  } else {
    for (let y = 4; y < 128; y += 32) {
      g.fillRect(30, y, 4, 18); g.fillRect(94, y, 4, 18);
    }
  }
  g.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 40; i++) g.fillRect(srand() * 128, srand() * 128, 3, 3);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Gold/teal diamond-pattern glass for the downtown skyscrapers: a grid of
// diamonds that reads as a faceted tower facade in golden hour.
function makeDiamondTexture(base, diamond, lit) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 256; y += 32) {
    for (let x = 0; x < 128; x += 32) {
      const off = (y / 32) % 2 ? 16 : 0;
      g.fillStyle = srand() < 0.4 ? lit : diamond;
      g.beginPath();
      g.moveTo(x + off + 16, y + 3);
      g.lineTo(x + off + 29, y + 16);
      g.lineTo(x + off + 16, y + 29);
      g.lineTo(x + off + 3, y + 16);
      g.closePath();
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
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
  trunk.rotation.z = (srand() - 0.5) * 0.16;
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
    new THREE.MeshLambertMaterial({ color: 0x27a3a3 })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(WORLD.oceanX - 130, 0.0, 0);
  scene.add(ocean);

  // turquoise shallows + white wave foam at the waterline
  const shallows = new THREE.Mesh(
    new THREE.PlaneGeometry(26, WORLD.size * 1.6),
    new THREE.MeshLambertMaterial({ color: 0x4fd1c5 })
  );
  shallows.rotation.x = -Math.PI / 2;
  shallows.position.set(WORLD.beachX - 24, 0.01, 0);
  scene.add(shallows);
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(4, WORLD.size * 1.6),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 })
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(WORLD.beachX - 12, 0.03, 0);
  scene.add(foam);

  // blue beach umbrellas + chairs on the sand
  const umbMat = new THREE.MeshLambertMaterial({ color: 0x2e86c1 });
  const umbMat2 = new THREE.MeshLambertMaterial({ color: 0xe74c3c });
  const chairMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f5 });
  for (let i = 0; i < 12; i++) {
    const z = -260 + i * 46 + (srand() - 0.5) * 12;
    const x = WORLD.beachX - 6 - srand() * 22;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), new THREE.MeshLambertMaterial({ color: 0x8a6b4a }));
    pole.position.set(x, 1.3, z);
    scene.add(pole);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.1, 8), i % 3 === 0 ? umbMat2 : umbMat);
    canopy.position.set(x, 2.9, z);
    scene.add(canopy);
    // beach chair + towel
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 1.6), chairMat);
    chair.position.set(x + 1.8, 0.25, z + 1.2);
    chair.rotation.y = 0.4;
    scene.add(chair);
    const towel = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 1.4), new THREE.MeshLambertMaterial({ color: [0xff5e5e, 0xffd23a, 0x4fc3f7][i % 3] }));
    towel.position.set(x + 1.8, 0.55, z + 1.2);
    towel.rotation.y = 0.4;
    scene.add(towel);
  }

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
    for (const off of [-12.5, 12.5]) {
      const s1 = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size, 5), walkMat);
      s1.rotation.x = -Math.PI / 2; s1.position.set(0, 0.05, c + off); scene.add(s1);
      const s2 = new THREE.Mesh(new THREE.PlaneGeometry(5, WORLD.size), walkMat);
      s2.rotation.x = -Math.PI / 2; s2.position.set(c + off, 0.05, 0); scene.add(s2);
    }
  }

  // --- buildings: one per block, height by district; pastel tropical fronts ---
  // cream, pink, purple, orange, teal — continuous rows on both sides of
  // every main road, windows lit at night via the window texture.
  const palette = [0xf2e3c9, 0xf2a7c3, 0xb39ddb, 0xffb74d, 0x4db6ac, 0xce93d8, 0xf8bbd0, 0x80cbc4];
  const mats = palette.map((c, i) => new THREE.MeshLambertMaterial({
    color: c, map: i % 2 === 0 ? windowTex : null,
  }));
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x2a4a5a, map: windowTex });
  // downtown skyscraper plots (block centres) — the regular loop skips these
  const towerPlots = [
    { x: 32, z: -32, h: 118, w: 30, d: 30 },
    { x: 96, z: 32, h: 96, w: 28, d: 28 },
    { x: -32, z: 96, h: 108, w: 30, d: 30 },
  ];
  const isTowerPlot = (cx, cz) => towerPlots.some((t) => Math.abs(t.x - cx) < 2 && Math.abs(t.z - cz) < 2);
  let bi = 0;
  for (let bx = -256; bx <= 256 - WORLD.roadGap; bx += WORLD.roadGap) {
    for (let bz = -256; bz <= 256 - WORLD.roadGap; bz += WORLD.roadGap) {
      const cx = bx + WORLD.roadGap / 2;
      const cz = bz + WORLD.roadGap / 2;
      if (cx < WORLD.beachX + 30) continue; // beach stays open
      if (Math.abs(cx) < 12 && Math.abs(cz) < 12) continue; // central plaza
      if (isTowerPlot(cx, cz)) continue; // skyscraper plot
      if (srand() < 0.06) continue; // rare empty lot / parking
      const downtown = Math.hypot(cx, cz) < 120;
      const h = downtown ? 24 + srand() * 38 : 9 + srand() * 15;
      const w = 24 + srand() * 12;
      const d = 24 + srand() * 12;
      const mat = downtown && srand() < 0.4 ? glassMat : mats[bi % mats.length];
      bi++;
      addBuilding(scene, cx, cz, w, h, d, mat);
    }
  }

  // --- downtown skyscrapers: gold/teal diamond-pattern glass, 10+ floors ---
  const diamondTex = makeDiamondTexture('#8a6d2f', '#2a8a8a', '#ffd27a');
  const diamondTex2 = makeDiamondTexture('#2a5a6a', '#c9a227', '#ffe9a8');
  const crownMat = new THREE.MeshBasicMaterial({ color: 0xffd23a });
  for (let i = 0; i < towerPlots.length; i++) {
    const t = towerPlots[i];
    const tex = i % 2 === 0 ? diamondTex : diamondTex2;
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(t.w, t.h, t.d), mat);
    tower.position.set(t.x, t.h / 2, t.z);
    scene.add(tower);
    colliders.push({ x: t.x, z: t.z, hx: t.w / 2 + 0.6, hz: t.d / 2 + 0.6 });
    // lit crown + antenna
    const crown = new THREE.Mesh(new THREE.BoxGeometry(t.w * 0.5, 2, t.d * 0.5), crownMat);
    crown.position.set(t.x, t.h + 1, t.z);
    scene.add(crown);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 12, 6), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    antenna.position.set(t.x, t.h + 8, t.z);
    scene.add(antenna);
    // individual windows: proud lit boxes on the two street-facing sides
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    const winDark = new THREE.MeshBasicMaterial({ color: 0x1a2a3a });
    for (let fy = 8; fy < t.h - 4; fy += 9) {
      for (let fx = -t.w / 2 + 4; fx <= t.w / 2 - 4; fx += 7) {
        const lit = srand() < 0.45;
        const win = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.4), lit ? winMat : winDark);
        win.position.set(t.x + fx, fy, t.z + t.d / 2 + 0.25);
        scene.add(win);
      }
    }
    // long fake shadow stretching away from the low golden-hour sun (sun is west)
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(t.w * 1.4, t.h * 1.8),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(t.x + t.h * 0.9, 0.07, t.z);
    scene.add(shadow);
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

  // --- street furniture: wooden benches, green bins, bus stops with glass roofs ---
  const benchWood = new THREE.MeshLambertMaterial({ color: 0x8a5a2a });
  const binGreen = new THREE.MeshLambertMaterial({ color: 0x1e7d32 });
  const glassRoof = new THREE.MeshLambertMaterial({ color: 0x9fd8e8, transparent: true, opacity: 0.55 });
  const postMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  function addBench(x, z, ry) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.6), benchWood);
    seat.position.y = 0.5; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 0.1), benchWood);
    back.position.set(0, 0.9, -0.28); g.add(back);
    for (const sx of [-0.85, 0.85]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.5), postMat);
      leg.position.set(sx, 0.25, 0); g.add(leg);
    }
    g.position.set(x, 0, z); g.rotation.y = ry;
    scene.add(g);
  }
  function addBin(x, z) {
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 1.0, 10), binGreen);
    bin.position.set(x, 0.5, z);
    scene.add(bin);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.08, 10), postMat);
    lid.position.set(x, 1.02, z);
    scene.add(lid);
  }
  function addBusStop(x, z, ry) {
    const g = new THREE.Group();
    for (const [px, pz] of [[-1.6, -0.7], [1.6, -0.7], [-1.6, 0.7], [1.6, 0.7]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), postMat);
      post.position.set(px, 1.3, pz); g.add(post);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 2.0), glassRoof);
    roof.position.y = 2.65; g.add(roof);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 0.5), benchWood);
    seat.position.set(0, 0.55, -0.5); g.add(seat);
    g.position.set(x, 0, z); g.rotation.y = ry;
    scene.add(g);
  }
  for (const c of coords) {
    for (let t = -224; t <= 224; t += 96) {
      addBench(c + 12.5, t + 16, Math.PI / 2);
      addBench(t + 16, c - 12.5, 0);
      addBin(c + 12.5, t + 40);
      addBin(t - 40, c + 12.5);
    }
  }
  // bus stops on the main downtown roads
  addBusStop(12.5, 64, Math.PI / 2);
  addBusStop(-12.5, -64, -Math.PI / 2);
  addBusStop(64, -12.5, 0);
  addBusStop(-64, 12.5, Math.PI);

  // --- palms along beach + marina, streetlights along roads ---
  for (let z = -280; z <= 280; z += 34) {
    addPalm(scene, WORLD.beachX + 2 + srand() * 4, z + (srand() - 0.5) * 8);
    if (srand() < 0.5) addPalm(scene, -236 + srand() * 8, z);
  }
  for (const c of coords) {
    for (let t = -256; t <= 256; t += 64) {
      addStreetlight(scene, c + 11.5, t);
      addStreetlight(scene, t, c - 11.5);
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
    const r = 520 + srand() * 120;
    const h = 60 + srand() * 110;
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
