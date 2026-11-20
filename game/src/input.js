// SOLARA — input.js
// Keyboard + mouse state, tracked centrally so every system reads one source.

export const keys = Object.create(null);   // e.code -> boolean
export const pressed = Object.create(null); // e.code -> true for one frame only
export const mouse = { x: 0, y: 0, down: false, dx: 0, dy: 0, clicked: false };

let dragLast = null;

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
  });

  canvas.addEventListener('pointerdown', (e) => {
    mouse.down = true;
    mouse.clicked = true;
    mouse.x = e.clientX; mouse.y = e.clientY;
    dragLast = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragLast) {
      mouse.dx += e.clientX - dragLast.x;
      mouse.dy += e.clientY - dragLast.y;
      dragLast = { x: e.clientX, y: e.clientY };
    }
    mouse.x = e.clientX; mouse.y = e.clientY;
  });
  const endDrag = () => { mouse.down = false; dragLast = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Call at the end of every frame: one-shot flags expire.
export function endFrameInput() {
  for (const k of Object.keys(pressed)) pressed[k] = false;
  mouse.dx = 0; mouse.dy = 0; mouse.clicked = false;
}

export function anyPressed(...codes) {
  return codes.some((c) => pressed[c]);
}
