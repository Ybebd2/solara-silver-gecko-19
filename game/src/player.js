// SOLARA — player.js
// Kai Mercer, the visible third-person character: bright shirt, silver
// VESPER pistol at his hip, walk/sprint with building collision, and firing
// with the muzzle flash AT the gun tip (z 0.72 — never inside the barrel).

import * as THREE from 'three';
import { S, WEAPONS } from './config.js';
import { keys } from './input.js';
import { solidAt } from './world.js';

export let playerGroup = null;
let flashMesh = null;
let tracer = null;
let flashUntil = 0;
let lastShot = -99;
let walkPhase = 0;

export function buildPlayer(scene) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0x22d3ee });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98e6a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.3), shirt);
  torso.position.y = 1.1;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skin);
  head.position.y = 1.62;
  g.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshLambertMaterial({ color: 0x2a1a0a })
  );
  hair.position.y = 1.66;
  g.add(hair);
  // arms
  for (const sx of [-0.34, 0.34]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.14), shirt);
    arm.position.set(sx, 1.1, 0.05);
    g.add(arm);
  }
  // legs
  for (const sx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.62, 0.17), new THREE.MeshLambertMaterial({ color: 0x2e3a4a }));
    leg.position.set(sx, 0.35, 0);
    leg.name = sx < 0 ? 'legL' : 'legR';
    g.add(leg);
  }
  // silver VESPER pistol, holstered bright at his right hip — visible in
  // profile shots so the weapon reads without a close-up.
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.14, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xd7dde3, emissive: 0x555555 })
  );
  gun.position.set(0.32, 0.95, 0.12);
  gun.name = 'vesper';
  g.add(gun);
  // blob shadow so Kai reads grounded in daylight
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 14),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  g.add(blob);

  g.position.set(S.px, 0, S.pz);
  scene.add(g);
  playerGroup = g;

  // muzzle flash: a small bright star at the gun tip, hidden until fired
  flashMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff2a0 })
  );
  flashMesh.visible = false;
  scene.add(flashMesh);
  // tracer line from the gun to the hit point
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
  tracer.visible = false;
  scene.add(tracer);
}

export function playerTick(dt, camera) {
  if (!playerGroup) return;
  const sprint = keys.ShiftLeft || keys.ShiftRight;
  const speed = sprint ? 10 : 6.4;
  const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const turn = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
  S.heading += turn * 2.4 * dt;
  if (fwd !== 0) {
    const nx = S.px + Math.sin(S.heading) * fwd * speed * dt;
    const nz = S.pz + Math.cos(S.heading) * fwd * speed * dt;
    // slide along walls: try x and z separately so a wall never traps Kai
    if (!solidAt(nx, S.pz)) S.px = nx;
    if (!solidAt(S.px, nz)) S.pz = nz;
    S.px = Math.max(-315, Math.min(315, S.px));
    S.pz = Math.max(-315, Math.min(315, S.pz));
    walkPhase += dt * speed * 1.6;
  }
  playerGroup.position.set(S.px, 0, S.pz);
  playerGroup.rotation.y = S.heading;
  // walk cycle: legs swing, body bobs a touch
  const swing = fwd !== 0 ? Math.sin(walkPhase) * 0.5 : 0;
  const legL = playerGroup.getObjectByName('legL');
  const legR = playerGroup.getObjectByName('legR');
  if (legL) legL.rotation.x = swing;
  if (legR) legR.rotation.x = -swing;
  playerGroup.position.y = fwd !== 0 ? Math.abs(Math.sin(walkPhase)) * 0.04 : 0;
  // muzzle flash expires fast
  if (flashMesh && S.time > flashUntil) {
    flashMesh.visible = false;
    tracer.visible = false;
  }
}

export function tryFire(camera, raycaster) {
  const w = WEAPONS[S.weaponIdx];
  if (w.kind === 'melee') {
    // fists: a short swing, no ammo
    if (S.time - lastShot < w.rate) return;
    lastShot = S.time;
    return;
  }
  if (S.ammo <= 0) {
    if (S.time - lastShot > 0.5) { lastShot = S.time; }
    return;
  }
  if (S.time - lastShot < w.rate) return;
  lastShot = S.time;
  S.ammo -= 1;

  // raycast from the camera centre to find the hit point. Never let the
  // ray stop on Kai himself, the muzzle flash, or the tracer line — those
  // sit right in front of the camera and would eat the shot.
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const hit = raycaster.intersectObjects(camera.parent ? camera.parent.children : [], true);
  let hitPoint = null;
  for (const h of hit) {
    if (h.object === flashMesh || h.object === tracer) continue;
    if (h.object === playerGroup || playerGroup.children.includes(h.object)) continue;
    if (h.distance <= w.range) { hitPoint = h.point; break; }
  }
  if (!hitPoint) {
    hitPoint = raycaster.ray.at(w.range, new THREE.Vector3());
  }

  // muzzle flash AT the gun tip: local (0.32, 1.25, 0.72) on Kai — the gun
  // front tip is 0.69, so 0.72 puts the flash just past the muzzle.
  const tipLocal = new THREE.Vector3(0.32, 1.25, 0.72);
  const tipWorld = playerGroup.localToWorld(tipLocal.clone());
  flashMesh.position.copy(tipWorld);
  flashMesh.visible = true;
  flashUntil = S.time + 0.06;
  const pos = tracer.geometry.attributes.position;
  pos.setXYZ(0, tipWorld.x, tipWorld.y, tipWorld.z);
  pos.setXYZ(1, hitPoint.x, hitPoint.y, hitPoint.z);
  pos.needsUpdate = true;
  tracer.visible = true;
}

export function reloadWeapon() {
  const w = WEAPONS[S.weaponIdx];
  if (w.kind === 'melee') return;
  const need = w.mag - S.ammo;
  if (need <= 0 || S.reserve <= 0) return;
  const take = Math.min(need, S.reserve);
  S.ammo += take;
  S.reserve -= take;
}
