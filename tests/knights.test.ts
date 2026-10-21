import { describe, expect, it } from 'vitest';
import type { Game } from '../src/game';
import { KNIGHT, KNIGHT_MOVES, Knight, castleCentre, guardPosts, knightLandings } from '../src/knights/knight';
import { KnightSpawner } from '../src/knights/spawner';
import { Player } from '../src/player/player';
import { CASTLE_CELL, CASTLE_HEIGHT, type Castle, castlePartAt } from '../src/world/castles';
import { Tile } from '../src/world/tiles';
import { TILE_SIZE, World } from '../src/world/world';

/** Open grass everywhere, with an optional set of solid tiles. */
function fakeWorld(solid: (tx: number, ty: number) => boolean = () => false): World {
  return { seed: 1, getTile: () => Tile.Grass, isSolidAt: solid } as unknown as World;
}

const castle: Castle = { tx: 100, ty: 100, banner: '#d32f2f' };
const post = guardPosts(castle)[0];

function knightAt(world: World, playerTx: number, playerTy: number): { knight: Knight; game: Game } {
  const knight = new Knight(post, castle, 7, '2,2');
  const player = new Player((playerTx + 0.5) * TILE_SIZE, (playerTy + 0.5) * TILE_SIZE);
  return { knight, game: { world, player, entities: [knight] } as unknown as Game };
}

function run(knight: Knight, game: Game, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) knight.update(1 / 60, game);
}

describe('knight moves', () => {
  it('are the eight chess L-shapes', () => {
    expect(KNIGHT_MOVES).toHaveLength(8);
    for (const [dx, dy] of KNIGHT_MOVES) expect(Math.abs(dx) * Math.abs(dy)).toBe(2);
  });

  it('hop over walls: only the landing tile must be free', () => {
    // A solid line at x = 11 does not stop a hop from x = 10 to x = 12.
    const world = fakeWorld((tx) => tx === 11);
    const landings = knightLandings(world, 10, 0);
    expect(landings.some((l) => l.tx === 12)).toBe(true);
    expect(landings.some((l) => l.tx === 11)).toBe(false);
  });
});

describe('Knight', () => {
  it('starts on its post and patrols with L-shaped hops near it', () => {
    const { knight, game } = knightAt(fakeWorld(), post.tx + 60, post.ty);
    expect([knight.tx, knight.ty]).toEqual([post.tx, post.ty]);
    let hops = 0;
    let prev = [knight.tx, knight.ty];
    for (let t = 0; t < 30; t += 1 / 60) {
      knight.update(1 / 60, game);
      if (!knight.hopping && (knight.tx !== prev[0] || knight.ty !== prev[1])) {
        const d = [Math.abs(knight.tx - prev[0]), Math.abs(knight.ty - prev[1])].sort();
        expect(d).toEqual([1, 2]);
        expect(Math.hypot(knight.tx - post.tx, knight.ty - post.ty)).toBeLessThanOrEqual(KNIGHT.patrolRadius);
        hops++;
        prev = [knight.tx, knight.ty];
      }
    }
    expect(knight.state).toBe('patrol');
    expect(hops).toBeGreaterThan(3);
  });

  it('notices a nearby player, shouts and chases them', () => {
    const { knight, game } = knightAt(fakeWorld(), post.tx + 6, post.ty);
    const before = Math.abs(game.player.x - knight.x);
    knight.update(1 / 60, game);
    expect(knight.state).toBe('chase');
    expect(knight.shout).toBeGreaterThan(0);
    run(knight, game, 1.5);
    expect(Math.abs(game.player.x - knight.x)).toBeLessThan(before);
  });

  it('ignores a player outside the castle leash', () => {
    const c = castleCentre(castle);
    const { knight, game } = knightAt(fakeWorld(), Math.round(c.tx + KNIGHT.leash + 3), Math.round(c.ty));
    // Put the knight right next to the far player so only the leash can stop it.
    knight.x = game.player.x - 3 * TILE_SIZE;
    knight.y = game.player.y;
    run(knight, game, 2);
    expect(knight.state).toBe('patrol');
  });

  it('never leaves the leash while chasing', () => {
    const c = castleCentre(castle);
    const { knight, game } = knightAt(fakeWorld(), post.tx + 5, post.ty);
    for (let t = 0; t < 20; t += 1 / 60) {
      // The player runs away from the castle in a straight line.
      game.player.x += 3;
      knight.update(1 / 60, game);
      expect(Math.hypot(knight.tx - c.tx, knight.ty - c.ty)).toBeLessThanOrEqual(KNIGHT.leash + 1e-6);
    }
  });

  it('shoves the player back when it catches them, then rests', () => {
    const { knight, game } = knightAt(fakeWorld(), post.tx, post.ty);
    knight.state = 'chase';
    knight.timer = KNIGHT.maxChaseTime;
    game.player.x = knight.x + 10;
    game.player.y = knight.y;
    const before = game.player.x;
    knight.update(1 / 60, game);
    expect(knight.state).toBe('rest');
    expect(game.player.x).toBeGreaterThan(before);
  });

  it('gives up and heads home after a long chase', () => {
    const { knight, game } = knightAt(fakeWorld(), post.tx + 6, post.ty);
    knight.update(1 / 60, game);
    expect(knight.state).toBe('chase');
    game.player.x += 40 * TILE_SIZE; // far away
    knight.update(1 / 60, game);
    expect(knight.state).toBe('rest');
  });
});

describe('KnightSpawner', () => {
  it('puts two guards by the gate of the castle near spawn and removes them far away', () => {
    const world = new World(1337);
    const c = world.castleInCellOf(0, 0)!;
    expect(c).not.toBeNull();
    const player = new Player(0, 0);
    const game = { world, player, entities: [] as unknown[] } as unknown as Game;
    const spawner = new KnightSpawner();
    spawner.update(0, game);
    const all = (game.entities as Knight[]).filter((e) => e instanceof Knight);
    // Two guards for every castle in the nearby cells, including the one by spawn.
    let castles = 0;
    for (let cy = -1; cy <= 1; cy++) for (let cx = -1; cx <= 1; cx++) if (world.castleInCellOf(cx * CASTLE_CELL, cy * CASTLE_CELL)) castles++;
    expect(all).toHaveLength(2 * castles);
    const knights = all.filter((k) => k.castle === c);
    expect(knights).toHaveLength(2);
    for (const k of knights) {
      expect(world.isSolidAt(k.tx, k.ty)).toBe(false);
      // Posts are just outside the south wall, either side of the gate.
      expect(k.ty).toBe(c.ty + CASTLE_HEIGHT);
      expect(castlePartAt(c, k.tx, k.ty)).toBe(0);
    }
    // No duplicates on later frames.
    spawner.update(0, game);
    expect((game.entities as unknown[]).filter((e) => e instanceof Knight)).toHaveLength(2 * castles);
    // Far from the castle the guards go away.
    player.x = 10 * CASTLE_CELL * TILE_SIZE;
    spawner.update(0, game);
    expect(all.every((k) => k.dead)).toBe(true);
  });
});
