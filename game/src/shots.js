// SOLARA — shots.js
// The 4 dossier screenshot setups, driven by ?shot=1..4 in the URL.
// Each shot is staged so the new round-5 details are VISIBLE in the frame:
// 1 = start menu over beach + towers, 2 = packed multi-lane street + towers,
// 3 = Kai on foot, weapon visible, mission panel + stars, 4 = chase with
// helicopter + police response panel. No other file reads the URL.

import { S } from './config.js';
import { enterCar, nearestCar, traffic } from './vehicles.js';
import { startMission } from './missions.js';
import { addWanted } from './police.js';
import { showDialogue } from './hud.js';

export const SHOTS = [
  { name: 'start-menu', desc: 'Start menu: SOLARA title, NEW GAME / LOAD / SETTINGS, beach + skyscrapers behind' },
  { name: 'packed-street', desc: 'Busy 4-lane downtown street packed with traffic, gold/teal towers, palms' },
  { name: 'kai-on-foot', desc: 'Kai on foot, VESPER pistol visible, mission panel + wanted stars prominent' },
  { name: 'neon-chase', desc: 'Neon Row chase: helicopter, cruisers, police response panel, full HUD' },
];

export function getShotParam() {
  try {
    const q = new URLSearchParams(window.location.search);
    const n = parseInt(q.get('shot') || '0', 10);
    return n >= 1 && n <= 4 ? n : 0;
  } catch (e) { return 0; }
}

function hideStartScreen() {
  const el = document.getElementById('start-screen');
  if (el) el.style.display = 'none';
  S.started = true;
}

function putInNearestCar() {
  const cand = nearestCar(S.px, S.pz);
  if (cand) enterCar(cand);
}

// Cluster several traffic cars onto the road AHEAD of the player so the street
// reads PACKED in the frame (two lanes each way, cars tight together).
function packTraffic(cx, cz, roadZ) {
  let placed = 0;
  for (const c of traffic) {
    if (placed >= 8) break;
    const lane = placed % 2 === 0 ? 2.5 : 7.5;
    const side = placed % 4 < 2 ? 1 : -1;
    const along = cx + 18 + placed * 6; // bumper-to-bumper: 6 m spacing, cars ~4.5 m long
    c.group.position.set(along, 0, roadZ + side * lane);
    c.group.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    c.horizontal = true;
    c.road = roadZ;
    c.dir = side;
    c.speed = 1.5; // slow crawl — the pack stays in frame for the shot
    placed++;
  }
}

// Returns {camPos, camLook} for a fixed cinematic camera, or null to use the
// normal chase camera.
export function applyShot(n) {
  S.shotMode = true; // staged shots: police don't ram the player out of frame
  if (n === 1) {
    // START MENU: keep the menu visible, camera over downtown looking east
    // at the street + gold/teal skyscrapers behind the buttons.
    S.started = false;
    return { camPos: [-236, 9, 84], camLook: [-40, 26, -20] };
  }
  hideStartScreen();
  if (n === 2) {
    // PACKED STREET: Kai in a red sports car driving east on the 4-lane
    // downtown road, traffic clustered tight ahead in both lanes, towers +
    // palms ahead. Chase camera low behind the car so it reads BIG.
    S.px = -24; S.pz = 70; S.heading = Math.PI / 2;
    putInNearestCar();
    if (S.car) {
      S.car.heading = Math.PI / 2;
      S.car.x = -40; S.car.z = 64; S.car.speed = 0;
      S.car.group.position.set(-40, 0, 64);
      S.car.group.rotation.y = Math.PI / 2;
      S.car.group.traverse((o) => {
        if (o.isMesh && o.material && o.material.metalness === 0.55 && o.material.roughness === 0.35) {
          o.material.color.setHex(0xc0392b);
        }
      });
    }
    packTraffic(-40, 64, 64);
    addWanted(1, 'shot');
    // 3/4 rear view from the south-west so the red car reads BIG in the
    // foreground with the packed road + towers ahead.
    return { camPos: [-64, 6, 78], camLook: [-20, 2, 64] };
  }
  if (n === 3) {
    // KAI ON FOOT: camera dead on his gun side (due west, level) so Kai is
    // in right profile and the silver VESPER pistol — held on his right,
    // pointing forward — reads at full length, silhouetted against the road.
    S.px = -40; S.pz = -184; S.heading = Math.PI;
    S.missionIdx = 0;
    startMission();
    showDialogue('LUPE', 'Meet me at MO\u2019S, Kai. First job — don\u2019t keep me waiting.');
    S.dialogueUntil = 9999; // keep Lupe's dialogue + portrait in frame
    addWanted(2, 'shot');
    return { camPos: [-46, 1.7, -184], camLook: [-39, 1.25, -184] };
  }
  if (n === 4) {
    // NEON CHASE: 3 stars, helicopter + cruisers closing in, response panel
    // live, neon signs blazing, full HUD.
    S.px = -8; S.pz = -186; S.heading = Math.PI;
    S.missionIdx = 5;
    startMission();
    S.heliAlt = 26; // bring the helicopter down into the frame for this shot
    addWanted(3, 'shot');
    return { camPos: [36, 10, -220], camLook: [-12, 10, -176] };
  }
  return null;
}
