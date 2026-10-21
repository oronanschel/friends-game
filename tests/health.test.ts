import { describe, expect, it } from 'vitest';
import { LION, Lion } from '../src/animals/lion';
import type { Game } from '../src/game';
import { Inventory, ItemKind } from '../src/items/items';
import { FAINT_TIME, Health, INVULNERABLE_TIME, MAX_HEARTS, eatBerry } from '../src/player/health';
import { Player } from '../src/player/player';
import { Tile } from '../src/world/tiles';
import type { World } from '../src/world/world';

describe('Health', () => {
  it('loses a heart per hit, with a short invulnerability window', () => {
    const h = new Health();
    expect(h.hurt()).toBe(true);
    expect(h.hearts).toBe(MAX_HEARTS - 1);
    expect(h.hurt()).toBe(false);
    h.update(INVULNERABLE_TIME + 0.01);
    expect(h.hurt()).toBe(true);
    expect(h.hearts).toBe(MAX_HEARTS - 2);
  });

  it('faints at zero hearts, then wakes up once with full hearts', () => {
    const h = new Health();
    h.hearts = 1;
    h.hurt();
    expect(h.awake).toBe(false);
    expect(h.heal()).toBe(false);
    expect(h.update(FAINT_TIME / 2)).toBe(false);
    expect(h.update(FAINT_TIME / 2 + 0.01)).toBe(true);
    expect(h.awake).toBe(true);
    expect(h.hearts).toBe(MAX_HEARTS);
    expect(h.update(1)).toBe(false);
  });

  it('saves hearts and never loads into a fainted state', () => {
    const h = new Health();
    h.hearts = 3;
    const restored = new Health();
    restored.load(h.save());
    expect(restored.hearts).toBe(3);
    restored.load({ hearts: 0 });
    expect(restored.hearts).toBe(1);
    restored.load({ hearts: 99 });
    expect(restored.hearts).toBe(MAX_HEARTS);
    restored.load('junk');
    expect(restored.hearts).toBe(MAX_HEARTS);
  });
});

describe('eatBerry', () => {
  it('trades a berry for a heart only when hurt', () => {
    const h = new Health();
    const inv = new Inventory();
    inv.add(ItemKind.Berry, '1,1');
    expect(eatBerry(h, inv)).toBe(false);
    expect(inv.counts.berry).toBe(1);
    h.hurt();
    expect(eatBerry(h, inv)).toBe(true);
    expect(h.hearts).toBe(MAX_HEARTS);
    expect(inv.counts.berry).toBe(0);
    h.update(INVULNERABLE_TIME + 0.01);
    h.hurt();
    expect(eatBerry(h, inv)).toBe(false);
  });
});

describe('lions and health', () => {
  const world = { seed: 1, getTile: () => Tile.Grass, isSolidAt: () => false } as unknown as World;

  it('a pounce costs a heart', () => {
    const lion = new Lion(0, 0, 1);
    const health = new Health();
    const game = { world, player: new Player(-LION.noticeRange + 20, 0), entities: [lion], health } as unknown as Game;
    for (let t = 0; t < 3 && lion.state !== 'rest'; t += 1 / 60) lion.update(1 / 60, game);
    expect(lion.state).toBe('rest');
    expect(health.hearts).toBe(MAX_HEARTS - 1);
  });

  it('ignores a fainted player', () => {
    const lion = new Lion(0, 0, 1);
    const health = new Health();
    health.hearts = 1;
    health.hurt();
    const game = { world, player: new Player(-40, 0), entities: [lion], health } as unknown as Game;
    lion.update(1 / 60, game);
    expect(lion.state).toBe('wander');
  });
});
