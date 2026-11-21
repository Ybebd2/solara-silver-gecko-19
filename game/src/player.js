// SOLARA — player.js (fresh build from spec, round 8)
// Kai on foot + in a car: WASD, sprint, jump, enter/exit, autopilot.

import * as THREE from 'three';
import { WEAPONS } from './config.js';

export function createPlayer(scene, S) {
  const kai = new THREE.Group();
  // Kai: bright teal jacket, dark jeans, big enough to read on screen.
  const jacket = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 0.95, 4, 10),
    new THREE.MeshStandardMaterial({ color: 0x00bfa5, roughness: 0.7 })
  );
  jacket.position.y = 1.45;
  kai.add(jacket);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xe8b98a, roughness: 0.8 })
  );
  head.position.y = 2.65;
  kai.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 })
  );
  hair.position.y = 2.72;
  kai.add(hair);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.95, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.9 })
  );
  legs.position.y = 0.5;
  kai.add(legs);
  // weapon in hand (VESPER pistol by default)
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.14, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.3 })
  );
  gun.position.set(0.55, 1.5, 0.25);
  kai.add(gun);
  kai.position.set(S.px, 0, S.pz);
  kai.rotation.y = S.heading;
  scene.add(kai);

  let vy = 0;
  let y = 0;
  let bobPhase = 0;

  function update(dt, input, vehicles, missions) {
    const k = input.keys;
    const sprint = k['ShiftLeft'] || k['ShiftRight'];
    const walkSpeed = sprint ? 11 : 6.5;

    if (S.autopilot && S.waypoint) {
      // F9 autopilot: steer toward the waypoint
      const dx = S.waypoint[0] - S.px, dz = S.waypoint[1] - S.pz;
      const dist = Math.hypot(dx, dz);
      if (dist < 3) {
        S.autopilot = false;
        S.waypoint = null;
        S.message = 'AUTOPILOT OFF — ARRIVED';
        S.messageUntil = S.time + 3;
      } else {
        const targetHeading = Math.atan2(-dz, dx);
        let dh = targetHeading - S.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        S.heading += Math.max(-2.5 * dt, Math.min(2.5 * dt, dh));
        if (S.inCar) {
          S.carSpeed = Math.min(S.carSpeed + 22 * dt, 26);
        } else {
          S.speed = walkSpeed;
          S.px += Math.cos(S.heading) * S.speed * dt;
          S.pz += -Math.sin(S.heading) * S.speed * dt;
        }
      }
    } else if (S.inCar) {
      // Driving: W/S accelerate/brake, A/D steer.
      const accel = k['KeyW'] || k['ArrowUp'] ? 26 : 0;
      const brake = k['KeyS'] || k['ArrowDown'] ? 34 : 0;
      S.carSpeed += (accel - brake) * dt;
      S.carSpeed -= S.carSpeed * 0.6 * dt; // drag
      if (Math.abs(S.carSpeed) < 0.2 && accel === 0) S.carSpeed = 0;
      S.carSpeed = Math.max(-9, Math.min(38, S.carSpeed));
      const steer = (k['KeyA'] || k['ArrowLeft'] ? 1 : 0) - (k['KeyD'] || k['ArrowRight'] ? 1 : 0);
      if (Math.abs(S.carSpeed) > 0.5) {
        S.heading += steer * 1.9 * dt * Math.sign(S.carSpeed);
      }
      S.px += Math.cos(S.heading) * S.carSpeed * dt;
      S.pz += -Math.sin(S.heading) * S.carSpeed * dt;
      S.speed = Math.abs(S.carSpeed);
    } else {
      // On foot: WASD relative to camera yaw (input.camYaw).
      let mx = 0, mz = 0;
      if (k['KeyW'] || k['ArrowUp']) mz -= 1;
      if (k['KeyS'] || k['ArrowDown']) mz += 1;
      if (k['KeyA'] || k['ArrowLeft']) mx -= 1;
      if (k['KeyD'] || k['ArrowRight']) mx += 1;
      const len = Math.hypot(mx, mz);
      if (len > 0) {
        mx /= len; mz /= len;
        // camera yaw: forward on screen = -Z rotated by camYaw
        const yaw = input.camYaw;
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
        const rx = -fz, rz = fx;
        const wx = fx * -mz + rx * mx;
        const wz = fz * -mz + rz * mx;
        S.speed = walkSpeed;
        S.px += wx * S.speed * dt;
        S.pz += wz * S.speed * dt;
        S.heading = Math.atan2(-wz, wx);
        bobPhase += dt * 10;
      } else {
        S.speed = 0;
      }
      // jump
      if (k['Space'] && y === 0) vy = 8;
    }

    // gravity / landing
    if (y > 0 || vy !== 0) {
      vy -= 24 * dt;
      y += vy * dt;
      if (y <= 0) { y = 0; vy = 0; }
    }

    // world bounds
    S.px = Math.max(-318, Math.min(318, S.px));
    S.pz = Math.max(-318, Math.min(318, S.pz));

    // gecko pickup
    if (window.__solaraWorld) {
      for (const g of window.__solaraWorld.geckos) {
        if (!g.userData.taken && Math.hypot(g.position.x - S.px, g.position.z - S.pz) < 2.2) {
          g.userData.taken = true;
          g.visible = false;
          S.cash += 50;
          S.message = 'GOLDEN GECKO +$50';
          S.messageUntil = S.time + 2.5;
        }
      }
    }

    // mesh follows state
    kai.position.set(S.px, y + Math.abs(Math.sin(bobPhase)) * (S.speed > 0.5 ? 0.08 : 0), S.pz);
    kai.rotation.y = S.heading;
    kai.visible = !S.inCar;
    gun.visible = S.weaponIdx !== 4;

    // F: enter / exit car
    if (input.wasPressed('KeyF')) {
      if (S.inCar) {
        S.inCar = false;
        S.carSpeed = 0;
        const c = S.car;
        S.car = null;
        S.px += Math.cos(S.heading + Math.PI / 2) * 3;
        S.pz += -Math.sin(S.heading + Math.PI / 2) * 3;
        S.message = 'OUT OF THE CAR';
        S.messageUntil = S.time + 2;
      } else {
        const car = vehicles.nearestCar(S.px, S.pz, 6);
        if (car) {
          S.inCar = true;
          S.car = car;
          S.carSpeed = 0;
          S.carsJacked++;
          S.jackedAt = S.time;
          S.message = 'CAR JACKED — DRIVE!';
          S.messageUntil = S.time + 2.5;
        }
      }
    }

    // R: reload
    if (input.wasPressed('KeyR')) {
      const w = WEAPONS[S.weaponIdx];
      if (w.mag !== Infinity && S.ammo < w.mag && S.reserve > 0) {
        const need = w.mag - S.ammo;
        const take = Math.min(need, S.reserve);
        S.ammo += take;
        S.reserve -= take;
      }
    }
    // 1-5: weapons
    for (let i = 0; i < 5; i++) {
      if (input.wasPressed('Digit' + (i + 1))) {
        S.weaponIdx = i;
        S.ammo = WEAPONS[i].mag === Infinity ? Infinity : WEAPONS[i].mag;
        S.reserve = 48;
      }
    }
    // Q: radio station
    if (input.wasPressed('KeyQ')) {
      S.station = (S.station + 1) % 4;
    }
    // F9: autopilot toggle (to current mission target)
    if (input.wasPressed('F9')) {
      S.autopilot = !S.autopilot;
      if (S.autopilot) {
        const m = missions.current();
        S.waypoint = m ? m.target.slice() : null;
        S.message = 'AUTOPILOT ON';
        S.messageUntil = S.time + 2;
      } else {
        S.message = 'AUTOPILOT OFF';
        S.messageUntil = S.time + 2;
      }
    }
    // Crew: Z Mara ghost, X Sully pit crew, C Kiki lookout
    if (input.wasPressed('KeyZ') && S.crewCd.MARA <= 0) {
      if (S.wanted > 0) S.wanted--;
      S.crewCd.MARA = 90;
      S.message = 'MARA: GHOST — one star gone';
      S.messageUntil = S.time + 3;
    }
    if (input.wasPressed('KeyX') && S.crewCd.SULLY <= 0) {
      S.health = 100;
      S.crewCd.SULLY = 60;
      S.message = 'SULLY: PIT CREW — patched up';
      S.messageUntil = S.time + 3;
    }
    if (input.wasPressed('KeyC') && S.crewCd.KIKI <= 0) {
      S.lookoutUntil = S.time + 20;
      S.crewCd.KIKI = 60;
      S.message = 'KIKI: LOOKOUT — patrols revealed 20s';
      S.messageUntil = S.time + 3;
    }
  }

  return { kai, update };
}
