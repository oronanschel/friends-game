import { World, TILE_SIZE } from './world.js';
import { Camera } from './camera.js';
import { Player } from './player.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');

const world = new World(1337);
const player = new Player(world.spawn.x, world.spawn.y);
const camera = new Camera(window.innerWidth, window.innerHeight);

// Other features (NPCs, items, ...) can push objects with update(dt, game) / draw(ctx, camera).
const entities = [];
export const game = { world, player, camera, entities };
window.game = game; // handy for debugging in the console

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  camera.resize(canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  player.update(dt, world);
  for (const e of entities) e.update?.(dt, game);
  camera.follow(player, world.width * TILE_SIZE, world.height * TILE_SIZE);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  world.draw(ctx, camera);
  // Draw entities and player sorted by y for simple depth.
  const drawables = [...entities, player].sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw?.(ctx, camera);

  const tx = Math.floor(player.x / TILE_SIZE);
  const ty = Math.floor(player.y / TILE_SIZE);
  hud.textContent = `WASD/arrows to move, Shift to run · tile ${tx},${ty}`;

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
