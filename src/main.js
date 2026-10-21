import { World } from './world.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { drawWorld, drawHud } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const world = new World(1);
const player = new Player(16, 16);
const camera = new Camera();

// Exposed for debugging and for teammates' modules during early development.
window.game = { world, player, camera };

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  camera.resize(canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();
camera.snapTo(player);

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  player.update(dt, world);
  camera.follow(player, dt);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(1, 0, 0, 1, -Math.round(camera.x), -Math.round(camera.y));
  drawWorld(ctx, world, camera);
  player.draw(ctx);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawHud(ctx, player);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
