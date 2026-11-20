// SOLARA — config.js
// All tuning, districts, weapons, ranks, radio and shared game state.
// Written fresh for SOLARA (zesty-condor-69-fresh). No code copied from any
// other entry or starter.

export const WORLD = {
  size: 640,            // playable square, metres (x and z in [-320, 320])
  roadGap: 64,          // distance between road centre lines
  roadWidth: 14,
  beachX: -268,         // west of this is sand, then ocean
  oceanX: -300,
  blockSize: 50,
};

export const DISTRICTS = [
  { name: 'MARINA BAY',   x: -210, z: -210, r: 90,  color: '#4fc3f7' },
  { name: 'OLD PORT',     x: -210, z:  210, r: 90,  color: '#ffb74d' },
  { name: 'DOWNTOWN',     x:    0, z:    0, r: 110, color: '#ff5252' },
  { name: 'NEON ROW',     x:    0, z: -190, r: 80,  color: '#e040fb' },
  { name: 'PALM HEIGHTS', x:  190, z: -190, r: 90,  color: '#69f0ae' },
  { name: 'DOCKSIDE',     x:  190, z:  190, r: 90,  color: '#ffd54f' },
  { name: 'SOLARA BEACH', x: -280, z:    0, r: 90,  color: '#fff176' },
];

export const WEAPONS = [
  { name: 'VESPER',  kind: 'pistol', mag: 12, damage: 34, rate: 0.16, range: 90,  auto: false },
  { name: 'JACKAL',  kind: 'smg',    mag: 30, damage: 16, rate: 0.09, range: 70,  auto: true  },
  { name: 'LONGSHOT',kind: 'rifle',  mag: 8,  damage: 80, rate: 0.70, range: 160, auto: false },
  { name: 'RIOT',    kind: 'shotgun',mag: 6,  damage: 22, rate: 0.80, range: 40,  auto: false },
  { name: 'FISTS',   kind: 'melee',  mag: Infinity, damage: 12, rate: 0.35, range: 3, auto: true },
];

export const RANKS = [
  { name: 'ROOKIE',  jobs: 0 },
  { name: 'RUNNER',  jobs: 2 },
  { name: 'HUSTLER', jobs: 5 },
  { name: 'FIXER',   jobs: 8 },
];

export const RADIO = [
  { name: 'PUERTO 88.3',  desc: 'latin gold',  hue: 0 },
  { name: 'CELESTE 98.1', desc: 'synthwave',   hue: 1 },
  { name: 'SOLARA 98.3',  desc: 'golden hour', hue: 2 },
];

export const CREW = {
  MARA:  { key: 'KeyZ', name: 'MARA / GHOST',   desc: 'Ghost: -1 wanted star', cooldown: 90 },
  SULLY: { key: 'KeyX', name: 'SULLY / PIT CREW', desc: 'Full repair, in car', cooldown: 60 },
  KIKI:  { key: 'KeyC', name: 'KIKI / LOOKOUT', desc: 'Patrols revealed 20s', cooldown: 60 },
};

// Mutable shared game state. Every module imports this one object.
export const S = {
  time: 0,            // seconds since load
  paused: false,
  mapOpen: false,
  started: false,
  // player
  px: -40, pz: 60, heading: Math.PI * 0.75, speed: 0,
  health: 100, cash: 250, wanted: 0, evading: 0, seen: false,
  weaponIdx: 0, ammo: 12, reserve: 48,
  inCar: false, car: null, carSpeed: 0,
  // missions
  missionIdx: 0, missionActive: false, missionTime: 0, missionStage: 0,
  missionHold: 0, jobsDone: 0, rank: 'ROOKIE',
  // crew
  crewCd: { MARA: 0, SULLY: 0, KIKI: 0 },
  lookoutUntil: 0,
  // radio
  station: 0, radioOn: true,
  // map
  waypoint: null,
  // stats
  shotsFired: 0, hits: 0, carsJacked: 0, arrests: 0,
  message: '',
  messageUntil: 0,
  over: false,
};

export function rankFor(jobsDone) {
  let r = RANKS[0].name;
  for (const rnk of RANKS) if (jobsDone >= rnk.jobs) r = rnk.name;
  return r;
}

export function districtAt(x, z) {
  let best = null, bestD = Infinity;
  for (const d of DISTRICTS) {
    const dd = Math.hypot(x - d.x, z - d.z);
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best;
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function fmtClock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
export function fmtCash(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
