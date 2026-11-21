// SOLARA — audio.js (fresh build from spec, round 8)
// Tiny WebAudio synth: engine hum, shots, pickups, radio jingles.
// No audio files — everything is generated, and it stays silent until
// the player starts the game (autoplay policy).

import { RADIO } from './config.js';

export function createAudio(S) {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let radioTimer = null;
  let radioNotes = [523, 659, 784, 1046];

  function ensure() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function blip(freq, dur, type = 'sine', vol = 0.15) {
    if (!S.soundOn) return;
    const c = ensure();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  }

  function startEngine() {
    const c = ensure();
    if (!c || engineOsc) return;
    engineOsc = c.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain = c.createGain();
    engineGain.gain.value = 0.0;
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 320;
    engineOsc.connect(filt).connect(engineGain).connect(c.destination);
    engineOsc.start();
  }

  function updateEngine() {
    if (!engineGain) return;
    const target = S.inCar ? 0.05 + Math.min(0.12, Math.abs(S.carSpeed) * 0.003) : 0.0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
    if (engineOsc) engineOsc.frequency.setTargetAtTime(55 + Math.abs(S.carSpeed) * 2.2, ctx.currentTime, 0.1);
  }

  function radioTick() {
    if (!S.radioOn || !S.started || S.paused) return;
    // a little synthwave arpeggio for NEON 101.5, latin-ish for PUERTO
    const base = [523, 659, 784, 1046, 784, 659];
    const note = base[Math.floor(Math.random() * base.length)];
    blip(note, 0.35, S.station === 1 ? 'square' : 'triangle', 0.05);
  }

  return {
    ensure,
    startEngine,
    updateEngine,
    shot() { blip(180, 0.12, 'square', 0.2); },
    pickup() { blip(880, 0.15, 'sine', 0.18); blip(1320, 0.2, 'sine', 0.15); },
    jobDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'triangle', 0.18), i * 120)); },
    fail() { blip(220, 0.4, 'sawtooth', 0.15); },
    startRadio() {
      if (radioTimer) return;
      radioTimer = setInterval(radioTick, 900);
    },
    toggleSound() {
      S.soundOn = !S.soundOn;
      return S.soundOn;
    },
  };
}
