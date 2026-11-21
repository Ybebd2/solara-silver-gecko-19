// SOLARA — police.js (fresh build from spec, round 8)
// Cruisers + officers + a detailed white helicopter. The searchlight
// beam is computed LIVE from the heli lamp position every frame:
// apex at the spotlight under the nose, beam to the ground, bright pool
// at the exact hit point. Nothing floats, nothing is faked.

import * as THREE from 'three';

function makeCruiser() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.9, 2.0),
    new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.4, roughness: 0.4 })
  );
  body.position.y = 0.8;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.7, 1.8),
    new THREE.MeshStandardMaterial({ color: 0xf5f5f5, metalness: 0.3, roughness: 0.4 })
  );
  cabin.position.set(-0.2, 1.5, 0);
  g.add(cabin);
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.3, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff0000, emissiveIntensity: 2 })
  );
  bar.position.set(-0.2, 1.95, 0);
  g.add(bar);
  const barL = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.32, 0.52),
    new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2.5 })
  );
  barL.position.set(-0.45, 1.95, 0);
  g.add(barL);
  const barR = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.32, 0.52),
    new THREE.MeshStandardMaterial({ color: 0x0000ff, emissive: 0x0000ff, emissiveIntensity: 2.5 })
  );
  barR.position.set(0.05, 1.95, 0);
  g.add(barR);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  for (const [wx, wz] of [[1.4, 0.95], [1.4, -0.95], [-1.4, 0.95], [-1.4, -0.95]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    g.add(wheel);
  }
  return g;
}

function makeOfficer() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.42, 0.9, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x0d47a1, roughness: 0.8 })
  );
  body.position.y = 1.35;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xe8b98a, roughness: 0.8 })
  );
  head.position.y = 2.6;
  g.add(head);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.16, 10),
    new THREE.MeshStandardMaterial({ color: 0x0d47a1, roughness: 0.8 })
  );
  cap.position.y = 2.85;
  g.add(cap);
  return g;
}

function makeHeli() {
  const g = new THREE.Group();
  // detailed white fuselage
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 1.6, 2.2),
    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.3, roughness: 0.4 })
  );
  body.position.y = 0;
  g.add(body);
  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.3, roughness: 0.4 })
  );
  nose.position.set(2.2, -0.1, 0);
  nose.scale.set(1.2, 0.9, 1);
  g.add(nose);
  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x0d47a1, metalness: 0.7, roughness: 0.15 })
  );
  glass.position.set(2.35, 0.25, 0);
  glass.scale.set(1.1, 0.75, 0.95);
  g.add(glass);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.7, 0.7),
    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.3, roughness: 0.4 })
  );
  tail.position.set(-3.6, 0.35, 0);
  g.add(tail);
  const fin = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 1.6, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.5 })
  );
  fin.position.set(-5.2, 0.9, 0);
  g.add(fin);
  const skidMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.4 });
  for (const z of [-0.9, 0.9]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.6, 6), skidMat);
    skid.rotation.x = Math.PI / 2;
    skid.position.set(0.4, -1.15, z);
    g.add(skid);
  }
  // main rotor + tail rotor
  const rotor = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 5.4), bladeMat);
    blade.rotation.y = (i * Math.PI) / 2;
    rotor.add(blade);
  }
  rotor.position.y = 1.15;
  g.add(rotor);
  const tailRotor = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.2), bladeMat);
    blade.rotation.x = (i * Math.PI) / 2;
    tailRotor.add(blade);
  }
  tailRotor.position.set(-5.3, 0.9, 0.45);
  g.add(tailRotor);
  // spotlight lamp UNDER THE NOSE — the beam apex
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff9c4, emissiveIntensity: 3 })
  );
  lamp.position.set(2.0, -0.95, 0);
  g.add(lamp);
  return { group: g, rotor, tailRotor, lamp };
}

export function createPolice(scene, S) {
  const cruisers = [];
  const officers = [];
  const group = new THREE.Group();
  scene.add(group);

  for (let i = 0; i < 4; i++) {
    const c = makeCruiser();
    c.position.set(-120 + i * 80, 0, 120);
    group.add(c);
    cruisers.push({ mesh: c, x: c.position.x, z: c.position.z, heading: 0, speed: 0, active: false });
  }
  for (let i = 0; i < 6; i++) {
    const o = makeOfficer();
    o.position.set(-60 + i * 24, 0, -40);
    group.add(o);
    officers.push({ mesh: o, x: o.position.x, z: o.position.z, active: false });
  }

  // Helicopter + its beam. Beam geometry is rebuilt every frame from the
  // lamp's live world position so it can never detach from the heli.
  const heli = makeHeli();
  heli.group.position.set(S.px + 30, 26, S.pz - 30);
  group.add(heli.group);

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff9c4, transparent: true, opacity: 0.20,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  // cone with apex at origin (top) opening downward — positioned each frame
  const beamGeo = new THREE.ConeGeometry(3.5, 1, 20, 1, true);
  beamGeo.translate(0, -0.5, 0); // apex at y=0, base at y=-1 (unit height)
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.visible = false;
  scene.add(beam);
  // bright pool where the beam hits the ground
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(3.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff9c4, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.1;
  pool.visible = false;
  scene.add(pool);
  // real spotlight from the lamp
  const spot = new THREE.SpotLight(0xfff9c4, 0, 90, 0.35, 0.5, 1.2);
  scene.add(spot);
  scene.add(spot.target);

  let heliAngle = 0;
  let bobPhase = 0;

  function update(dt, t) {
    const wanted = S.wanted;
    const active = wanted > 0 && !S.shotMode ? true : wanted > 0;
    // cruisers chase when wanted, patrol slowly otherwise
    const wantCruisers = wanted >= 1 ? Math.min(4, wanted + 1) : 0;
    cruisers.forEach((c, i) => {
      c.active = i < wantCruisers;
      c.mesh.visible = c.active;
      if (!c.active) return;
      const dx = S.px - c.x, dz = S.pz - c.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 6) {
        const targetHeading = Math.atan2(-dz, dx);
        let dh = targetHeading - c.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        c.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
        c.speed = Math.min(c.speed + 14 * dt, 24 + wanted * 2);
        c.x += Math.cos(c.heading) * c.speed * dt;
        c.z += -Math.sin(c.heading) * c.speed * dt;
      } else {
        c.speed = Math.max(0, c.speed - 20 * dt);
        // ram: bump the player
        if (!S.inCar && dist < 4) {
          S.health = Math.max(0, S.health - 12 * dt);
        }
      }
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
    });
    // officers chase on foot at high wanted
    const wantOfficers = wanted >= 2 ? Math.min(6, wanted * 2) : 0;
    officers.forEach((o, i) => {
      o.active = i < wantOfficers;
      o.mesh.visible = o.active;
      if (!o.active) return;
      const dx = S.px - o.x, dz = S.pz - o.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 1.5) {
        o.x += (dx / dist) * 5 * dt;
        o.z += (dz / dist) * 5 * dt;
        o.mesh.rotation.y = Math.atan2(-dz, dx);
      } else if (!S.inCar) {
        S.health = Math.max(0, S.health - 8 * dt);
        S.arrests += dt > 0 ? 0 : 0;
      }
      o.mesh.position.set(o.x, 0, o.z);
    });

    // Helicopter: appears at 3+ stars, orbits the player with a bob.
    const heliOn = wanted >= 3 || (S.shotMode && wanted >= 3);
    heli.group.visible = heliOn;
    beam.visible = heliOn;
    pool.visible = heliOn;
    if (heliOn) {
      heliAngle += dt * 0.35;
      bobPhase += dt;
      // Staged shots: park the heli in a fixed hover low enough to be
      // IN the frame with its beam — an orbiting heli drifts out of shot.
      let hx, hz, alt;
      if (S.shotMode) {
        // hover just off Kai's shoulder, LOW enough to be in frame with
        // the beam (a 20 m hover sits above the camera's vertical FOV)
        hx = S.px + 6;
        hz = S.pz - 6;
        alt = 14 + Math.sin(bobPhase * 1.1) * 1.0;
      } else {
        alt = 26 + Math.sin(bobPhase * 1.1) * 1.0; // heli bob
        hx = S.px + Math.cos(heliAngle) * 22;
        hz = S.pz + Math.sin(heliAngle) * 22;
      }
      heli.group.position.set(hx, alt, hz);
      heli.group.rotation.y = Math.atan2(-(S.pz - hz), S.px - hx);
      heli.rotor.rotation.y += dt * 22;
      heli.tailRotor.rotation.z += dt * 30;

      // BEAM: apex = lamp world position, straight down to the ground.
      const lampWorld = new THREE.Vector3();
      heli.lamp.getWorldPosition(lampWorld);
      const groundY = 0.12;
      const beamLen = lampWorld.y - groundY;
      beam.position.copy(lampWorld);
      beam.scale.set(1, beamLen, 1);
      // pool exactly at the beam's ground hit point (directly below lamp)
      pool.position.set(lampWorld.x, groundY, lampWorld.z);
      const pulse = 0.36 + Math.sin(t * 6) * 0.06;
      pool.material.opacity = pulse;
      beamMat.opacity = 0.16 + Math.sin(t * 6) * 0.04;
      spot.position.copy(lampWorld);
      spot.target.position.set(lampWorld.x, 0, lampWorld.z);
      spot.intensity = 900;
      spot.angle = Math.atan2(3.5, beamLen);
    } else {
      spot.intensity = 0;
    }

    // wanted decay when out of sight / evading
    if (wanted > 0 && !S.shotMode) {
      const nearest = cruisers.find((c) => c.active && Math.hypot(c.x - S.px, c.z - S.pz) < 40);
      if (!nearest) {
        S.evading += dt;
        if (S.evading > 12) {
          S.wanted = Math.max(0, S.wanted - 1);
          S.evading = 0;
        }
      } else {
        S.evading = 0;
      }
    }
    if (S.health <= 0 && !S.over) {
      S.over = true;
      S.message = 'BUSTED — press NEW GAME to retry';
      S.messageUntil = S.time + 999;
    }
  }

  return {
    cruisers, officers, heli: heli.group,
    policeCount: () => cruisers.filter((c) => c.active).length + officers.filter((o) => o.active).length + (S.wanted >= 3 ? 1 : 0),
    update,
  };
}
