// SOLARA — config.js (fresh build from spec, round 8)
// World tuning, districts, weapons, ranks, radio, crew, shared state S.

export const WORLD = {
  size: 640,
  half: 320,
  roadGap: 64,
  roadWidth: 20,
  beachX: -268,
  oceanX: -300,
  blockSize: 50,
};

export const DISTRICTS = [
  { name: 'MARINA BAY', x: -210, z: -210, r: 90, color: '#4fc3f7', grip: 55 },
  { name: 'OLD PORT', x: -210, z: 210, r: 90, color: '#ffb74d', grip: 45 },
  { name: 'DOWNTOWN', x: 0, z: 0, r: 110, color: '#ff5252', grip: 30 },
  { name: 'NEON ROW', x: 0, z: -190, r: 80, color: '#e040fb', grip: 35 },
  { name: 'PALM HEIGHTS', x: 190, z: -190, r: 90, color: '#69f0ae', grip: 50 },
  { name: 'DOCKSIDE', x: 190, z: 190, r: 90, color: '#ffd54f', grip: 40 },
  { name: 'SOLARA BEACH', x: -280, z: 0, r: 90, color: '#fff176', grip: 50 },
];

export const WEAPONS = [
  { name: 'VESPER', kind: 'pistol', mag: 12, dmg: 34, rate: 0.16, range: 90, auto: false },
  { name: 'JACKAL', kind: 'smg', mag: 30, dmg: 16, rate: 0.09, range: 70, auto: true },
  { name: 'LONGSHOT', kind: 'rifle', mag: 8, dmg: 80, rate: 0.70, range: 160, auto: false },
  { name: 'RIOT', kind: 'shotgun', mag: 6, dmg: 22, rate: 0.80, range: 40, auto: false },
  { name: 'FISTS', kind: 'melee', mag: Infinity, dmg: 12, rate: 0.35, range: 3, auto: true },
];

export const RANKS = [
  { name: 'ROOKIE', jobs: 0 },
  { name: 'RUNNER', jobs: 2 },
  { name: 'HUSTLER', jobs: 5 },
  { name: 'FIXER', jobs: 8 },
];

export function rankFor(jobs) {
  if (jobs >= 8) return 'FIXER';
  if (jobs >= 5) return 'HUSTLER';
  if (jobs >= 2) return 'RUNNER';
  return 'ROOKIE';
}

export const RADIO = [
  { name: 'PUERTO 88.3', style: 'latin gold' },
  { name: 'CELESTE 98.1', style: 'synthwave' },
  { name: 'SOLARA 98.3', style: 'daytime' },
  { name: 'NEON 101.5', style: 'night drive' },
];

export const CREW = [
  { name: 'MARA', key: 'KeyZ', power: 'GHOST', desc: '-1 wanted star', cd: 90 },
  { name: 'SULLY', key: 'KeyX', power: 'PIT CREW', desc: 'full repair in car', cd: 60 },
  { name: 'KIKI', key: 'KeyC', power: 'LOOKOUT', desc: 'patrols revealed 20s', cd: 60 },
];

// Shared state S — exact fields, exact initial values (spec).
export function createState() {
  return {
    time: 0,
    paused: false,
    mapOpen: false,
    started: false,
    px: -40, pz: 60, heading: Math.PI * 0.75, speed: 0,
    health: 100, armour: 40, cash: 250, wanted: 0, evading: 0, seen: false,
    soundOn: true, dialogueUntil: 0, autopilot: false, jackedAt: -99,
    gripBonus: 0, shotMode: false, weaponIdx: 0, ammo: 12, reserve: 48,
    inCar: false, car: null, carSpeed: 0,
    missionIdx: 0, missionActive: false, missionTime: 0, missionStage: 0,
    missionHold: 0, jobsDone: 0, rank: 'ROOKIE',
    crewCd: { MARA: 0, SULLY: 0, KIKI: 0 }, lookoutUntil: 0,
    station: 0, radioOn: true, waypoint: null,
    shotsFired: 0, hits: 0, carsJacked: 0, arrests: 0,
    message: '', messageUntil: 0, over: false,
  };
}

// District lookup: which district contains (x,z), for grip + HUD label.
export function districtAt(x, z) {
  let best = null, bestD = Infinity;
  for (const d of DISTRICTS) {
    const dx = x - d.x, dz = z - d.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < d.r && dist < bestD) { best = d; bestD = dist; }
  }
  return best || DISTRICTS[2];
}
