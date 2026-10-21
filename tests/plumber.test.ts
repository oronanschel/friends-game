import { describe, expect, it } from 'vitest';
import { type Game, updateEntities } from '../src/game';
import { Player } from '../src/player/player';
import { HOP_EVERY, HOP_TIME, Plumber, PlumberSpawner, hopHeight, pairSpawns } from '../src/npc/plumber';
import { nearestNpc } from '../src/npc/talk';
import { LUIGI, MARIO } from '../src/npc/villagers';
import { CHUNK_SIZE, TILE_SIZE, World } from '../src/world/world';

const plumbers = (g: Game) => g.entities.filter((e): e is Plumber => e instanceof Plumber);

describe('Mario and Luigi', () => {
  it('appear in pairs in lots of chunks, on dry land, the same way every time', () => {
    const a = new World(1337);
    const b = new World(1337);
    let pairs = 0;
    for (let cy = -4; cy <= 4; cy++) {
      for (let cx = -4; cx <= 4; cx++) {
        const spots = pairSpawns(a, cx, cy);
        expect(pairSpawns(b, cx, cy)).toEqual(spots);
        if (spots.length === 0) continue;
        pairs++;
        expect(spots.map((s) => s.def)).toEqual([MARIO, LUIGI]);
        for (const s of spots) expect(a.isSolidAt(Math.floor(s.x / TILE_SIZE), Math.floor(s.y / TILE_SIZE))).toBe(false);
      }
    }
    expect(pairs).toBeGreaterThan(20); // "a lot of them": over a quarter of 81 chunks
  });

  it('spawn around the player, can be talked to, and leave when the player is far away', () => {
    const world = new World(1337);
    const game = { world, player: new Player(0, 0), entities: [new PlumberSpawner()] } as unknown as Game;
    updateEntities(game, 1 / 60);
    const near = plumbers(game);
    expect(near.length).toBeGreaterThanOrEqual(2);
    expect(near.filter((p) => p.def === MARIO).length).toBe(near.filter((p) => p.def === LUIGI).length);

    const mario = near[0];
    game.player.x = mario.x + 10;
    game.player.y = mario.y;
    expect(nearestNpc(game)).toBeInstanceOf(Plumber);

    game.player.x = 20 * CHUNK_SIZE * TILE_SIZE;
    updateEntities(game, 1 / 60);
    expect(plumbers(game).includes(mario)).toBe(false);
  });

  it('hop every few seconds and stand on the ground in between', () => {
    expect(hopHeight(0)).toBe(0);
    expect(hopHeight(HOP_TIME / 2)).toBeGreaterThan(5);
    expect(hopHeight(HOP_TIME + 0.5)).toBe(0);
    expect(hopHeight(HOP_EVERY + HOP_TIME / 2)).toBeCloseTo(hopHeight(HOP_TIME / 2));
  });
});
