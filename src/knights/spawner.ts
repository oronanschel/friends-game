import type { Entity, Game } from '../game';
import { CASTLE_CELL } from '../world/castles';
import { hash2 } from '../world/noise';
import { TILE_SIZE } from '../world/world';
import { Knight, guardPosts } from './knight';

/** Placement cells this close (in cells) to the player get their guards spawned. */
const SPAWN_RADIUS = 1;
/** Guards whose castle's cell is further than this from the player are removed. */
const DESPAWN_RADIUS = 2;
const SALT = 0x6b17;

/**
 * Invisible entity that keeps two chess-knight guards at every castle near the player:
 * spawns them when the castle's cell is close and removes them when the player is far away.
 */
export class KnightSpawner implements Entity {
  x = 0;
  y = -Infinity;
  /** Placement cells whose guards are currently in the world. */
  readonly active = new Set<string>();

  update(_dt: number, game: Game): void {
    const pcx = Math.floor(game.player.x / TILE_SIZE / CASTLE_CELL);
    const pcy = Math.floor(game.player.y / TILE_SIZE / CASTLE_CELL);

    for (const e of game.entities) {
      if (!(e instanceof Knight)) continue;
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
        const castle = game.world.castleInCellOf(cx * CASTLE_CELL, cy * CASTLE_CELL);
        if (!castle) continue;
        guardPosts(castle).forEach((post, i) => {
          if (game.world.isSolidAt(post.tx, post.ty)) return;
          game.entities.push(new Knight(post, castle, Math.floor(hash2(cx, cy, game.world.seed + SALT + i) * 2 ** 31), key));
        });
      }
    }
  }
}
