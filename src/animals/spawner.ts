import type { Entity, Game } from '../game';
import { hash2 } from '../world/noise';
import { Tile } from '../world/tiles';
import { CHUNK_SIZE, TILE_SIZE, type World } from '../world/world';
import { Lion } from './lion';

/** Fraction of grassy chunks that are home to a pride. */
export const PRIDE_CHANCE = 0.35;
/** Chunks this close (in chunks) to the player get their lions spawned. */
const SPAWN_RADIUS = 1;
/** Lions whose home chunk is further than this from the player are removed. */
const DESPAWN_RADIUS = 2;
/** Tiles this close to the origin never get lions, so the start is safe. */
const SAFE_RADIUS = 28;
const SALT = 0x11017;

/** Where the lions of one chunk start, deterministically from the seed. Empty if none. */
export function prideSpawns(world: World, cx: number, cy: number): { x: number; y: number }[] {
  if (hash2(cx, cy, world.seed ^ SALT) >= PRIDE_CHANCE) return [];
  const count = 1 + Math.floor(hash2(cx, cy, world.seed ^ (SALT + 1)) * 3);
  const spots: { x: number; y: number }[] = [];
  // Try a handful of random tiles in the chunk; lions only start on open grass.
  for (let i = 0; i < 24 && spots.length < count; i++) {
    const tx = cx * CHUNK_SIZE + Math.floor(hash2(cx * 31 + i, cy, world.seed ^ (SALT + 2)) * CHUNK_SIZE);
    const ty = cy * CHUNK_SIZE + Math.floor(hash2(cx, cy * 31 + i, world.seed ^ (SALT + 3)) * CHUNK_SIZE);
    if (Math.hypot(tx, ty) < SAFE_RADIUS) continue;
    if (world.getTile(tx, ty) !== Tile.Grass || world.isSolidAt(tx, ty)) continue;
    spots.push({ x: (tx + 0.5) * TILE_SIZE, y: (ty + 0.5) * TILE_SIZE });
  }
  return spots;
}

/**
 * Invisible entity that keeps prides of lions around the player:
 * spawns them in nearby chunks and removes them when the player is far away.
 */
export class LionSpawner implements Entity {
  x = 0;
  y = -Infinity;
  /** Chunks whose lions are currently in the world. */
  readonly active = new Set<string>();

  update(_dt: number, game: Game): void {
    const pcx = Math.floor(game.player.x / TILE_SIZE / CHUNK_SIZE);
    const pcy = Math.floor(game.player.y / TILE_SIZE / CHUNK_SIZE);

    // Despawn lions (and forget their chunk) once the player is far away.
    for (const e of game.entities) {
      if (!(e instanceof Lion)) continue;
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
        prideSpawns(game.world, cx, cy).forEach((s, i) => {
          game.entities.push(new Lion(s.x, s.y, Math.floor(hash2(cx, cy, game.world.seed + i) * 2 ** 31), key));
        });
      }
    }
  }
}
