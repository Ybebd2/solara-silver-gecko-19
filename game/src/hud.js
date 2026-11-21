// SOLARA — hud.js (fresh build from spec, round 8)
// Cash, rank, mission panel, wanted stars, health/armour, ammo,
// minimap canvas, message line, two-way dialogue box.

import { RADIO, WEAPONS, DISTRICTS } from './config.js';

export function createHud(S, missions, world) {
  const el = (id) => document.getElementById(id);
  const minimap = el('minimap');
  const mctx = minimap ? minimap.getContext('2d') : null;

  let dialogue = { speaker: '', line: '', reply: '', until: 0 };

  function showDialogue(speaker, line, reply, dur = 8) {
    dialogue = { speaker, line, reply, until: S.time + dur };
    S.dialogueUntil = S.time + dur;
  }

  function drawMinimap() {
    if (!mctx) return;
    const W = minimap.width, H = minimap.height;
    const toMap = (x, z) => [(x + 320) / 640 * W, (z + 320) / 640 * H];
    mctx.clearRect(0, 0, W, H);
    mctx.fillStyle = '#0b1c2c';
    mctx.fillRect(0, 0, W, H);
    // ocean + beach
    mctx.fillStyle = '#1ec8d8';
    mctx.fillRect(0, 0, 18, H);
    mctx.fillStyle = '#f2e3b3';
    mctx.fillRect(18, 0, 10, H);
    // roads
    mctx.strokeStyle = '#3a3f47';
    mctx.lineWidth = 4;
    for (let k = -4; k <= 4; k++) {
      const c = k * 64;
      const [x] = toMap(c, 0);
      const [, y] = toMap(0, c);
      mctx.beginPath(); mctx.moveTo(x, 0); mctx.lineTo(x, H); mctx.stroke();
      mctx.beginPath(); mctx.moveTo(0, y); mctx.lineTo(W, y); mctx.stroke();
    }
    // districts
    for (const d of DISTRICTS) {
      const [x, y] = toMap(d.x, d.z);
      mctx.fillStyle = d.color;
      mctx.globalAlpha = 0.35;
      mctx.beginPath(); mctx.arc(x, y, d.r / 640 * W, 0, Math.PI * 2); mctx.fill();
      mctx.globalAlpha = 1;
    }
    // geckos (gold dots)
    if (world && world.geckos) {
      mctx.fillStyle = '#ffd700';
      for (const g of world.geckos) {
        if (g.userData.taken) continue;
        const [x, y] = toMap(g.position.x, g.position.z);
        mctx.beginPath(); mctx.arc(x, y, 2.5, 0, Math.PI * 2); mctx.fill();
      }
    }
    // mission target beacon
    const m = missions.current();
    if (m) {
      const tgt = S.missionActive && m.type === 'finale' && S.missionStage === 1 ? [-192, -192] : m.target;
      const [x, y] = toMap(tgt[0], tgt[1]);
      mctx.fillStyle = '#ffea00';
      mctx.beginPath(); mctx.arc(x, y, 5, 0, Math.PI * 2); mctx.fill();
      mctx.strokeStyle = '#ffea00';
      mctx.lineWidth = 2;
      mctx.beginPath(); mctx.arc(x, y, 8 + Math.sin(S.time * 4) * 2, 0, Math.PI * 2); mctx.stroke();
    }
    // player arrow
    const [px, py] = toMap(S.px, S.pz);
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(-S.heading);
    mctx.fillStyle = '#00e5ff';
    mctx.beginPath();
    mctx.moveTo(7, 0); mctx.lineTo(-5, -5); mctx.lineTo(-5, 5); mctx.closePath();
    mctx.fill();
    mctx.restore();
  }

  function update() {
    const m = missions.current();
    const set = (id, v) => { const n = el(id); if (n) n.textContent = v; };
    set('hud-cash', '$' + S.cash);
    set('hud-rank', S.rank);
    set('hud-health', Math.round(S.health));
    set('hud-armour', Math.round(S.armour));
    set('hud-ammo', WEAPONS[S.weaponIdx].mag === Infinity ? '∞' : S.ammo + ' / ' + S.reserve);
    set('hud-weapon', WEAPONS[S.weaponIdx].name);
    set('hud-radio', S.radioOn ? RADIO[S.station].name + ' — ' + RADIO[S.station].style : 'RADIO OFF');
    set('hud-wanted', '★'.repeat(S.wanted) + '☆'.repeat(Math.max(0, 5 - S.wanted)));
    const d = missions.distToTarget();
    const geckosLeft = world && world.geckos ? world.geckos.filter((g) => !g.userData.taken).length : 20;
    set('hud-geckos', '🦎 ' + (20 - geckosLeft) + '/20');
    if (m) {
      set('hud-mission-title', (S.missionActive ? '▶ ' : '○ ') + m.name);
      set('hud-mission-info', S.missionActive
        ? 'DIST ' + Math.round(d) + 'm   TIME ' + Math.max(0, Math.ceil(S.missionTime)) + 's' +
          (m.type === 'hold' || (m.type === 'finale' && S.missionStage === 0) ? '   HOLD ' + S.missionHold.toFixed(1) + '/5s' : '')
        : m.brief + ' — press E at the yellow marker');
    }
    const hp = el('hud-hp-bar');
    if (hp) hp.style.width = Math.max(0, S.health) + '%';
    const ap = el('hud-ap-bar');
    if (ap) ap.style.width = Math.max(0, S.armour) + '%';
    const msg = el('hud-message');
    if (msg) {
      msg.textContent = S.time < S.messageUntil ? S.message : '';
      msg.style.opacity = S.time < S.messageUntil ? '1' : '0';
    }
    const dlg = el('dialogue');
    if (dlg) {
      const show = S.time < S.dialogueUntil && m;
      dlg.style.display = show ? 'block' : 'none';
      if (show) {
        const sp = el('dlg-speaker');
        const ln = el('dlg-line');
        const rp = el('dlg-reply');
        if (sp) sp.textContent = m.giver;
        if (ln) ln.textContent = m.dialogue;
        if (rp) rp.textContent = m.reply;
      }
    }
    const district = el('hud-district');
    if (district) {
      // nearest district name
      let best = DISTRICTS[2], bestD = Infinity;
      for (const dd of DISTRICTS) {
        const dist = Math.hypot(dd.x - S.px, dd.z - S.pz);
        if (dist < bestD) { best = dd; bestD = dist; }
      }
      district.textContent = best.name;
      district.style.color = best.color;
    }
    drawMinimap();
  }

  return { update, showDialogue };
}
