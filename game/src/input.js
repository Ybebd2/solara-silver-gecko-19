// SOLARA — input.js (fresh build from spec, round 8)
// Keyboard + mouse-drag orbit camera state. No DOM game logic here.

export function createInput() {
  const keys = {};
  const input = {
    keys,
    // mouse orbit
    dragX: 0,
    dragY: 0,
    dragging: false,
    camYaw: Math.PI * 0.75,
    camPitch: 0.32,
    // edge-triggered presses consumed by main loop
    pressed: {},
    mouseDX: 0,
    mouseDY: 0,
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    input.pressed[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
  });

  const canvasHolder = document.body;
  canvasHolder.addEventListener('mousedown', (e) => {
    if (e.target && e.target.closest && e.target.closest('button')) return;
    input.dragging = true;
    input.dragX = e.clientX;
    input.dragY = e.clientY;
  });
  window.addEventListener('mousemove', (e) => {
    if (!input.dragging) return;
    input.mouseDX += e.clientX - input.dragX;
    input.mouseDY += e.clientY - input.dragY;
    input.dragX = e.clientX;
    input.dragY = e.clientY;
  });
  window.addEventListener('mouseup', () => { input.dragging = false; });

  // Apply accumulated mouse drag to the orbit angles.
  input.consumeMouse = () => {
    input.camYaw -= input.mouseDX * 0.005;
    input.camPitch += input.mouseDY * 0.003;
    input.camPitch = Math.max(0.05, Math.min(1.2, input.camPitch));
    input.mouseDX = 0;
    input.mouseDY = 0;
  };

  // True once on the frame the key went down.
  input.wasPressed = (code) => {
    if (input.pressed[code]) { input.pressed[code] = false; return true; }
    return false;
  };
  input.clearPressed = () => { input.pressed = {}; };

  return input;
}
