// Keyboard and mouse: arrows (or WASD) fly the Kestrel, Shift/Ctrl work the
// throttle, the mouse steers gently when held, P pauses, R restarts.
export function createInput() {
  return {
    keys: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseSteer: false,
    pressed: new Set(), // keys pressed since last read, for one-shot actions
  };
}

export function attachInput(input, element) {
  const down = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    input.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    input.pressed.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  };
  const up = (e) => {
    input.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  };
  const move = (e) => {
    const rect = element.getBoundingClientRect();
    input.mouseX = (e.clientX - rect.left) / rect.width - 0.5;
    input.mouseY = (e.clientY - rect.top) / rect.height - 0.5;
  };
  element.addEventListener('keydown', down);
  element.addEventListener('keyup', up);
  element.addEventListener('mousemove', move);
  element.addEventListener('mousedown', () => {
    input.mouseSteer = true;
  });
  element.addEventListener('mouseup', () => {
    input.mouseSteer = false;
  });
  element.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseSteer = false;
  });
  return () => {
    element.removeEventListener('keydown', down);
    element.removeEventListener('keyup', up);
    element.removeEventListener('mousemove', move);
  };
}

/** True once for a key pressed since the last call. */
export function wasPressed(input, key) {
  if (input.pressed.has(key)) {
    input.pressed.delete(key);
    return true;
  }
  return false;
}

/** Stick position from the current keys and mouse, each in [-1, 1]. */
export function readStick(input) {
  const k = input.keys;
  let pitch = 0;
  let roll = 0;
  if (k.has('ArrowUp') || k.has('w')) pitch += 1; // pull up: nose up
  if (k.has('ArrowDown') || k.has('s')) pitch -= 1;
  if (k.has('ArrowLeft') || k.has('a')) roll -= 1;
  if (k.has('ArrowRight') || k.has('d')) roll += 1;
  if (input.mouseSteer) {
    pitch -= input.mouseY * 1.4;
    roll += input.mouseX * 1.6;
  }
  let throttleDelta = 0;
  if (k.has('Shift')) throttleDelta += 1;
  if (k.has('Control')) throttleDelta -= 1;
  if (k.has('PageUp')) throttleDelta += 1;
  if (k.has('PageDown')) throttleDelta -= 1;
  return {
    pitch: Math.max(-1, Math.min(1, pitch)),
    roll: Math.max(-1, Math.min(1, roll)),
    throttleDelta,
  };
}
