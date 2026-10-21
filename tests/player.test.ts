import { describe, expect, it } from 'vitest';
import { Player } from '../src/player/player';
import { TILE_SIZE, World } from '../src/world/world';

describe('Player', () => {
  it('moves when the path is clear', () => {
    const world = new World(1337);
    world.isSolidAt = () => false;
    const p = new Player(0, 0);
    p.update(1, { x: 1, y: 0 }, world);
    expect(p.x).toBeCloseTo(p.speed);
    expect(p.facing).toBe('right');
  });

  it('is blocked by solid tiles', () => {
    const world = new World(1337);
    // Wall along tile column x = 1.
    world.isSolidAt = (tx: number) => tx === 1;
    const p = new Player(TILE_SIZE / 2, TILE_SIZE / 2);
    p.update(1, { x: 1, y: 0 }, world);
    // Stops before the wall instead of passing through it.
    expect(p.x).toBeGreaterThan(TILE_SIZE / 2);
    expect(p.x + p.size / 2).toBeLessThanOrEqual(TILE_SIZE);
  });

  it('normalises diagonal speed', () => {
    const world = new World(1337);
    world.isSolidAt = () => false;
    const p = new Player(0, 0);
    p.update(1, { x: 1, y: 1 }, world);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(p.speed);
  });
});

describe('Player running', () => {
  it('moves faster while running', () => {
    const world = new World(1337);
    world.isSolidAt = () => false;
    const walk = new Player(0, 0);
    const run = new Player(0, 0);
    walk.update(1, { x: 1, y: 0 }, world);
    run.update(1, { x: 1, y: 0 }, world, true);
    expect(run.x).toBeGreaterThan(walk.x);
  });
});
