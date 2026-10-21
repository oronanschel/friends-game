import type { Entity, Game } from '../game';
import { hash2 } from '../world/noise';
import { Tile } from '../world/tiles';
import { CHUNK_SIZE, TILE_SIZE, type World } from '../world/world';
import { Fairy } from './fairy';

/** Fraction of grassy chunks that are home to a fairy ring. */
export const RING_CHANCE = 0.35;
/** Chunks this close (in chunks) to the player get their fairies spawned. */
const SPAWN_RADIUS = 1;
/** Fairies whose home chunk is further than this from the player are removed. */
const DESPAWN_RADIUS = 2;
/** Fairies keep a little distance from the very start so players find them by exploring. */
const SAFE_RADIUS = 8;
const SALT = 0x11017;

/** Where the fairies of one chunk start, deterministically from the seed. Empty if none. */
export function fairySpawns(world: World, cx: number, cy: number): { x: number; y: number }[] {
  if (hash2(cx, cy, world.seed ^ SALT) >= RING_CHANCE) return [];
  const count = 1 + Math.floor(hash2(cx, cy, world.seed ^ (SALT + 1)) * 3);
  const spots: { x: number; y: number }[] = [];
  // Try a handful of random tiles in the chunk; fairies start over open grass meadows.
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
 * Invisible entity that keeps fairy rings around the player:
 * spawns them in nearby chunks and removes them when the player is far away.
 */
export class FairySpawner implements Entity {
  x = 0;
  y = -Infinity;
  /** Chunks whose fairies are currently in the world. */
  readonly active = new Set<string>();

  update(_dt: number, game: Game): void {
    const pcx = Math.floor(game.player.x / TILE_SIZE / CHUNK_SIZE);
    const pcy = Math.floor(game.player.y / TILE_SIZE / CHUNK_SIZE);

    // Despawn fairies (and forget their chunk) once the player is far away.
    for (const e of game.entities) {
      if (!(e instanceof Fairy)) continue;
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
        fairySpawns(game.world, cx, cy).forEach((s, i) => {
          game.entities.push(new Fairy(s.x, s.y, Math.floor(hash2(cx, cy, game.world.seed + i) * 2 ** 31), key));
        });
      }
    }
  }
}
