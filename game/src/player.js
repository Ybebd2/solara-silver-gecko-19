// SOLARA — player.js
// Kai Mercer on foot: walk / sprint, camera-relative turning, shooting the
// VESPER (and other weapons), muzzle flash, hit feedback.

import * as THREE from '../vendor/three/three.module.js';
import { S, WEAPONS, clamp } from './config.js';
import { resolveCollisions } from './world.js';
import { keys } from './input.js';
import { sfxShot, sfxHit } from './audio.js';

let sceneRef = null;
let kai = null;        // group
let legL = null, legR = null, armR = null;
let muzzle = null;
let walkPhase = 0;
let fireCooldown = 0;
let reloadTimer = 0;

export const shootTargets = []; // {mesh, kind, hp, onHit} — police officers, range targets

export function buildPlayer(scene) {
  sceneRef = scene;
  kai = new THREE.Group();

  const skin = new THREE.MeshLambertMaterial({ color: 0xc98e6a });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2b4a6f });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2e3a4a });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1210 });

  // torso (open jacket, golden-hour blue)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), jacket);
  torso.position.y = 1.18;
  kai.add(torso);
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.36), new THREE.MeshLambertMaterial({ color: 0xf2e6c9 }));
  shirt.position.y = 1.18;
  kai.add(shirt);
  // head + hair
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), skin);
  head.position.y = 1.72;
  kai.add(head);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  hairM.position.y = 1.76;
  kai.add(hairM);
  // arms
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.16), jacket);
  armL.position.set(-0.4, 1.2, 0);
  kai.add(armL);
  armR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.16), jacket);
  armR.position.set(0.4, 1.2, 0);
  kai.add(armR);
  // legs (animated while walking)
  legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.2), jeans);
  legL.geometry.translate(0, -0.36, 0);
  legL.position.set(-0.16, 0.78, 0);
  kai.add(legL);
  legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.2), jeans);
  legR.geometry.translate(0, -0.36, 0);
  legR.position.set(0.16, 0.78, 0);
  kai.add(legR);
  // shoes
  for (const sx of [-0.16, 0.16]) {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.36), new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }));
    shoe.position.set(sx, 0.05, 0.05);
    kai.add(shoe);
  }
  // VESPER pistol in the right hand
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.3), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  gun.position.set(0.4, 0.95, 0.22);
  kai.add(gun);
  muzzle = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0 })
  );
  muzzle.position.set(0.4, 0.95, 0.45);
  kai.add(muzzle);

  kai.position.set(S.px, 0, S.pz);
  scene.add(kai);
  return kai;
}

export function playerTick(dt, camera) {
  if (!kai) return;
  fireCooldown = Math.max(0, fireCooldown - dt);
  if (reloadTimer > 0) {
    reloadTimer -= dt;
    if (reloadTimer <= 0) {
      const w = WEAPONS[S.weaponIdx];
      const need = w.mag - S.ammo;
      const take = Math.min(need, S.reserve);
      S.ammo += take; S.reserve -= take;
    }
  }

  if (S.inCar) { kai.visible = false; return; }
  kai.visible = true;

  const w = WEAPONS[S.weaponIdx];
  // --- movement: A/D turn, W/S forward/back, Shift sprint ---
  const turn = (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) - (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0);
  S.heading += turn * 2.4 * dt;
  const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
  const speed = sprint ? 9.5 : 6.0;
  let move = 0;
  if (keys['KeyW'] || keys['ArrowUp']) move += 1;
  if (keys['KeyS'] || keys['ArrowDown']) move -= 0.55;
  const vx = Math.sin(S.heading) * speed * move;
  const vz = Math.cos(S.heading) * speed * move;
  const p = resolveCollisions(S.px + vx * dt, S.pz + vz * dt, 0.6);
  const moved = Math.hypot(p.x - S.px, p.z - S.pz);
  S.px = p.x; S.pz = p.z;
  S.speed = moved / Math.max(dt, 0.001);

  // walk-cycle animation (legs swing, slight bob) — smooth, no vibration
  if (moved > 0.001) {
    walkPhase += dt * (sprint ? 13 : 9);
    const sw = Math.sin(walkPhase) * 0.55;
    legL.rotation.x = sw; legR.rotation.x = -sw;
    kai.position.y = Math.abs(Math.sin(walkPhase)) * 0.05;
    armR.rotation.x = -0.5;
  } else {
    legL.rotation.x *= 0.8; legR.rotation.x *= 0.8;
    kai.position.y *= 0.8;
    armR.rotation.x *= 0.8;
  }

  kai.position.set(S.px, kai.position.y, S.pz);
  kai.rotation.y = S.heading;
  if (muzzle) muzzle.material.opacity = Math.max(0, muzzle.material.opacity - dt * 9);
}

export function tryFire(camera, raycaster) {
  const w = WEAPONS[S.weaponIdx];
  if (fireCooldown > 0 || reloadTimer > 0) return false;
  if (w.kind === 'melee') {
    fireCooldown = w.rate;
    return true;
  }
  if (S.ammo <= 0) {
    // auto-reload when the mag is dry
    if (S.reserve > 0) reloadTimer = 1.1;
    return false;
  }
  fireCooldown = w.rate;
  S.ammo--;
  S.shotsFired++;
  sfxShot();
  if (muzzle) muzzle.material.opacity = 1;

  // hitscan from the camera centre
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  raycaster.far = w.range;
  const meshes = shootTargets.map((t) => t.mesh);
  const hits = raycaster.intersectObjects(meshes, true);
  if (hits.length > 0) {
    let obj = hits[0].object;
    while (obj && !obj.userData.targetRef) obj = obj.parent;
    if (obj && obj.userData.targetRef) {
      const t = obj.userData.targetRef;
      t.hp -= w.damage;
      S.hits++;
      sfxHit();
      if (t.onHit) t.onHit(t);
    }
  }
  if (S.ammo === 0 && S.reserve > 0) reloadTimer = 1.1;
  return true;
}

export function reloadWeapon() {
  const w = WEAPONS[S.weaponIdx];
  if (reloadTimer > 0 || S.ammo >= w.mag || S.reserve <= 0) return;
  reloadTimer = 1.1;
}

export function addShootTarget(mesh, kind, hp, onHit) {
  const t = { mesh, kind, hp, onHit };
  mesh.userData.targetRef = t;
  mesh.traverse((o) => { o.userData.targetRef = t; });
  shootTargets.push(t);
  return t;
}

export function removeShootTarget(t) {
  const i = shootTargets.indexOf(t);
  if (i >= 0) shootTargets.splice(i, 1);
  if (t.mesh.parent) t.mesh.parent.remove(t.mesh);
}
