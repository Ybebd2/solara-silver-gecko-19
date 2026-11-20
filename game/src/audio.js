// SOLARA — audio.js
// Tiny WebAudio synth: clicks, cash chimes, engine hum, radio blips.
// Everything is guarded so the game never crashes when AudioContext is
// missing (headless, autoplay-blocked, or plain unavailable).

import { S } from './config.js';

let ctx = null;
let master = null;
let engineOsc = null;
let engineGain = null;
let lastRadioBlip = 0;

function buildCtx() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.45;
    master.connect(ctx.destination);
    // low engine drone that follows driving speed
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 58;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    engineOsc.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  } catch (e) {
    ctx = null;
  }
  return ctx;
}

export function ensureAudio() {
  const c = buildCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

function blip(freq, dur, type, vol) {
  if (!S.soundOn) return;
  const c = buildCtx();
  if (!c || !master) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.12, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(c.currentTime + dur);
  } catch (e) { /* audio is cosmetic, never fatal */ }
}

export function sfxClick() {
  blip(660, 0.06, 'square', 0.1);
}

export function sfxCash() {
  blip(880, 0.09, 'sine', 0.14);
  setTimeout(() => blip(1320, 0.12, 'sine', 0.12), 70);
}

export function audioTick(dt) {
  const c = buildCtx();
  if (!c || !engineOsc || !engineGain) return;
  try {
    if (!S.soundOn || !S.started) {
      engineGain.gain.value = 0;
      return;
    }
    const speed = Math.abs(S.carSpeed || 0);
    const target = S.inCar ? Math.min(0.09, 0.02 + speed * 0.002) : 0.0;
    engineGain.gain.value += (target - engineGain.gain.value) * Math.min(1, dt * 6);
    engineOsc.frequency.value = 58 + speed * 1.6;
    // radio station blip every 200 ms while driving with the radio on
    if (S.inCar && S.radioOn && S.time - lastRadioBlip > 0.2) {
      lastRadioBlip = S.time;
      blip(440 + S.station * 110, 0.05, 'triangle', 0.03);
    }
  } catch (e) { /* ignore */ }
}
