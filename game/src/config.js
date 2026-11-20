// SOLARA — config.js
// Shared state, world constants, districts, weapons, radio, crew.
// Every other module imports from here; nothing here imports anything else.

export const S = {
  px: -40, pz: -184, heading: 0,
  cash: 250, health: 100, armour: 0,
  ammo: 12, reserve: 48, weaponIdx: 0,
  wanted: 0, seen: false, evading: 0,
  rank: 'ROOKIE', missionIdx: 0, jobsDone: 0,
  missionActive: false, missionTime: 0, missionHold: 0,
  time: 0, started: false, paused: false, mapOpen: false, over: false,
  inCar: false, car: null, carSpeed: 0, autopilot: false,
  station: 0, radioOn: true, soundOn: true,
  crewCd: { MARA: 0, SULLY: 0, KIKI: 0 },
  waypoint: null, dialogueUntil: 0,
  message: '', messageUntil: 0,
  jackedAt: -99, lookoutUntil: 0,
};

export const WORLD = {
  size: 640,
  roadGap: 64,
  beachX: -296,
};

export const DISTRICTS = [
  { name: 'MARINA BAY', x: -240, z: 200, grip: 45 },
  { name: 'OLD PORT', x: -240, z: -200, grip: 55 },
  { name: 'DOWNTOWN', x: 0, z: 0, grip: 30 },
  { name: 'NEON ROW', x: 0, z: -192, grip: 65 },
  { name: 'PALM HEIGHTS', x: 160, z: 160, grip: 40 },
  { name: 'DOCKSIDE', x: 224, z: -160, grip: 70 },
  { name: 'SOLARA BEACH', x: -280, z: 0, grip: 25 },
];

export const WEAPONS = [
  { name: 'VESPER', kind: 'gun', dmg: 34, mag: 12, range: 120, rate: 0.25, auto: false },
  { name: 'JACKAL', kind: 'gun', dmg: 18, mag: 30, range: 90, rate: 0.09, auto: true },
  { name: 'LONGSHOT', kind: 'gun', dmg: 80, mag: 5, range: 180, rate: 0.8, auto: false },
  { name: 'RIOT', kind: 'gun', dmg: 12, mag: 6, range: 40, rate: 0.7, auto: false, pellets: 6 },
  { name: 'FISTS', kind: 'melee', dmg: 10, mag: 0, range: 2, rate: 0.4, auto: false },
];

export const RADIO = [
  { name: 'PUERTO 88.3', desc: 'salsa & latin', song: 'Celia Cruz — Quimbara' },
  { name: 'CELESTE 98.1', desc: 'smooth soul', song: 'Marvin Gaye — Mercy Mercy Me' },
  { name: 'SOLARA 98.3', desc: 'coast pop', song: 'Kai & The Coast — Bright Day' },
  { name: 'NEON 101.5', desc: 'synth nights', song: 'Midnight Drive — Chrome Sunset' },
];

export const CREW = {
  MARA: { key: 'KeyZ', name: 'MARA', title: 'GHOST', cooldown: 60 },
  SULLY: { key: 'KeyX', name: 'SULLY', title: 'PIT CREW', cooldown: 45 },
  KIKI: { key: 'KeyC', name: 'KIKI', title: 'LOOKOUT', cooldown: 30 },
};

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function fmtCash(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function fmtClock(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
}

export function rankFor(jobs) {
  if (jobs >= 8) return 'FIXER';
  if (jobs >= 6) return 'ENFORCER';
  if (jobs >= 4) return 'HUSTLER';
  if (jobs >= 2) return 'DRIVER';
  return 'ROOKIE';
}

export function districtAt(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const d of DISTRICTS) {
    const dd = (d.x - x) * (d.x - x) + (d.z - z) * (d.z - z);
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best;
}
