// SOLARA — world.js (fresh build from spec, round 8)
// City, beach, ocean, buildings, trees, peds, geckos, markers.
// Trees are kept AWAY from the player spawn (-40,60) and the mission
// start (-40,-192): a tree canopy at spawn blocked the camera in round 7.

import * as THREE from 'three';
import { WORLD, DISTRICTS } from './config.js';

// Deterministic pseudo-random so the city layout is stable run to run.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PASTEL = ['#ff8a80', '#ffd180', '#fff176', '#a5d6a7', '#80d8ff', '#ce93d8', '#f48fb1', '#bcaaa4', '#90caf9', '#ffccbc'];
const SHIRTS = ['#ff1744', '#ffea00', '#00e676', '#2979ff', '#ff6d00', '#d500f9', '#00e5ff', '#76ff03'];

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 128);
  g.fillStyle = '#1a237e';
  for (let y = 8; y < 120; y += 16) {
    for (let x = 6; x < 58; x += 14) {
      g.fillStyle = Math.random() > 0.4 ? '#ffee58' : '#283593';
      g.fillRect(x, y, 9, 10);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildWorld(scene, S) {
  const rand = mulberry32(1337);
  const group = new THREE.Group();
  scene.add(group);

  // Sky: bright daytime blue, ~14:00.
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x9fd8ef, 180, 520);
  const sun = new THREE.DirectionalLight(0xfff2cc, 2.2);
  sun.position.set(120, 220, 60);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xbfe3ff, 0.9));
  const hemi = new THREE.HemisphereLight(0xbfdcff, 0x3d7a4a, 0.7);
  scene.add(hemi);

  // Ground: grass base.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.size, WORLD.size),
    new THREE.MeshStandardMaterial({ color: 0x58a05c, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Roads: dark asphalt strips on a 64-unit grid, 20 wide (4 lanes).
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.95 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xf5d90a, roughness: 0.8 });
  const roadLines = [];
  for (let k = -4; k <= 4; k++) {
    const c = k * WORLD.roadGap;
    const h = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size, WORLD.roadWidth), roadMat);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.02, c);
    group.add(h);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, WORLD.size), roadMat);
    v.rotation.x = -Math.PI / 2; v.position.set(c, 0.02, 0);
    group.add(v);
    // centre dashes
    for (let d = -300; d < 300; d += 16) {
      const dashH = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.6), lineMat);
      dashH.rotation.x = -Math.PI / 2; dashH.position.set(d, 0.04, c);
      group.add(dashH);
      const dashV = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 6), lineMat);
      dashV.rotation.x = -Math.PI / 2; dashV.position.set(c, 0.04, d);
      group.add(dashV);
    }
    roadLines.push(c);
  }

  // Sidewalks: light strips flanking each road.
  const walkMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 1 });
  for (let k = -4; k <= 4; k++) {
    const c = k * WORLD.roadGap;
    for (const off of [-13, 13]) {
      const h = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size, 5), walkMat);
      h.rotation.x = -Math.PI / 2; h.position.set(0, 0.03, c + off);
      group.add(h);
      const v = new THREE.Mesh(new THREE.PlaneGeometry(5, WORLD.size), walkMat);
      v.rotation.x = -Math.PI / 2; v.position.set(c + off, 0.03, 0);
      group.add(v);
    }
  }

  // Beach sand west of beachX, turquoise ocean west of oceanX.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(52, WORLD.size),
    new THREE.MeshStandardMaterial({ color: 0xf2e3b3, roughness: 1 })
  );
  sand.rotation.x = -Math.PI / 2; sand.position.set(-294, 0.03, 0);
  group.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(60, WORLD.size),
    new THREE.MeshStandardMaterial({ color: 0x1ec8d8, roughness: 0.25, metalness: 0.1 })
  );
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(-330, 0.02, 0);
  group.add(ocean);
  // Foam line where water meets sand.
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(3, WORLD.size),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
  );
  foam.rotation.x = -Math.PI / 2; foam.position.set(-301, 0.05, 0);
  group.add(foam);

  // Sailboats on the ocean + umbrellas on the beach.
  const boatMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xff5252, roughness: 0.6, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const bx = -315 - rand() * 18, bz = -240 + i * 95 + rand() * 30;
    const hull = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 2.4), boatMat);
    hull.position.set(bx, 0.7, bz); group.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), boatMat);
    mast.position.set(bx, 4, bz); group.add(mast);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 5.5), sailMat);
    sail.position.set(bx + 0.2, 4.2, bz); group.add(sail);
  }
  const umbColors = [0xff5252, 0xffd54f, 0x4fc3f7, 0x69f0ae, 0xe040fb];
  for (let i = 0; i < 10; i++) {
    const ux = -290 + rand() * 16, uz = -260 + i * 55 + rand() * 20;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6),
      new THREE.MeshStandardMaterial({ color: 0x8d6e63 }));
    pole.position.set(ux, 1.3, uz); group.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: umbColors[i % umbColors.length], roughness: 0.7 }));
    top.position.set(ux, 3.0, uz); group.add(top);
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2),
      new THREE.MeshStandardMaterial({ color: umbColors[(i + 2) % umbColors.length] }));
    towel.rotation.x = -Math.PI / 2; towel.position.set(ux + 2.5, 0.06, uz);
    group.add(towel);
  }

  // Buildings: pastel blocks between roads; downtown gets tall gold/teal towers.
  const winTex = windowTexture();
  const buildings = [];
  for (let gx = -4; gx <= 4; gx++) {
    for (let gz = -4; gz <= 4; gz++) {
      const cx = gx * WORLD.roadGap + WORLD.roadGap / 2;
      const cz = gz * WORLD.roadGap + WORLD.roadGap / 2;
      if (cx < -260) continue; // beach side stays open
      const distDowntown = Math.hypot(cx, cz);
      const n = 1 + Math.floor(rand() * 2);
      for (let b = 0; b < n; b++) {
        const w = 14 + rand() * 14, d = 14 + rand() * 14;
        let h = 8 + rand() * 16;
        if (distDowntown < 110) h = 26 + rand() * 42; // downtown towers
        const ox = (rand() - 0.5) * 18, oz = (rand() - 0.5) * 18;
        const bx = cx + ox, bz = cz + oz;
        if (Math.hypot(bx - S.px, bz - S.pz) < 24) continue; // keep spawn clear
        const color = distDowntown < 110
          ? (rand() > 0.5 ? '#d4af37' : '#2a9d8f')
          : PASTEL[Math.floor(rand() * PASTEL.length)];
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, map: winTex });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.set(bx, h / 2, bz);
        group.add(mesh);
        // rooftop rim
        const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6),
          new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.9 }));
        rim.position.set(bx, h + 0.4, bz);
        group.add(rim);
        // neon sign strip on some buildings
        if (rand() > 0.6) {
          const sign = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 1.2, 0.4),
            new THREE.MeshStandardMaterial({
              color: 0x111111,
              emissive: new THREE.Color(['#ff2d95', '#00e5ff', '#ffea00'][Math.floor(rand() * 3)]),
              emissiveIntensity: 1.6,
            }));
          sign.position.set(bx, h * 0.75, bz + d / 2 + 0.25);
          group.add(sign);
        }
        buildings.push(mesh);
      }
    }
  }

  // Palm trees — NEVER within 20 m of the spawn (-40,60) or the mission
  // start / safehouse (-40,-192). A canopy over the spawn broke round 7.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e9e4f, roughness: 0.9 });
  const trees = [];
  const noTree = [[-40, 60, 22], [-40, -192, 22], [-40, -184, 18]];
  let placed = 0, tries = 0;
  while (placed < 90 && tries < 600) {
    tries++;
    const tx = -260 + rand() * 560, tz = -300 + rand() * 600;
    if (tx < -262) continue;
    // keep off roads (road lines every 64, width 20 + sidewalk 5)
    const onRoadX = roadLines.some((c) => Math.abs(tx - c) < 15);
    const onRoadZ = roadLines.some((c) => Math.abs(tz - c) < 15);
    if (onRoadX || onRoadZ) continue;
    if (noTree.some(([nx, nz, r]) => Math.hypot(tx - nx, tz - nz) < r)) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 5.5, 7), trunkMat);
    trunk.position.set(tx, 2.75, tz);
    trunk.rotation.z = (rand() - 0.5) * 0.15;
    group.add(trunk);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.9, 8, 6), leafMat);
    canopy.position.set(tx, 6.1, tz);
    canopy.scale.y = 0.75;
    group.add(canopy);
    trees.push(canopy);
    placed++;
  }

  // Streetlights along roads (light comes FROM its source).
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x455a64, roughness: 0.7 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff9c4, emissive: 0xffee58, emissiveIntensity: 1.2 });
  for (let k = -4; k <= 4; k++) {
    for (let d = -256; d <= 256; d += 128) {
      const c = k * WORLD.roadGap;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 6, 6), poleMat);
      pole.position.set(c + 12, 3, d);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), bulbMat);
      bulb.position.set(c + 12, 6.2, d);
      group.add(bulb);
      const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 6, 6), poleMat);
      pole2.position.set(d, 3, c + 12);
      group.add(pole2);
      const bulb2 = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), bulbMat);
      bulb2.position.set(d, 6.2, c + 12);
      group.add(bulb2);
    }
  }

  // Safehouse: pink cylinder at MO'S (-40,-192).
  const safehouse = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6, 0.5, 24),
    new THREE.MeshStandardMaterial({ color: 0xff80ab, emissive: 0xe91e63, emissiveIntensity: 0.5 })
  );
  safehouse.position.set(-40, 0.25, -192);
  group.add(safehouse);
  const safehouseSign = new THREE.Mesh(
    new THREE.BoxGeometry(10, 2, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2d95, emissiveIntensity: 1.4 })
  );
  safehouseSign.position.set(-40, 5, -192);
  group.add(safehouseSign);

  // Mission start marker: big yellow cylinder (missions.js moves it).
  const startMarker = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 0.4, 24),
    new THREE.MeshStandardMaterial({ color: 0xffea00, emissive: 0xffd600, emissiveIntensity: 0.9 })
  );
  startMarker.position.set(-40, 0.2, -192);
  group.add(startMarker);

  // Beacon: pulsing yellow ring + vertical beam at the current target.
  const beacon = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(4.5, 6.5, 32),
    new THREE.MeshBasicMaterial({ color: 0xffea00, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  beacon.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 2.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffea00, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = 30;
  beacon.add(beam);
  beacon.position.set(-40, 0, -192);
  beacon.visible = false;
  group.add(beacon);

  // Peds: 64, scale 1.5, bright shirts, standing in groups on sidewalks.
  const peds = [];
  const pedSpots = [];
  for (let i = 0; i < 64; i++) {
    const gx = -256 + Math.floor(rand() * 9) * 64 + (rand() > 0.5 ? 13 : -13);
    const gz = -256 + Math.floor(rand() * 9) * 64 + (rand() > 0.5 ? 13 : -13);
    pedSpots.push([gx, gz]);
  }
  for (let i = 0; i < 64; i++) {
    const [bx, bz] = pedSpots[i];
    const shirt = SHIRTS[i % SHIRTS.length];
    const ped = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.42, 0.9, 4, 8),
      new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 })
    );
    body.position.y = 1.35;
    body.scale.setScalar(1.5);
    ped.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xe8b98a, roughness: 0.8 })
    );
    head.position.y = 2.75;
    ped.add(head);
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.9, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.9 })
    );
    legs.position.y = 0.45;
    ped.add(legs);
    ped.position.set(bx + (rand() - 0.5) * 3, 0, bz + (rand() - 0.5) * 3);
    ped.rotation.y = rand() * Math.PI * 2;
    ped.userData = { baseX: ped.position.x, baseZ: ped.position.z, phase: rand() * 6.28, speed: 0.3 + rand() * 0.5 };
    group.add(ped);
    peds.push(ped);
  }

  // Golden Geckos: 20 collectibles, bobbing gold.
  const geckos = [];
  const geckoMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffb300, emissiveIntensity: 0.9, metalness: 0.7, roughness: 0.3 });
  for (let i = 0; i < 20; i++) {
    const gx = -250 + rand() * 500, gz = -250 + rand() * 500;
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), geckoMat);
    g.scale.set(1.3, 0.8, 0.9);
    g.position.set(gx, 1.0, gz);
    g.userData = { taken: false, phase: rand() * 6.28, baseY: 1.0 };
    group.add(g);
    geckos.push(g);
  }

  // District name boards (floating labels at district centres).
  // Two planes back to back so the name reads correctly from BOTH
  // sides — a single double-sided plane shows mirrored text from behind.
  for (const d of DISTRICTS) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 96;
    const g = canvas.getContext('2d');
    g.fillStyle = d.color;
    g.fillRect(0, 0, 512, 96);
    g.fillStyle = '#111111';
    g.font = 'bold 52px Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(d.name, 256, 50);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const nx = Math.sin(Math.PI / 4), nz = Math.cos(Math.PI / 4);
    for (const [rot, off] of [[Math.PI / 4, 0.12], [Math.PI / 4 + Math.PI, -0.12]]) {
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 3),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true })
      );
      board.position.set(d.x + nx * off, 11, d.z + nz * off);
      board.rotation.y = rot;
      group.add(board);
    }
  }

  return {
    group, peds, geckos, trees, buildings,
    startMarker, beacon, beaconRing: ring,
    update(dt, t) {
      // peds wander slowly around their group spot
      for (const p of peds) {
        const u = p.userData;
        p.position.x = u.baseX + Math.sin(t * u.speed + u.phase) * 1.6;
        p.position.z = u.baseZ + Math.cos(t * u.speed * 0.8 + u.phase) * 1.6;
        p.rotation.y = Math.atan2(Math.cos(t * u.speed + u.phase), Math.sin(t * u.speed + u.phase));
      }
      // geckos bob
      for (const g of geckos) {
        if (g.userData.taken) continue;
        g.position.y = g.userData.baseY + Math.sin(t * 2 + g.userData.phase) * 0.35;
        g.rotation.y += dt * 1.5;
      }
      // beacon pulse
      if (beacon.visible) {
        const s = 1 + Math.sin(t * 4) * 0.12;
        ring.scale.setScalar(s);
        beam.material.opacity = 0.16 + Math.sin(t * 4) * 0.06;
      }
      // ocean shimmer
      ocean.position.y = 0.02 + Math.sin(t * 0.8) * 0.05;
    },
  };
}
