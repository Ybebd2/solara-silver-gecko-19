// SOLARA — missions.js (fresh build from spec, round 8)
// 8 jobs, TYPE-BASED completion. First job starts at (-40,-192).

import { rankFor } from './config.js';

export const MISSIONS = [
  {
    name: "LUPE — First Fix", giver: 'LUPE', type: 'goto', target: [-40, -192],
    start: [-40, -192], time: 180, reward: 400,
    brief: "Meet Lupe at MO'S on Neon Row. She has your first job.",
    dialogue: 'LUPE: Kai! Finally. First job is easy — just come meet me.',
    reply: "KAI: On my way, Lupe. Don't start without me.",
  },
  {
    name: "SULLY — Tow Job", giver: 'SULLY', type: 'driveTo', target: [192, 192],
    start: [-40, -192], time: 240, reward: 650,
    brief: 'Sully needs a car moved to Dockside. Grab wheels and drive it there.',
    dialogue: 'SULLY: Need wheels moved to Dockside. No joyriding, Kai.',
    reply: 'KAI: Dockside, got it. Car will be there in one piece.',
  },
  {
    name: "MARCO — Marco's Run", giver: 'MARCO', type: 'driveTo', target: [-192, 192],
    start: [0, -128], time: 210, reward: 800,
    brief: "Marco's package goes to Old Port. Drive it there, no scratches.",
    dialogue: 'MARCO: Package goes to Old Port. Drive smooth, no scratches.',
    reply: 'KAI: Smooth as glass, Marco. Old Port it is.',
  },
  {
    name: "BRANDT — The Ledger", giver: 'BRANDT', type: 'hold', target: [64, 64],
    start: [0, 0], time: 240, reward: 1100,
    brief: "Brandt's ledger is in the Downtown office. Hold the spot 5s to lift it.",
    dialogue: 'BRANDT: The ledger is in the Downtown office. Hold the spot, lift it clean.',
    reply: 'KAI: Five seconds and the ledger is mine.',
  },
  {
    name: "AURORA — Aurora's Light", giver: 'AURORA', type: 'goto', target: [-262, -40],
    start: [-40, -192], time: 200, reward: 900,
    brief: 'Aurora waits on the beach boardwalk. Walk the sand, hear her out.',
    dialogue: 'AURORA: The boardwalk at sunset... come walk the sand with me.',
    reply: 'KAI: Sand, sea and a job? I am already there.',
  },
  {
    name: "LUPE — Hot Wheels", giver: 'LUPE', type: 'carjack', target: [0, -128],
    start: [-40, -192], time: 180, reward: 1000,
    brief: 'Lupe wants a fresh ride. Jack any car on Neon Row and bring it to the mark.',
    dialogue: 'LUPE: I need a fresh ride, Kai. Jack one on Neon Row, bring it to the mark.',
    reply: 'KAI: One fresh ride, coming up. Try not to get attached.',
  },
  {
    name: "SULLY — Heat Wave", giver: 'SULLY', type: 'escape', target: [256, -192],
    start: [192, 192], time: 300, reward: 1400,
    brief: "The heat is on. Lose the cops, then reach Sully's hideout in Palm Heights.",
    dialogue: 'SULLY: Heat is on, Kai. Lose the cops, then get to my hideout.',
    reply: 'KAI: Lose the cops, then Palm Heights. Easy... right?',
  },
  {
    name: 'BRANDT — The Solara Job', giver: 'BRANDT', type: 'finale', target: [-128, 0],
    start: [-40, -192], time: 360, reward: 5000,
    brief: 'The big one. Hold the bank door 5s, then drive the getaway to the Marina.',
    dialogue: 'BRANDT: The big one, Kai. Bank door, five seconds, then the Marina.',
    reply: 'KAI: The Solara Job. Lets make history, Brandt.',
  },
];

export function createMissions(S, world) {
  function current() {
    return MISSIONS[S.missionIdx] || null;
  }

  function placeMarkers() {
    const m = current();
    if (!m) {
      world.startMarker.visible = false;
      world.beacon.visible = false;
      return;
    }
    world.startMarker.visible = !S.missionActive;
    world.startMarker.position.set(m.start[0], 0.2, m.start[1]);
    world.beacon.visible = S.missionActive;
    const tgt = S.missionActive && m.type === 'finale' && S.missionStage === 1 ? [-192, -192] : m.target;
    world.beacon.position.set(tgt[0], 0, tgt[1]);
  }

  function startMission() {
    const m = current();
    if (!m || S.missionActive) return false;
    S.missionActive = true;
    S.missionTime = m.time;
    S.missionStage = 0;
    S.missionHold = 0;
    S.message = m.name + ' — ' + m.brief;
    S.messageUntil = S.time + 6;
    S.dialogueUntil = S.time + 8;
    placeMarkers();
    return true;
  }

  function completeMission() {
    const m = current();
    if (!m) return;
    S.cash += m.reward;
    S.jobsDone++;
    S.rank = rankFor(S.jobsDone);
    S.missionActive = false;
    S.missionHold = 0;
    S.missionStage = 0;
    if (S.jobsDone >= 8) {
      S.message = 'ALL 8 JOBS DONE — YOU ARE THE FIXER OF SOLARA';
      S.wanted = 0;
    } else {
      S.message = 'JOB DONE +$' + m.reward + ' — ' + S.rank;
    }
    S.messageUntil = S.time + 6;
    S.missionIdx = Math.min(S.missionIdx + 1, 7);
    placeMarkers();
  }

  function failMission(reason) {
    S.missionActive = false;
    S.missionHold = 0;
    S.missionStage = 0;
    S.message = 'JOB FAILED — ' + reason + '. Press E to retry.';
    S.messageUntil = S.time + 5;
    placeMarkers();
  }

  function distToTarget() {
    const m = current();
    if (!m) return 0;
    const tgt = S.missionActive && m.type === 'finale' && S.missionStage === 1 ? [-192, -192] : m.target;
    return Math.hypot(tgt[0] - S.px, tgt[1] - S.pz);
  }

  function update(dt) {
    const m = current();
    if (!m) return;
    if (!S.missionActive) {
      placeMarkers();
      return;
    }
    S.missionTime -= dt;
    if (S.missionTime <= 0) {
      failMission('OUT OF TIME');
      return;
    }
    const d = distToTarget();
    if (m.type === 'goto') {
      if (d <= 7 && !S.inCar) completeMission();
    } else if (m.type === 'driveTo') {
      if (d <= 7 && S.inCar) completeMission();
    } else if (m.type === 'hold') {
      if (d <= 7) {
        S.missionHold += dt;
        if (S.missionHold >= 5) completeMission();
      } else {
        S.missionHold = 0;
      }
    } else if (m.type === 'carjack') {
      if (d <= 7 && S.inCar) completeMission();
    } else if (m.type === 'escape') {
      if (d <= 7 && S.wanted === 0) completeMission();
    } else if (m.type === 'finale') {
      if (S.missionStage === 0) {
        if (d <= 7) {
          S.missionHold += dt;
          if (S.missionHold >= 5) {
            S.missionStage = 1;
            S.missionHold = 0;
            S.message = 'BANK DOOR OPEN — DRIVE THE GETAWAY TO THE MARINA!';
            S.messageUntil = S.time + 5;
            placeMarkers();
          }
        } else {
          S.missionHold = 0;
        }
      } else if (d <= 7 && S.inCar) {
        completeMission();
      }
    }
    placeMarkers();
  }

  placeMarkers();
  return { MISSIONS, current, startMission, completeMission, failMission, distToTarget, update, placeMarkers };
}
