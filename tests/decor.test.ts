import { describe, expect, it } from 'vitest';
import { Decor, chooseDecor, isSolidDecor } from '../src/world/decor';
import { Tile } from '../src/world/tiles';
import { World } from '../src/world/world';

describe('decor', () => {
  it('is deterministic for a seed', () => {
    const a = new World(9);
    const b = new World(9);
    for (let i = -40; i < 40; i += 3) expect(a.getDecor(i, -i * 2)).toBe(b.getDecor(i, -i * 2));
  });

  it('never puts decor on water or rock', () => {
    for (let i = 0; i < 200; i++) {
      expect(chooseDecor(Tile.Water, i, i * 3, 1)).toBe(Decor.None);
      expect(chooseDecor(Tile.Rock, i, i * 3, 1)).toBe(Decor.None);
    }
  });

  it('makes forests dense with trees', () => {
    let trees = 0;
    for (let i = 0; i < 1000; i++) if (chooseDecor(Tile.Forest, 100 + i, 50, 1) === Decor.Tree) trees++;
    expect(trees).toBeGreaterThan(250);
    expect(trees).toBeLessThan(500);
  });

  it('trees block movement and the spawn area stays clear', () => {
    const w = new World(1337);
    expect(isSolidDecor(Decor.Tree)).toBe(true);
    expect(isSolidDecor(Decor.Flowers)).toBe(false);
    for (let seed = 0; seed < 30; seed++) {
      const world = new World(seed);
      expect(world.isSolidAt(0, 0)).toBe(false);
    }
    // Somewhere nearby there is a solid tree.
    let found = false;
    for (let ty = -60; ty < 60 && !found; ty++) {
      for (let tx = -60; tx < 60 && !found; tx++) {
        if (w.getDecor(tx, ty) === Decor.Tree) found = w.isSolidAt(tx, ty);
      }
    }
    expect(found).toBe(true);
  });
});
