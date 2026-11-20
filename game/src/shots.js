// SOLARA — shots.js
// The 4 dossier screenshot setups, driven by ?shot=1..4 in the URL.
// Each one stages the scene (player spot, car, wanted level, mission) and
// returns an optional fixed cinematic camera. No other file reads the URL.

import { S } from './config.js';
import { enterCar, nearestCar } from './vehicles.js';
import { startMission } from './missions.js';
import { addWanted } from './police.js';

export const SHOTS = [
  { name: 'beach-start', desc: 'Kai on foot at golden hour on Solara Beach, palms and ocean behind him' },
  { name: 'cruiser-hero', desc: 'Hero shot: Kai in a sports car beside a black-and-white police cruiser downtown' },
  { name: 'mission-drive', desc: 'Mission driving: Kai speeding down the coastal road toward Marco\u2019s Run' },
  { name: 'neon-chase', desc: 'Neon Row at dusk: helicopter overhead, cruisers closing in, neon signs blazing' },
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

// Returns {camPos, camLook} for a fixed cinematic camera, or null to use the
// normal chase camera.
export function applyShot(n) {
  hideStartScreen();
  if (n === 1) {
    // Beach, Kai on foot, facing the ocean sunset. Camera stays west of the
    // beachfront building row (their west faces end near x=-244) so the
    // frame holds Kai, sand, palms and the low sun — no wall in the way.
    S.px = -264; S.pz = 30; S.heading = -Math.PI / 2;
    S.wanted = 0; S.health = 100;
    return { camPos: [-254, 4.5, 40], camLook: [-266, 1.5, 29] };
  }
  if (n === 2) {
    // Hero shot on the open east-west road: Kai in a red sports car (parked
    // car at (-24, 74)), camera low on the road looking east along it so
    // the car reads big and the chasing cruiser can roll into frame.
    S.px = -24; S.pz = 70; S.heading = Math.PI;
    putInNearestCar();
    if (S.car) {
      S.car.group.traverse((o) => {
        if (o.isMesh && o.material && o.material.metalness === 0.55 && o.material.roughness === 0.35) {
          o.material.color.setHex(0xc0392b);
        }
      });
    }
    addWanted(1, 'shot');
    return { camPos: [-46, 7.5, 74], camLook: [-24, 0.8, 74] };
  }
  if (n === 3) {
    // Mission drive: Marco's Run active, Kai driving the coastal road.
    // Parked car sits at (-8, 136); Kai starts beside it, already rolling.
    S.missionIdx = 2;
    S.px = -8; S.pz = 132; S.heading = Math.PI;
    putInNearestCar();
    if (S.car) S.car.speed = 22;
    startMission();
    return null; // chase cam — the drive reads best from behind the car
  }
  if (n === 4) {
    // Neon Row, 3 stars, helicopter + cruisers closing in. Player stands on
    // the Neon Row road facing the signs; camera sits further down the road
    // so the signs read face-on with the city behind them.
    S.px = -8; S.pz = -186; S.heading = Math.PI;
    S.wanted = 0;
    S.heliAlt = 26; // bring the helicopter down into the frame for this shot
    addWanted(3, 'shot');
    return { camPos: [36, 10, -220], camLook: [-12, 10, -176] };
  }
  return null;
}
