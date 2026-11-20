// SOLARA — input.js
// One place for all keyboard + mouse state, so every system reads the same
// source of truth instead of attaching its own listeners.

export const keys = Object.create(null); // e.code -> held?
export const pressed = Object.create(null); // e.code -> true for one frame
export const mouse = { x: 0, y: 0, down: false, dx: 0, dy: 0, clicked: false };

let dragFrom = null;

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    pressed[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
    for (const k of Object.keys(pressed)) pressed[k] = false;
    mouse.down = false;
    mouse.clicked = false;
    dragFrom = null;
  });

  canvas.addEventListener('pointerdown', (e) => {
    mouse.down = true;
    mouse.clicked = true;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    dragFrom = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragFrom) {
      mouse.dx += e.clientX - dragFrom.x;
      mouse.dy += e.clientY - dragFrom.y;
      dragFrom = { x: e.clientX, y: e.clientY };
    }
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  const release = () => { mouse.down = false; dragFrom = null; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Call once per frame, after every system has read the input: one-shot
// flags (pressed keys, click, drag deltas) expire so they fire exactly once.
export function endFrameInput() {
  for (const k of Object.keys(pressed)) pressed[k] = false;
  mouse.dx = 0;
  mouse.dy = 0;
  mouse.clicked = false;
}

export function anyPressed(...codes) {
  return codes.some((c) => pressed[c]);
}
