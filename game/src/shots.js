// SOLARA — shots.js
// Fixed cameras for the four dossier screenshots (?shot=1..4). Each one
// frames the action the shot is named for: title, drive, mission, chase.

import { S } from './config.js';

export function getShotParam() {
  try {
    const q = new URLSearchParams(window.location.search);
    const n = parseInt(q.get('shot') || '0', 10);
    return n >= 1 && n <= 4 ? n : 0;
  } catch (e) {
    return 0;
  }
}

export function applyShot(n) {
  if (n === 1) {
    // start menu: high over downtown — diamond tower, pastel blocks, beach
    return { camPos: [70, 38, 95], camLook: [-30, 14, -30] };
  }
  if (n === 2) {
    // drive: behind the car on road z=64, packed traffic ahead
    const bx = Math.sin(S.heading);
    const bz = Math.cos(S.heading);
    return {
      camPos: [S.px - bx * 13, 5.5, S.pz - bz * 13],
      camLook: [S.px + bx * 14, 1.5, S.pz + bz * 14],
    };
  }
  if (n === 3) {
    // mission: Kai on foot in close right profile — camera 8 m off, low,
    // so Kai is BIG in frame and the silver VESPER at his hip reads.
    return { camPos: [S.px + 5, 2.8, S.pz + 6], camLook: [S.px - 0.5, 1.3, S.pz - 0.5] };
  }
  // chase: camera 40 m back on open ground so the whole heli-to-ground
  // span fits — heli (altitude ~24) above, beam pool on the road below.
  // The MO'S sign sits west of the player and stays in the background,
  // never in front of the lens.
  return { camPos: [S.px + 32, 6, S.pz + 24], camLook: [S.px, 12, S.pz] };
}
