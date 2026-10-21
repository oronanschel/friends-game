import { Camera } from './engine/camera';
import { Input } from './engine/input';
import { startLoop } from './engine/loop';
import { Player } from './player/player';
import { render } from './render';
import { TILE_SIZE, World } from './world/world';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const hud = document.getElementById('hud')!;

// `?seed=123` in the URL picks a specific world.
const seedParam = new URLSearchParams(location.search).get('seed');
const seed = seedParam !== null ? Number(seedParam) | 0 : 1337;

const world = new World(seed);
const spawn = world.findWalkableNear(0, 0);
const player = new Player((spawn.tx + 0.5) * TILE_SIZE, (spawn.ty + 0.5) * TILE_SIZE);
const camera = new Camera(window.innerWidth, window.innerHeight);
camera.follow(player.x, player.y);
const input = new Input();

function resize(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  camera.width = canvas.width;
  camera.height = canvas.height;
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();

startLoop(
  (dt) => {
    player.update(dt, input.axis(), world);
    camera.follow(player.x, player.y, 0.15);
  },
  () => {
    render(ctx, world, camera, player);
    const tx = Math.floor(player.x / TILE_SIZE);
    const ty = Math.floor(player.y / TILE_SIZE);
    hud.textContent = `seed ${seed} · tile ${tx},${ty} · chunks ${world.loadedChunks} · WASD/arrows to move`;
  },
);
