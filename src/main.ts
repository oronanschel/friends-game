import { Camera } from './engine/camera';
import { Input } from './engine/input';
import { startLoop } from './engine/loop';
import { type Game, updateEntities } from './game';
import { Player } from './player/player';
import { render } from './render';
import { SaveManager, chooseStart } from './save/save';
import { Minimap } from './ui/minimap';
import { TILE_SIZE, World } from './world/world';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const hud = document.getElementById('hud')!;

// Continue the saved game; `?seed=123` opens a specific world, `?new` a fresh random one.
const saves = new SaveManager(window.localStorage);
const params = new URLSearchParams(location.search);
const { seed, resume } = chooseStart(params, saves.load(), 1337);
if (params.has('new')) {
  // Swap `?new` for the chosen seed so reloading keeps this world.
  params.delete('new');
  params.set('seed', String(seed));
  history.replaceState(null, '', `?${params}`);
}

const world = new World(seed);
const spawn = world.findWalkableNear(0, 0);
const player = new Player((spawn.tx + 0.5) * TILE_SIZE, (spawn.ty + 0.5) * TILE_SIZE);
if (resume && !player.collides(resume.player.x, resume.player.y, world)) {
  player.x = resume.player.x;
  player.y = resume.player.y;
}
const camera = new Camera(window.innerWidth, window.innerHeight);
camera.follow(player.x, player.y);
const input = new Input();
const minimap = new Minimap();

// Shared state: features add NPCs, items, etc. to `game.entities`.
const game: Game = { world, player, camera, input, entities: [], saves, resume };
(window as unknown as { game: Game }).game = game; // handy in the browser console

// Auto-save every few seconds and when the tab is hidden or closed.
// Features persist their own state with `saves.register(key, { save, load }, resume)`.
const saveNow = () => saves.save(seed, player);
setInterval(saveNow, 5000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveNow();
});
window.addEventListener('pagehide', saveNow);

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
    camera.follow(player.x, player.y, 0.15);
  },
  () => {
    render(ctx, world, camera, player, game.entities);
    minimap.draw(ctx, world, player.x, player.y);
    const tx = Math.floor(player.x / TILE_SIZE);
    const ty = Math.floor(player.y / TILE_SIZE);
    hud.textContent = `seed ${seed} · tile ${tx},${ty} · chunks ${world.loadedChunks} · WASD/arrows to move, Shift to run, M for map`;
  },
);
