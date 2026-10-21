import { describe, expect, it } from 'vitest';
import { FAIRY, Fairy } from '../src/animals/fairy';
import { FairySpawner, fairySpawns } from '../src/animals/fairies';
import type { Game } from '../src/game';
import { Health, MAX_HEARTS } from '../src/player/health';
import { Player } from '../src/player/player';
import { MagicBolt, SPELL, Spellbook } from '../src/player/spell';
import { Tile } from '../src/world/tiles';
import { CHUNK_SIZE, TILE_SIZE, World } from '../src/world/world';

/** Open grass everywhere, with a wall at tile x = 5. */
const flatWorld = { seed: 1, getTile: () => Tile.Grass, isSolidAt: (tx: number) => tx === 5 } as unknown as World;

function gameWith(entities: object[], px: number, py: number, health = new Health()): Game {
  return { world: flatWorld, player: new Player(px, py), entities, health } as unknown as Game;
}

function run(e: { update(dt: number, g: Game): void }, game: Game, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) e.update(1 / 60, game);
}

describe('Fairy', () => {
  it('wanders when the player is far away', () => {
    const f = new Fairy(-500, 0, 3);
    run(f, gameWith([f], -500 + FAIRY.noticeRange * 3, 0), 2);
    expect(f.state).toBe('wander');
  });

  it('flies over to visit and heals a hurt player, then rests a while', () => {
    const f = new Fairy(-500, 0, 3);
    const health = new Health();
    health.hurt();
    const game = gameWith([f], -500 - FAIRY.noticeRange + 20, 0, health);
    f.update(1 / 60, game);
    expect(f.state).toBe('visit');
    run(f, game, 3);
    expect(health.hearts).toBe(MAX_HEARTS);
    expect(f.cooldown).toBeGreaterThan(0);
    expect(f.state).toBe('wander');
  });

  it('never hurts the player', () => {
    const f = new Fairy(0, 0, 3);
    const health = new Health();
    run(f, gameWith([f], 10, 0, health), 10);
    expect(health.hearts).toBe(MAX_HEARTS);
  });

  it('giggles and spins when hit by a spell', () => {
    const f = new Fairy(100, 0, 3);
    const game = gameWith([f], 0, 0);
    f.onSpellHit(game);
    expect(f.spin).toBeGreaterThan(0);
    expect(f.bubble).toBe('Hehe!');
  });
});

describe('fairy spawning', () => {
  it('is deterministic and only over open grass', () => {
    const a = new World(1337);
    const b = new World(1337);
    let found = 0;
    for (let cy = -3; cy <= 3; cy++) {
      for (let cx = -3; cx <= 3; cx++) {
        const spots = fairySpawns(a, cx, cy);
        expect(fairySpawns(b, cx, cy)).toEqual(spots);
        for (const s of spots) {
          expect(a.getTile(Math.floor(s.x / TILE_SIZE), Math.floor(s.y / TILE_SIZE))).toBe(Tile.Grass);
          found++;
        }
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('spawns fairies near the player and removes them far away', () => {
    const world = new World(1337);
    const spawner = new FairySpawner();
    const game = { world, player: new Player(0, 0), entities: [spawner] } as unknown as Game;
    let fairies: Fairy[] = [];
    for (let cx = 0; cx < 20 && fairies.length === 0; cx++) {
      game.player.x = cx * CHUNK_SIZE * TILE_SIZE;
      spawner.update(0, game);
      fairies = game.entities.filter((e): e is Fairy => e instanceof Fairy);
    }
    expect(fairies.length).toBeGreaterThan(0);
    game.player.x += 10 * CHUNK_SIZE * TILE_SIZE;
    spawner.update(0, game);
    expect(fairies.every((f) => f.dead)).toBe(true);
  });
});

describe('wizard spells', () => {
  it('casts a bolt in the facing direction, with a cooldown', () => {
    const book = new Spellbook();
    const game = gameWith([], 0, 0);
    game.player.facing = 'left';
    const bolt = book.cast(game.player, game)!;
    expect(bolt.dir).toEqual({ x: -1, y: 0 });
    expect(game.entities).toContain(bolt);
    expect(book.cast(game.player, game)).toBeNull();
    book.update(SPELL.cooldown + 0.01);
    expect(book.cast(game.player, game)).not.toBeNull();
  });

  it('stops at solid tiles', () => {
    const bolt = new MagicBolt(3 * TILE_SIZE, 16, { x: 1, y: 0 });
    const game = gameWith([bolt], 0, 0);
    run(bolt, game, 0.5);
    expect(bolt.dead).toBe(true);
    expect(bolt.x).toBeLessThan(6 * TILE_SIZE);
  });

  it('hits entities that react to spells', () => {
    const f = new Fairy(-200, 0, 3);
    const bolt = new MagicBolt(-100, 0, { x: -1, y: 0 });
    const game = gameWith([f, bolt], 0, 0);
    run(bolt, game, 0.5);
    expect(bolt.dead).toBe(true);
    expect(f.bubble).toBe('Hehe!');
  });
});
