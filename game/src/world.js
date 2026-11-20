// SOLARA — world.js
// The city itself: ground, road grid, sidewalks, pastel buildings, the
// diamond tower, turquoise ocean + beach, palms, streetlights, neon signs,
// trees, benches, clouds — plus the 20 Golden Geckos and building collision.

import * as THREE from 'three';
import { WORLD } from './config.js';

export const beachX = WORLD.beachX;

const PASTELS = [0xff9ebb, 0x7fe3d0, 0xc9a7eb, 0xfff1c9, 0xffe066, 0xa8e6a1, 0xffb38a, 0x9ecfff];
const ROADS = [-256, -192, -128, -64, 0, 64, 128, 192, 256];
const BLOCKS = [-224, -160, -96, -32, 32, 96, 160, 224];

let foamMeshes = [];
let neonMeshes = [];
let sailboats = [];
let clouds = [];
let geckos = [];
let solids = [];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function neonTexture(text, color) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#101018';
  g.fillRect(0, 0, 256, 64);
  g.font = 'bold 40px Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.fillStyle = color;
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addBuilding(scene, cx, cz, w, d, h, color, rand) {
  const mat = new THREE.MeshLambertMaterial({ color });
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  b.position.set(cx, h / 2, cz);
  scene.add(b);
  // roof cap
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.6, 0.6, d + 0.6),
    new THREE.MeshLambertMaterial({ color: 0x2a2a33 })
  );
  cap.position.set(cx, h + 0.3, cz);
  scene.add(cap);
  // windows ON the wall faces: small emissive planes, slightly proud of the
  // surface so they never float or sink into the wall.
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const winMat2 = new THREE.MeshBasicMaterial({ color: 0x9fd8ff });
  const rows = Math.max(1, Math.floor(h / 4));
  const cols = Math.max(2, Math.floor(w / 4));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rand() < 0.35) continue;
      const wx = cx - w / 2 + (c + 0.5) * (w / cols);
      const wy = 2.5 + r * 3.5;
      if (wy > h - 1) continue;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), rand() < 0.5 ? winMat : winMat2);
      win.position.set(wx, wy, cz + d / 2 + 0.06);
      scene.add(win);
      const winB = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), rand() < 0.5 ? winMat : winMat2);
      winB.position.set(wx, wy, cz - d / 2 - 0.06);
      winB.rotation.y = Math.PI;
      scene.add(winB);
    }
  }
  solids.push({ x0: cx - w / 2 - 0.6, z0: cz - d / 2 - 0.6, x1: cx + w / 2 + 0.6, z1: cz + d / 2 + 0.6 });
}

export function solidAt(x, z) {
  for (const s of solids) {
    if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) return true;
  }
  return false;
}

export function buildWorld(scene) {
  const rand = rng(1337);

  // --- ground base (grass green) then asphalt roads + cream sidewalks ---
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(720, 720),
    new THREE.MeshLambertMaterial({ color: 0x4f8f4f })
  );
  base.rotation.x = -Math.PI / 2;
  base.position.set(0, -0.05, 0);
  scene.add(base);

  // city slab (dark navy asphalt under everything)
  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(640, 640),
    new THREE.MeshLambertMaterial({ color: 0x232a38 })
  );
  slab.rotation.x = -Math.PI / 2;
  slab.position.set(0, 0, 0);
  scene.add(slab);

  // roads: dark asphalt strips with dashed centre lines, cream sidewalks
  // and red curbs on both edges.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x1c2230 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xe8dcc0 });
  const curbMat = new THREE.MeshLambertMaterial({ color: 0xc0392b });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
  for (const r of ROADS) {
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(14, 640), roadMat);
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(r, 0.02, 0);
    scene.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(640, 14), roadMat);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(0, 0.02, r);
    scene.add(ew);
    // sidewalks: wide cream strips centred at +/-11 so a walker at +/-12.5
    // stands ON the sidewalk, not on the grass past it. Red curbs at the
    // road edge mark where asphalt ends and sidewalk begins.
    for (const off of [-11, 11]) {
      const w1 = new THREE.Mesh(new THREE.PlaneGeometry(6, 640), walkMat);
      w1.rotation.x = -Math.PI / 2;
      w1.position.set(r + off, 0.03, 0);
      scene.add(w1);
      const w2 = new THREE.Mesh(new THREE.PlaneGeometry(640, 6), walkMat);
      w2.rotation.x = -Math.PI / 2;
      w2.position.set(0, 0.03, r + off);
      scene.add(w2);
      const c1 = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 640), curbMat);
      c1.rotation.x = -Math.PI / 2;
      c1.position.set(r + off * 0.66, 0.035, 0);
      scene.add(c1);
      const c2 = new THREE.Mesh(new THREE.PlaneGeometry(640, 0.7), curbMat);
      c2.rotation.x = -Math.PI / 2;
      c2.position.set(0, 0.035, r + off * 0.66);
      scene.add(c2);
    }
    // dashed centre line
    for (let d = -300; d < 300; d += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(r, 0.04, d);
      scene.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), lineMat);
      dash2.rotation.x = -Math.PI / 2;
      dash2.position.set(d, 0.04, r);
      scene.add(dash2);
    }
  }

  // --- beach sand strip + turquoise ocean (west of beachX) ---
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 640),
    new THREE.MeshLambertMaterial({ color: 0xe8cf9a })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(beachX, 0.01, 0);
  scene.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 640),
    new THREE.MeshLambertMaterial({ color: 0x00b4e0 })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(beachX - 78, 0.0, 0);
  scene.add(ocean);
  // animated foam strips along the shoreline
  for (let i = 0; i < 10; i++) {
    const foam = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(beachX - 2, 0.05, -280 + i * 62);
    scene.add(foam);
    foamMeshes.push(foam);
  }
  // sailboats bobbing on the water
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.8, 5),
      new THREE.MeshLambertMaterial({ color: 0xffffff })
    );
    hull.position.y = 0.4;
    g.add(hull);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 5, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a6d3b })
    );
    mast.position.y = 3;
    g.add(mast);
    const sail = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 4),
      new THREE.MeshLambertMaterial({ color: i % 2 ? 0xff6b81 : 0xffffff, side: THREE.DoubleSide })
    );
    sail.position.set(0, 3, 1.2);
    g.add(sail);
    g.position.set(beachX - 30 - i * 14, 0.1, -180 + i * 120);
    scene.add(g);
    sailboats.push(g);
  }
  // beach umbrellas (14) — cone on a pole, planted in the sand
  const umColors = [0xff2e63, 0xffd23a, 0x00d4ff, 0xff5722, 0x9b59b6, 0x76ff03];
  for (let i = 0; i < 14; i++) {
    const ux = beachX + 6 + (i % 2) * 8;
    const uz = -260 + i * 40 + (i % 3) * 6;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6),
      new THREE.MeshLambertMaterial({ color: 0xdddddd })
    );
    pole.position.set(ux, 1.2, uz);
    scene.add(pole);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 1.1, 8),
      new THREE.MeshLambertMaterial({ color: umColors[i % umColors.length] })
    );
    top.position.set(ux, 2.8, uz);
    scene.add(top);
  }

  // --- pastel buildings, one or two per block ---
  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      if (bx < -260) continue; // keep the beach clear
      const roll = rand();
      if (roll < 0.18) {
        // park block: trees + benches instead of a building
        for (let t = 0; t < 5; t++) {
          const tx = bx + (rand() - 0.5) * 36;
          const tz = bz + (rand() - 0.5) * 36;
          plantTree(scene, tx, tz);
        }
        continue;
      }
      const downtown = Math.abs(bx) <= 32 && Math.abs(bz) <= 32;
      const h = downtown ? 26 + rand() * 34 : 9 + rand() * 16;
      const w = 16 + rand() * 10;
      const d = 16 + rand() * 10;
      addBuilding(scene, bx, bz, w, d, h, PASTELS[Math.floor(rand() * PASTELS.length)], rand);
      if (roll > 0.75) {
        addBuilding(scene, bx + 14, bz - 12, 10 + rand() * 6, 10 + rand() * 6, 7 + rand() * 8,
          PASTELS[Math.floor(rand() * PASTELS.length)], rand);
      }
    }
  }

  // --- the diamond tower (downtown landmark): gold/teal diamond pattern ---
  const tower = new THREE.Group();
  const towerBody = new THREE.Mesh(
    new THREE.BoxGeometry(26, 78, 26),
    new THREE.MeshLambertMaterial({ color: 0x2e8b8b })
  );
  towerBody.position.y = 39;
  tower.add(towerBody);
  const diamondMat = new THREE.MeshBasicMaterial({ color: 0xffd23a });
  const diamondMat2 = new THREE.MeshBasicMaterial({ color: 0x7fe3d0 });
  for (let f = 0; f < 4; f++) {
    const ang = f * Math.PI / 2;
    const nx = Math.sin(ang), nz = Math.cos(ang); // face outward normal
    const tx = Math.cos(ang), tz = -Math.sin(ang); // tangent along the face
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 4; c++) {
        const dia = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), (r + c) % 2 ? diamondMat : diamondMat2);
        const along = (c - 1.5) * 5.4;
        dia.position.set(nx * 13.1 + tx * along, 6 + r * 8, nz * 13.1 + tz * along);
        dia.rotation.y = ang;
        dia.rotation.z = Math.PI / 4;
        tower.add(dia);
      }
    }
  }
  const spire = new THREE.Mesh(
    new THREE.ConeGeometry(4, 14, 4),
    new THREE.MeshLambertMaterial({ color: 0xffd23a })
  );
  spire.position.y = 85;
  spire.rotation.y = Math.PI / 4;
  tower.add(spire);
  tower.position.set(32, 0, -32);
  scene.add(tower);
  solids.push({ x0: 32 - 13.6, z0: -32 - 13.6, x1: 32 + 13.6, z1: -32 + 13.6 });

  // --- neon signs on Neon Row (z = -192), glowing over the street ---
  const signs = [
    { text: "MO'S", color: '#ff2e88', x: -52, z: -178 },
    { text: 'SOLARA', color: '#22d3ee', x: 20, z: -180 },
    { text: 'PAWN', color: '#ffd23a', x: 96, z: -180 },
    { text: 'DINER', color: '#ff5722', x: -128, z: -180 },
    { text: 'MOTEL', color: '#c9a7eb', x: 160, z: -180 },
  ];
  for (const s of signs) {
    const tex = neonTexture(s.text, s.color);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 3.5),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    sign.position.set(s.x, 7, s.z);
    scene.add(sign);
    neonMeshes.push(sign);
    // sign board backing, fixed to the building face
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(14.5, 4, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x14141c })
    );
    back.position.set(s.x, 7, s.z - 0.3);
    scene.add(back);
  }

  // --- streetlights: pole + lamp + a visible light cone from the lamp ---
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.10, depthWrite: false, side: THREE.DoubleSide,
  });
  for (const rx of ROADS) {
    for (let dz = -224; dz <= 224; dz += 128) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.5, 6), poleMat);
      pole.position.set(rx + 10.5, 2.75, dz);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
      lamp.position.set(rx + 10.5, 5.6, dz);
      scene.add(lamp);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(3.2, 5.4, 10, 1, true), coneMat);
      cone.position.set(rx + 10.5, 2.9, dz);
      scene.add(cone);
    }
  }

  // --- palms along the boardwalk + trees scattered in blocks ---
  for (let z = -280; z <= 280; z += 40) {
    plantPalm(scene, beachX + 14, z + 8);
  }
  for (let i = 0; i < 26; i++) {
    const tx = -260 + rand() * 520;
    const tz = -280 + rand() * 560;
    if (solidAt(tx, tz)) continue;
    plantTree(scene, tx, tz);
  }

  // --- benches on sidewalks ---
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x8a6d3b });
  for (let i = 0; i < 12; i++) {
    const bx = ROADS[Math.floor(rand() * ROADS.length)] + 12.5;
    const bz = -240 + rand() * 480;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.8), benchMat);
    bench.position.set(bx, 0.5, bz);
    scene.add(bench);
  }

  // --- clouds (16), drifting white blobs ---
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    for (let p = 0; p < 3; p++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(6 + rand() * 5, 8, 6), cloudMat);
      puff.position.set(p * 7 - 7, rand() * 2, rand() * 4 - 2);
      puff.scale.y = 0.45;
      g.add(puff);
    }
    g.position.set(-300 + rand() * 600, 90 + rand() * 40, -300 + rand() * 600);
    scene.add(g);
    clouds.push(g);
  }

  // --- 20 Golden Geckos, spread across the city ---
  const spots = [
    [-40, -178], [20, -120], [96, -64], [-96, 32], [160, 96], [-160, 160],
    [224, -32], [-224, -96], [64, 224], [-64, 224], [128, -192], [-128, -32],
    [32, 64], [-32, 128], [192, 32], [-192, 64], [0, -256], [256, 160],
    [-256, 224], [96, 0],
  ];
  for (const [gx, gz] of spots) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.22, 1.1),
      new THREE.MeshLambertMaterial({ color: 0xffd23a, emissive: 0xaa7700 })
    );
    body.position.y = 0.35;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xffd23a, emissive: 0xaa7700 })
    );
    head.position.set(0, 0.38, 0.65);
    g.add(head);
    const tail = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.9, 6),
      new THREE.MeshLambertMaterial({ color: 0xffd23a, emissive: 0xaa7700 })
    );
    tail.rotation.x = Math.PI / 2 + 0.25;
    tail.position.set(0, 0.3, -0.9);
    g.add(tail);
    g.position.set(gx, 0, gz);
    scene.add(g);
    geckos.push({ group: g, x: gx, z: gz, taken: false });
  }
}

function plantTree(scene, x, z) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.3, 2.6, 6),
    new THREE.MeshLambertMaterial({ color: 0x6b4a2a })
  );
  trunk.position.set(x, 1.3, z);
  scene.add(trunk);
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(1.9, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x2f9e44 })
  );
  top.position.set(x, 3.6, z);
  scene.add(top);
}

function plantPalm(scene, x, z) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.3, 6, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6d3b })
  );
  trunk.position.set(x, 3, z);
  trunk.rotation.z = 0.08;
  scene.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x37b24d });
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 4), leafMat);
    const a = (i / 5) * Math.PI * 2;
    leaf.position.set(x + Math.cos(a) * 1.4, 6.4, z + Math.sin(a) * 1.4);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    scene.add(leaf);
  }
}

export function worldTick(dt, time) {
  for (let i = 0; i < foamMeshes.length; i++) {
    foamMeshes[i].position.x = beachX - 2 + Math.sin(time * 0.8 + i) * 1.2;
    foamMeshes[i].material.opacity = 0.5 + Math.sin(time * 1.3 + i * 2) * 0.2;
  }
  for (const s of sailboats) {
    s.position.y = 0.1 + Math.sin(time * 0.7 + s.position.z * 0.01) * 0.25;
    s.rotation.z = Math.sin(time * 0.5 + s.position.x * 0.02) * 0.04;
  }
  for (let i = 0; i < neonMeshes.length; i++) {
    const flick = Math.sin(time * 6 + i * 2.3) > 0.92 ? 0.35 : 1;
    neonMeshes[i].material.opacity = flick;
  }
  for (const c of clouds) {
    c.position.x += dt * 1.2;
    if (c.position.x > 340) c.position.x = -340;
  }
  for (const g of geckos) {
    if (g.taken) continue;
    g.group.rotation.y = time * 0.8;
    g.group.position.y = Math.abs(Math.sin(time * 2 + g.x)) * 0.25;
  }
}

export function geckoCount() {
  return geckos.filter((g) => g.taken).length;
}

export function geckoTotal() {
  return 20;
}

export function geckoSpots() {
  return geckos;
}

export function collectiblesTick(px, pz) {
  for (const g of geckos) {
    if (g.taken) continue;
    const d = Math.hypot(g.x - px, g.z - pz);
    if (d < 2) {
      g.taken = true;
      g.group.visible = false;
      return true;
    }
  }
  return false;
}
