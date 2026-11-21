// SOLARA — shots.js (fresh build from spec, round 8)
// ?shot=1..4 fixed cameras. Each shot STAGES the scene — Kai in a car,
// packed traffic, a mission running, dialogue showing, wanted stars up —
// not just a camera move. S.shotMode = true freezes police rams so the
// staged frame stays intact.

export function applyShot(n, deps) {
  const { S, missions, vehicles, world } = deps;
  S.shotMode = true;

  if (n === 1) {
    // Start menu: keep the menu visible, camera over downtown looking east
    // at the street and the gold/teal skyscrapers.
    S.started = false;
    return { camPos: [-236, 9, 84], camLook: [-40, 26, -20], keepMenu: true };
  }

  if (n === 2) {
    // Packed street: Kai in the red sports car, driving east on road z=64;
    // 8 traffic cars clustered tight ahead in both lanes, 6 m spacing.
    S.started = true;
    const car = vehicles.starterCar;
    car.x = -40; car.z = 64; car.heading = 0; car.speed = 12;
    car.mesh.position.set(-40, 0, 64);
    car.mesh.rotation.y = 0;
    S.inCar = true;
    S.car = car;
    S.carSpeed = 12;
    S.px = -40; S.pz = 64; S.heading = 0;
    const lanes = [59, 69];
    for (let i = 0; i < 8; i++) {
      const t = vehicles.traffic[i];
      if (!t || t === car) continue;
      t.x = -28 + i * 6;
      t.z = lanes[i % 2];
      t.heading = 0;
      t.speed = 10;
      t.mesh.position.set(t.x, 0, t.z);
      t.mesh.rotation.y = 0;
    }
    S.wanted = 1;
    S.message = 'NEON ROW — 8 CARS DEEP, COPS ON THE TAIL';
    S.messageUntil = S.time + 999;
    // camera right behind Kai's red car so it fills the lower frame,
    // traffic packed ahead of it
    return { camPos: [-38, 2.2, 70], camLook: [-24, 1.5, 64], keepMenu: false };
  }

  if (n === 3) {
    // Kai on foot at the safehouse, mission 0 started, Lupe talking.
    S.started = true;
    S.inCar = false;
    S.car = null;
    S.carSpeed = 0;
    S.px = -40; S.pz = -184; S.heading = Math.PI;
    S.missionIdx = 0;
    S.missionActive = false;
    missions.startMission();
    S.dialogueUntil = S.time + 999;
    S.wanted = 2;
    S.message = "LUPE'S FIRST JOB — MEET HER AT MO'S";
    S.messageUntil = S.time + 999;
    return { camPos: [-46, 1.7, -184], camLook: [-39, 1.25, -184], keepMenu: false };
  }

  if (n === 4) {
    // Neon chase: mission 5 (Hot Wheels) running, heli overhead, 3 stars.
    S.started = true;
    S.inCar = false;
    S.car = null;
    S.carSpeed = 0;
    S.px = -8; S.pz = -186; S.heading = Math.PI;
    S.missionIdx = 5;
    S.missionActive = false;
    missions.startMission();
    S.wanted = 3;
    S.dialogueUntil = S.time + 999;
    S.message = 'HOT WHEELS — JACK A RIDE, LOSE THE HELI';
    S.messageUntil = S.time + 999;
    // park a red sports car right beside Kai so the chase reads instantly
    const car = vehicles.starterCar;
    car.x = -14; car.z = -180; car.heading = Math.PI;
    car.mesh.position.set(-14, 0, -180);
    car.mesh.rotation.y = Math.PI;
    // a couple of cruisers visible down the street
    // camera ON the road (z=-192) looking down the street at Kai,
    // heli parked in-frame up-left — the spec camera sat inside a
    // building block and was blocked.
    return { camPos: [14, 7, -204], camLook: [-6, 6, -184], keepMenu: false };
  }

  return null;
}

export function shotFromUrl() {
  const q = new URLSearchParams(window.location.search);
  const n = parseInt(q.get('shot') || '0', 10);
  return n >= 1 && n <= 4 ? n : 0;
}
