import type { Camera } from '../engine/camera';
import type { Entity, Game } from '../game';
import { hash2 } from '../world/noise';
import { CHUNK_SIZE, TILE_SIZE, type World } from '../world/world';
import { Npc } from './npc';
import { LUIGI, MARIO, type NpcDef } from './villagers';

/** Fraction of chunks where a Mario and Luigi pair hangs out. */
export const PAIR_CHANCE = 0.55;
/** Seconds between hops, and how long one hop lasts. */
export const HOP_EVERY = 3.2;
export const HOP_TIME = 0.45;
const HOP_HEIGHT = 10;
const SPAWN_RADIUS = 1;
const DESPAWN_RADIUS = 2;
const SALT = 0x3a210;

/** Height of a hop `t` seconds into the cycle: 0 most of the time, a quick jump every few seconds. */
export function hopHeight(t: number): number {
  const phase = ((t % HOP_EVERY) + HOP_EVERY) % HOP_EVERY;
  if (phase > HOP_TIME) return 0;
  return Math.sin((phase / HOP_TIME) * Math.PI) * HOP_HEIGHT;
}

/** Where the Mario and Luigi of one chunk start, deterministically from the seed. Empty if none. */
export function pairSpawns(world: World, cx: number, cy: number): { def: NpcDef; x: number; y: number }[] {
  if (hash2(cx, cy, world.seed ^ SALT) >= PAIR_CHANCE) return [];
  // A random spot in the chunk; skip the pair if there's no dry land nearby.
  const tx = cx * CHUNK_SIZE + 4 + Math.floor(hash2(cx, cy, world.seed ^ (SALT + 1)) * (CHUNK_SIZE - 8));
  const ty = cy * CHUNK_SIZE + 4 + Math.floor(hash2(cy, cx, world.seed ^ (SALT + 2)) * (CHUNK_SIZE - 8));
  const a = world.findWalkableNear(tx, ty, 6);
  if (world.isSolidAt(a.tx, a.ty)) return [];
  const b = world.findWalkableNear(a.tx + 1, a.ty + 1, 4);
  return [
    { def: MARIO, x: (a.tx + 0.5) * TILE_SIZE, y: (a.ty + 0.5) * TILE_SIZE },
    { def: LUIGI, x: (b.tx + 0.5) * TILE_SIZE, y: (b.ty + 0.5) * TILE_SIZE },
  ];
}

/** A Mario or Luigi: a villager in cap and overalls who hops now and then. */
export class Plumber extends Npc {
  dead = false;
  /** Seconds since appearing; each plumber hops at its own moment. */
  age: number;

  constructor(x: number, y: number, def: NpcDef, seed: number, readonly home = '') {
    super(x, y, def, seed);
    this.age = (seed % 1000) / 100;
  }

  update(dt: number, game: Game): void {
    this.age += dt;
    super.update(dt, game);
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const p = camera.toScreen(this.x, this.y);
    const walking = this.dir.x !== 0 || this.dir.y !== 0;
    drawPlumber(ctx, Math.round(p.x), Math.round(p.y), {
      shirt: this.def.color,
      letter: this.def.name[0],
      tall: this.def === LUIGI,
      facing: this.facingLeft ? -1 : 1,
      swing: walking ? Math.sin(this.step) * 2 : 0,
      lift: this.talking ? 0 : hopHeight(this.age),
    });
  }
}

/** Invisible entity that keeps Mario and Luigi pairs in the chunks around the player. */
export class PlumberSpawner implements Entity {
  x = 0;
  y = -Infinity;
  readonly active = new Set<string>();

  update(_dt: number, game: Game): void {
    const pcx = Math.floor(game.player.x / TILE_SIZE / CHUNK_SIZE);
    const pcy = Math.floor(game.player.y / TILE_SIZE / CHUNK_SIZE);
    for (const e of game.entities) {
      if (!(e instanceof Plumber) || e.talking) continue;
      const [cx, cy] = e.home.split(',').map(Number);
      if (Math.max(Math.abs(cx - pcx), Math.abs(cy - pcy)) > DESPAWN_RADIUS) {
        e.dead = true;
        this.active.delete(e.home);
      }
    }
    for (let cy = pcy - SPAWN_RADIUS; cy <= pcy + SPAWN_RADIUS; cy++) {
      for (let cx = pcx - SPAWN_RADIUS; cx <= pcx + SPAWN_RADIUS; cx++) {
        const key = `${cx},${cy}`;
        if (this.active.has(key)) continue;
        this.active.add(key);
        pairSpawns(game.world, cx, cy).forEach((s, i) => {
          const seed = Math.floor(hash2(cx + i, cy, game.world.seed ^ SALT) * 2 ** 31);
          game.entities.push(new Plumber(s.x, s.y, s.def, seed, key));
        });
      }
    }
  }
}

/**
 * A plumber with a cap showing `letter`, a moustache and blue overalls,
 * drawn at feet-centre (x, y) in screen pixels; `lift` raises them off the ground for a hop.
 */
export function drawPlumber(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: { shirt: string; letter: string; tall?: boolean; facing: 1 | -1; swing: number; lift: number },
): void {
  const { shirt, letter, tall, facing: f, swing } = opts;
  const lift = Math.round(opts.lift);
  const h = tall ? 4 : 0; // Luigi is a bit taller

  // Shadow stays on the ground and shrinks while airborne.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + 10, 9 - lift * 0.3, 4 - lift * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  const by = y - lift;
  // Brown shoes and blue overall legs.
  ctx.fillStyle = '#6b3b1f';
  ctx.fillRect(x - 7, by + 8 + swing, 6, 3);
  ctx.fillRect(x + 1, by + 8 - swing, 6, 3);
  ctx.fillStyle = '#2c4fc4';
  ctx.fillRect(x - 6, by + 2 + swing, 5, 7);
  ctx.fillRect(x + 1, by + 2 - swing, 5, 7);
  // Shirt, then the overall bib with straps and yellow buttons.
  ctx.fillStyle = shirt;
  ctx.fillRect(x - 8, by - 8 - h, 16, 11 + h);
  ctx.fillStyle = '#2c4fc4';
  ctx.fillRect(x - 5, by - 3 - h, 10, 7 + h);
  ctx.fillRect(x - 5, by - 8 - h, 2, 5);
  ctx.fillRect(x + 3, by - 8 - h, 2, 5);
  ctx.fillStyle = '#f5d33b';
  ctx.fillRect(x - 4, by - 3 - h, 2, 2);
  ctx.fillRect(x + 2, by - 3 - h, 2, 2);
  // White gloves.
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - 10, by - 1 - h, 3, 3);
  ctx.fillRect(x + 7, by - 1 - h, 3, 3);

  const hy = by - 15 - h; // head centre
  ctx.fillStyle = '#f1c9a0';
  ctx.beginPath();
  ctx.arc(x, hy, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x + f * 5, hy - 1, 3, 3); // nose
  ctx.fillStyle = '#222';
  ctx.fillRect(x + f * 2 - 1, hy - 2, 2, 3); // eye
  ctx.fillStyle = '#3b2314';
  ctx.fillRect(x + f - 4, hy + 2, 9, 2); // moustache
  // Cap with a brim on the side they face and a white badge with the letter.
  ctx.fillStyle = shirt;
  ctx.fillRect(x - 7, hy - 9, 14, 5);
  ctx.fillRect(x + (f > 0 ? 2 : -9), hy - 5, 7, 2);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, hy - 6.5, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shirt;
  ctx.font = 'bold 5px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, x, hy - 6.2);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}
