import { describe, expect, it } from 'vitest';
import { LION, Lion } from '../src/animals/lion';
import { LionSpawner, prideSpawns } from '../src/animals/spawner';
import type { Game } from '../src/game';
import { Player } from '../src/player/player';
import { Tile } from '../src/world/tiles';
import { CHUNK_SIZE, TILE_SIZE, World } from '../src/world/world';

/** A flat world of open grass with a wall at tile x = 5. */
function fakeWorld(): World {
  return {
    seed: 1,
    getTile: () => Tile.Grass,
    isSolidAt: (tx: number) => tx === 5,
  } as unknown as World;
}

function gameWith(lion: Lion, px: number, py: number, world = fakeWorld()): Game {
  return { world, player: new Player(px, py), entities: [lion] } as unknown as Game;
}

function run(lion: Lion, game: Game, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) lion.update(1 / 60, game);
}

describe('Lion', () => {
  it('wanders when the player is far away', () => {
    const lion = new Lion(-500, 0, 42);
    run(lion, gameWith(lion, -500 + LION.noticeRange * 3, 0), 2);
    expect(lion.state).toBe('wander');
  });

  it('notices a nearby player, roars and chases', () => {
    const lion = new Lion(-500, 0, 42);
    const game = gameWith(lion, -500 - LION.noticeRange + 20, 0);
    lion.update(1 / 60, game);
    expect(lion.state).toBe('chase');
    expect(lion.roar).toBeGreaterThan(0);
    const before = Math.abs(game.player.x - lion.x);
    run(lion, game, 0.5);
    expect(Math.abs(game.player.x - lion.x)).toBeLessThan(before);
  });

  it('pounces when it catches the player, knocks them back and rests', () => {
    const lion = new Lion(-500, 0, 1);
    const game = gameWith(lion, -500 - LION.noticeRange + 20, 0);
    run(lion, game, 3);
    expect(lion.state).toBe('rest');
    expect(Math.hypot(game.player.x - lion.x, game.player.y - lion.y)).toBeGreaterThan(LION.catchRange);
  });

  it('gives up when the player outruns it', () => {
    const lion = new Lion(-500, 0, 1);
    const game = gameWith(lion, -500 - LION.noticeRange + 20, 0);
    lion.update(1 / 60, game);
    game.player.x = lion.x - LION.giveUpRange - 50;
    lion.update(1 / 60, game);
    expect(lion.state).toBe('rest');
  });

  it('does not walk through solid tiles', () => {
    const lion = new Lion(4 * TILE_SIZE, TILE_SIZE / 2, 1);
    lion.state = 'chase';
    lion.timer = 100;
    const game = gameWith(lion, 9 * TILE_SIZE, TILE_SIZE / 2);
    run(lion, game, 2);
    expect(lion.x + LION.size / 2).toBeLessThanOrEqual(5 * TILE_SIZE);
  });
});

describe('lion spawning', () => {
  it('is deterministic for a seed and only uses open grass away from spawn', () => {
    const a = new World(1337);
    const b = new World(1337);
    let found = 0;
    for (let cy = -4; cy <= 4; cy++) {
      for (let cx = -4; cx <= 4; cx++) {
        const spots = prideSpawns(a, cx, cy);
        expect(prideSpawns(b, cx, cy)).toEqual(spots);
        for (const s of spots) {
          const tx = Math.floor(s.x / TILE_SIZE);
          const ty = Math.floor(s.y / TILE_SIZE);
          expect(a.getTile(tx, ty)).toBe(Tile.Grass);
          expect(a.isSolidAt(tx, ty)).toBe(false);
          expect(Math.hypot(tx, ty)).toBeGreaterThanOrEqual(28);
          found++;
        }
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('spawns lions near the player and removes them when far away', () => {
    const world = new World(1337);
    const spawner = new LionSpawner();
    const game = { world, player: new Player(0, 0), entities: [spawner] } as unknown as Game;
    // Walk the player across the map until some lions appear.
    let lions: Lion[] = [];
    for (let cx = 0; cx < 20 && lions.length === 0; cx++) {
      game.player.x = cx * CHUNK_SIZE * TILE_SIZE;
      spawner.update(0, game);
      lions = game.entities.filter((e): e is Lion => e instanceof Lion);
    }
    expect(lions.length).toBeGreaterThan(0);

    // Running the spawner again does not duplicate them.
    spawner.update(0, game);
    expect(game.entities.filter((e) => e instanceof Lion).length).toBe(lions.length);

    // Far away, the old lions are marked dead.
    game.player.x += 10 * CHUNK_SIZE * TILE_SIZE;
    spawner.update(0, game);
    expect(lions.every((l) => l.dead)).toBe(true);
  });
});
