import { LionSpawner } from './animals/spawner';
import { Sound } from './audio/sound';
import { Camera } from './engine/camera';
import { Input } from './engine/input';
import { startLoop } from './engine/loop';
import { type Game, updateEntities } from './game';
import { Inventory } from './items/items';
import { ItemSpawner } from './items/pickup';
import { Health, eatBerry } from './player/health';
import { Player } from './player/player';
import { render } from './render';
import { SaveManager, chooseStart } from './save/save';
import { drawHealthHud } from './ui/healthHud';
import { drawInventoryHud } from './ui/inventoryHud';
import { DayNight } from './ui/daynight';
import { Minimap } from './ui/minimap';
import { TouchControls } from './ui/touch';
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
// `?time=0.8` starts at another time of day (0 = midnight, 0.5 = noon).
const timeParam = Number(params.get('time'));

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
const touch = new TouchControls(canvas, input, {
  toggleMap: () => (minimap.visible = !minimap.visible),
  eat: () => eat(),
});
const dayNight = new DayNight(params.has('time') && Number.isFinite(timeParam) ? timeParam : undefined);

// Shared state: features add NPCs, items, etc. to `game.entities`.
const sound = new Sound();
const inventory = new Inventory();
saves.register('inventory', inventory, resume);
const health = new Health();
saves.register('health', health, resume);
const game: Game = { world, player, camera, input, entities: [], inventory, saves, resume, sound, health };

// Q eats a berry to restore a heart (E is for talking to NPCs).
function eat(): void {
  if (eatBerry(health, inventory)) sound.play('pickup');
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyQ' && !e.repeat) eat();
});
game.entities.push(new ItemSpawner(inventory)); // coins, berries, mushrooms and gems to collect
game.entities.push(new LionSpawner()); // prides of lions roam the grasslands
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
    const px = player.x;
    const py = player.y;
    if (health.update(dt)) {
      // Woke up from fainting: back to the start with full hearts.
      player.x = (spawn.tx + 0.5) * TILE_SIZE;
      player.y = (spawn.ty + 0.5) * TILE_SIZE;
      camera.follow(player.x, player.y);
    }
    if (health.awake) player.update(dt, input.axis(), world, input.running());
    const tile = world.getTile(Math.floor(player.x / TILE_SIZE), Math.floor(player.y / TILE_SIZE));
    sound.update(Math.hypot(player.x - px, player.y - py), tile, input.running());
    updateEntities(game, dt);
    dayNight.update(dt);
    camera.follow(player.x, player.y, 0.15);
  },
  () => {
    render(ctx, world, camera, player, game.entities);
    dayNight.draw(ctx, camera, player.x, player.y);
    minimap.draw(ctx, world, player.x, player.y);
    drawInventoryHud(ctx, inventory, canvas.height);
    drawHealthHud(ctx, health, canvas.width, canvas.height);
    touch.draw(ctx);
    const tx = Math.floor(player.x / TILE_SIZE);
    const ty = Math.floor(player.y / TILE_SIZE);
    hud.textContent = `${dayNight.clock} ${dayNight.phase} · seed ${seed} · tile ${tx},${ty} · chunks ${world.loadedChunks} · WASD/arrows to move, Shift to run, M for map, Q to eat a berry, V for sound${sound.muted ? ' (muted)' : ''}`;
  },
);
