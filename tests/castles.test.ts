import { describe, expect, it } from 'vitest';
import { CASTLE_CELL, CASTLE_HEIGHT, CASTLE_WIDTH, type Castle, CastlePart, castlePartAt } from '../src/world/castles';
import { Decor } from '../src/world/decor';
import { World } from '../src/world/world';

/** All castles in the cells within `radius` cells of the origin. */
function castlesNear(world: World, radius: number): Castle[] {
  const found: Castle[] = [];
  for (let cy = -radius; cy <= radius; cy++) {
    for (let cx = -radius; cx <= radius; cx++) {
      const c = world.castleInCellOf(cx * CASTLE_CELL, cy * CASTLE_CELL);
      if (c) found.push(c);
    }
  }
  return found;
}

describe('castles', () => {
  it('are deterministic for a seed', () => {
    const a = castlesNear(new World(42), 3);
    const b = castlesNear(new World(42), 3);
    expect(a).toEqual(b);
  });

  it('are common, and there is one close to spawn', () => {
    const near = castlesNear(new World(1337), 0);
    expect(near.length).toBe(1);
    expect(Math.max(near[0].tx, near[0].ty)).toBeLessThan(CASTLE_CELL);
    expect(castlesNear(new World(1337), 4).length).toBeGreaterThan(10);
  });

  it('have solid walls and keep, and a walkable gate and courtyard reachable from outside', () => {
    const world = new World(1337);
    for (const c of castlesNear(world, 2)) {
      expect(world.isSolidAt(c.tx, c.ty)).toBe(true); // corner tower
      expect(world.isSolidAt(c.tx + 1, c.ty)).toBe(true); // north wall
      expect(world.isSolidAt(c.tx + 4, c.ty + 2)).toBe(true); // keep
      const gateX = c.tx + Math.floor(CASTLE_WIDTH / 2);
      const gateY = c.ty + CASTLE_HEIGHT - 1;
      expect(castlePartAt(c, gateX, gateY)).toBe(CastlePart.Gate);
      expect(world.isSolidAt(gateX, gateY)).toBe(false);
      expect(world.isSolidAt(gateX, gateY + 1)).toBe(false); // in front of the gate
      expect(world.isSolidAt(gateX, gateY - 1)).toBe(false); // courtyard
    }
  });

  it('stand on dry land with no trees on or around them', () => {
    const world = new World(7);
    for (const c of castlesNear(world, 2)) {
      for (let y = c.ty - 1; y <= c.ty + CASTLE_HEIGHT; y++) {
        for (let x = c.tx - 1; x <= c.tx + CASTLE_WIDTH; x++) expect(world.getDecor(x, y)).toBe(Decor.None);
      }
    }
  });

  it('never block the spawn point', () => {
    for (let seed = 0; seed < 30; seed++) {
      const world = new World(seed);
      expect(world.castleAt(0, 0)).toBeNull();
      expect(world.isSolidAt(0, 0)).toBe(false);
    }
  });
});
