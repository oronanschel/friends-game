import { describe, expect, it } from 'vitest';
import { fractalNoise, hash2 } from '../src/world/noise';
import { Tile } from '../src/world/tiles';
import { classify, World } from '../src/world/world';

describe('noise', () => {
  it('is deterministic and in range', () => {
    expect(hash2(3, -7, 42)).toBe(hash2(3, -7, 42));
    for (let i = 0; i < 100; i++) {
      const n = fractalNoise(i * 0.37, -i * 0.21, 9);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe('World', () => {
  it('generates the same tiles for the same seed', () => {
    const a = new World(5);
    const b = new World(5);
    for (let i = -50; i < 50; i += 7) {
      expect(a.getTile(i, i * 3)).toBe(b.getTile(i, i * 3));
    }
  });

  it('handles negative coordinates across chunk boundaries', () => {
    const w = new World(1);
    expect(() => w.getTile(-1, -33)).not.toThrow();
    expect(Object.values(Tile)).toContain(w.getTile(-1, -33));
  });

  it('finds a walkable spawn', () => {
    const w = new World(1337);
    const s = w.findWalkableNear(0, 0);
    expect(w.isSolidAt(s.tx, s.ty)).toBe(false);
  });

  it('classifies water as low and snow as high', () => {
    expect(classify(0.1, 0.5)).toBe(Tile.DeepWater);
    expect(classify(0.9, 0.5)).toBe(Tile.Snow);
    expect(classify(0.5, 0.9)).toBe(Tile.Forest);
    expect(classify(0.62, 0.6)).toBe(Tile.Taiga);
    expect(classify(0.62, 0.2)).toBe(Tile.Grass);
  });
});

describe('spawn area', () => {
  it('has walkable land at the origin for many seeds', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(new World(seed).isSolidAt(0, 0)).toBe(false);
    }
  });
});

describe('biomes', () => {
  it('produces every land and water tile type somewhere', () => {
    const w = new World(1337);
    const seen = new Set<Tile>();
    for (let ty = -400; ty < 400; ty += 3) {
      for (let tx = -400; tx < 400; tx += 3) seen.add(w.getTile(tx, ty));
    }
    for (const t of [Tile.DeepWater, Tile.Water, Tile.Sand, Tile.Grass, Tile.Forest, Tile.Rock, Tile.Snow, Tile.Taiga]) {
      expect(seen.has(t)).toBe(true);
    }
  });
});
