// SOLARA — audio.js
// Tiny WebAudio synth: radio stations as looping note patterns, plus SFX
// (gunshot, siren wail, cash chime, engine hum). No audio files, no network.

import { S, RADIO } from './config.js';

let ctx = null;
let radioTimer = null;
let radioStep = 0;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;

const SCALES = [
  [0, 3, 5, 7, 10, 12, 15],   // PUERTO 88.3 — minor latin
  [0, 2, 3, 7, 8, 12, 14],    // CELESTE 98.1 — synthwave
  [0, 4, 5, 7, 9, 12, 16],    // SOLARA 98.3 — golden major
  [0, 2, 5, 7, 10, 12, 14],   // NEON 101.5 — dorian night drive
];
const ROOTS = [220, 196, 246.9, 174.6];

export function ensureAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0.45;
    master.connect(ctx.destination);
    ctx._master = master;
    startRadio();
    startEngine();
    startSiren();
  } catch (e) { ctx = null; }
}

function note(freq, dur, type, vol, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ctx._master);
  o.start(t); o.stop(t + dur + 0.05);
}

function startRadio() {
  if (radioTimer) return;
  radioTimer = setInterval(() => {
    if (!ctx || !S.radioOn || S.paused) return;
    const scale = SCALES[S.station % SCALES.length];
    const root = ROOTS[S.station % ROOTS.length];
    const deg = scale[radioStep % scale.length];
    const f = root * Math.pow(2, deg / 12);
    note(f, 0.42, S.station === 1 ? 'sawtooth' : 'triangle', 0.05);
    if (radioStep % 4 === 0) note(root / 2, 0.5, 'sine', 0.07);
    if (radioStep % 8 === 6) note(f * 1.5, 0.3, 'square', 0.025);
    radioStep++;
  }, 200);
}

function startEngine() {
  if (!ctx) return;
  engineOsc = ctx.createOscillator();
  engineGain = ctx.createGain();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 58;
  engineGain.gain.value = 0.0;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 320;
  engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(ctx._master);
  engineOsc.start();
}

function startSiren() {
  if (!ctx) return;
  sirenOsc = ctx.createOscillator();
  sirenGain = ctx.createGain();
  sirenOsc.type = 'sine';
  sirenOsc.frequency.value = 700;
  sirenGain.gain.value = 0.0;
  sirenOsc.connect(sirenGain); sirenGain.connect(ctx._master);
  sirenOsc.start();
}

export function audioTick(dt) {
  if (!ctx) return;
  // Engine hum follows speed.
  const target = S.inCar ? 0.02 + Math.min(0.05, Math.abs(S.carSpeed) * 0.0016) : 0.0;
  engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
  if (engineOsc) engineOsc.frequency.setTargetAtTime(55 + Math.abs(S.carSpeed) * 2.2, ctx.currentTime, 0.1);
  // Siren wails while wanted.
  const sirenTarget = S.wanted > 0 && !S.paused ? 0.016 : 0.0;
  sirenGain.gain.setTargetAtTime(sirenTarget, ctx.currentTime, 0.2);
  if (sirenOsc) {
    const w = 700 + Math.sin(S.time * 2.4) * 260;
    sirenOsc.frequency.setTargetAtTime(w, ctx.currentTime, 0.05);
  }
}

export function sfxShot() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const g = ctx.createGain(); g.gain.value = 0.5;
  src.connect(g); g.connect(ctx._master); src.start(t);
  note(180, 0.08, 'square', 0.12);
}

export function sfxHit() { note(880, 0.12, 'square', 0.08); }
export function sfxCash() {
  note(1046, 0.14, 'sine', 0.12);
  note(1318, 0.2, 'sine', 0.12, 0.09);
  note(1568, 0.3, 'sine', 0.1, 0.18);
}
export function sfxFail() { note(220, 0.3, 'sawtooth', 0.08); note(165, 0.4, 'sawtooth', 0.08, 0.15); }
export function sfxClick() { note(1200, 0.05, 'square', 0.05); }
export function sfxDoor() { note(90, 0.18, 'triangle', 0.2); }
export function sfxSirenBlip() { note(950, 0.15, 'sine', 0.1); note(700, 0.15, 'sine', 0.1, 0.15); }
