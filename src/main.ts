import { Camera } from './engine/camera';
import { Input } from './engine/input';
import { startLoop } from './engine/loop';
import { type Game, updateEntities } from './game';
import { Player } from './player/player';
import { render } from './render';
import { DayNight } from './ui/daynight';
import { Minimap } from './ui/minimap';
import { TILE_SIZE, World } from './world/world';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const hud = document.getElementById('hud')!;

// `?seed=123` in the URL picks a specific world.
const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const seed = seedParam !== null ? Number(seedParam) | 0 : 1337;
// `?time=0.8` starts at another time of day (0 = midnight, 0.5 = noon).
const timeParam = Number(params.get('time'));

const world = new World(seed);
const spawn = world.findWalkableNear(0, 0);
const player = new Player((spawn.tx + 0.5) * TILE_SIZE, (spawn.ty + 0.5) * TILE_SIZE);
const camera = new Camera(window.innerWidth, window.innerHeight);
camera.follow(player.x, player.y);
const input = new Input();
const minimap = new Minimap();
const dayNight = new DayNight(params.has('time') && Number.isFinite(timeParam) ? timeParam : undefined);

// Shared state: features add NPCs, items, etc. to `game.entities`.
const game: Game = { world, player, camera, input, entities: [] };
(window as unknown as { game: Game }).game = game; // handy in the browser console

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
    player.update(dt, input.axis(), world, input.running());
    updateEntities(game, dt);
    dayNight.update(dt);
    camera.follow(player.x, player.y, 0.15);
  },
  () => {
    render(ctx, world, camera, player, game.entities);
    dayNight.draw(ctx, camera, player.x, player.y);
    minimap.draw(ctx, world, player.x, player.y);
    const tx = Math.floor(player.x / TILE_SIZE);
    const ty = Math.floor(player.y / TILE_SIZE);
    hud.textContent = `${dayNight.clock} ${dayNight.phase} · seed ${seed} · tile ${tx},${ty} · chunks ${world.loadedChunks} · WASD/arrows to move, Shift to run, M for map`;
  },
);
