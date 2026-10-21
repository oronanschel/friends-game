// Keyboard state. Use isDown('KeyW') etc., or the axis() helper for movement.
const down = new Set();

window.addEventListener('keydown', (e) => {
  down.add(e.code);
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => down.delete(e.code));
window.addEventListener('blur', () => down.clear());

export function isDown(code) {
  return down.has(code);
}

// Returns a normalized movement vector from WASD / arrow keys.
export function axis() {
  let x = 0;
  let y = 0;
  if (isDown('KeyA') || isDown('ArrowLeft')) x -= 1;
  if (isDown('KeyD') || isDown('ArrowRight')) x += 1;
  if (isDown('KeyW') || isDown('ArrowUp')) y -= 1;
  if (isDown('KeyS') || isDown('ArrowDown')) y += 1;
  if (x && y) {
    x *= Math.SQRT1_2;
    y *= Math.SQRT1_2;
  }
  return { x, y };
}
