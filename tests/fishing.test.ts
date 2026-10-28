import { describe, expect, it } from 'vitest';
import { BITE_WINDOW, Fishing, FishingText, WAIT_MIN, waterInFront } from '../src/fishing/fishing';
import type { Game } from '../src/game';
import { Inventory, ItemKind } from '../src/items/items';
import { PickupPopup } from '../src/items/pickup';
import { Health } from '../src/player/health';
import { Player } from '../src/player/player';
import { Tile } from '../src/world/tiles';
import { TILE_SIZE, World } from '../src/world/world';

const isWater = (world: World, tx: number, ty: number) => {
  const t = world.getTile(tx, ty);
  return t === Tile.Water || t === Tile.DeepWater;
};

/** A walkable tile with water right next to it on the right. */
function shore(world: World): { tx: number; ty: number } {
  for (let ty = -150; ty <= 150; ty++) {
    for (let tx = -150; tx <= 150; tx++) {
      if (!world.isSolidAt(tx, ty) && isWater(world, tx + 1, ty)) return { tx, ty };
    }
  }
  throw new Error('no shore found');
}

/** A walkable tile with no water within 3 tiles. */
function inland(world: World): { tx: number; ty: number } {
  for (let ty = -150; ty <= 150; ty++) {
    for (let tx = -150; tx <= 150; tx++) {
      if (world.isSolidAt(tx, ty)) continue;
      let dry = true;
      for (let dy = -3; dy <= 3 && dry; dy++) for (let dx = -3; dx <= 3 && dry; dx++) if (isWater(world, tx + dx, ty + dy)) dry = false;
      if (dry) return { tx, ty };
    }
  }
  throw new Error('no inland tile found');
}

function gameAt(t: { tx: number; ty: number }, world: World): Game {
  const player = new Player((t.tx + 0.5) * TILE_SIZE, (t.ty + 0.5) * TILE_SIZE);
  player.facing = 'right';
  return { world, player, entities: [], inventory: new Inventory() } as unknown as Game;
}

const world = new World(1337);

describe('waterInFront', () => {
  it('finds the water tile the player faces, and nothing inland', () => {
    const s = shore(world);
    const g = gameAt(s, world);
    expect(waterInFront(world, g.player)).toEqual({ tx: s.tx + 1, ty: s.ty });
    expect(waterInFront(world, gameAt(inland(world), world).player)).toBeNull();
  });
});

describe('Fishing', () => {
  it('catches a fish when R is pressed after the bite', () => {
    const g = gameAt(shore(world), world);
    const f = new Fishing(() => 0);
    f.press(g);
    expect(f.state).toBe('waiting');
    f.update(WAIT_MIN - 0.1, g);
    expect(f.state).toBe('waiting');
    f.update(0.2, g);
    expect(f.state).toBe('bite');
    f.press(g);
    expect(f.state).toBe('idle');
    expect(g.inventory.counts[ItemKind.Fish]).toBe(1);
    expect(g.entities.some((e) => e instanceof PickupPopup)).toBe(true);
  });

  it('scares the fish off when R is pressed too early', () => {
    const g = gameAt(shore(world), world);
    const f = new Fishing(() => 0);
    f.press(g);
    f.press(g);
    expect(f.state).toBe('idle');
    expect(g.inventory.counts[ItemKind.Fish]).toBe(0);
    expect(g.entities.some((e) => e instanceof FishingText)).toBe(true);
  });

  it('lets the fish get away if you wait too long', () => {
    const g = gameAt(shore(world), world);
    const f = new Fishing(() => 0);
    f.press(g);
    f.update(WAIT_MIN + 0.01, g);
    f.update(BITE_WINDOW + 0.01, g);
    expect(f.state).toBe('idle');
    expect(g.inventory.counts[ItemKind.Fish]).toBe(0);
  });

  it('reels in when the player walks away', () => {
    const g = gameAt(shore(world), world);
    const f = new Fishing(() => 0);
    f.press(g);
    g.player.x -= 20;
    f.update(0.1, g);
    expect(f.state).toBe('idle');
  });

  it("can't cast without water in front, or while fainted", () => {
    const f = new Fishing(() => 0);
    f.press(gameAt(inland(world), world));
    expect(f.state).toBe('idle');

    const g = gameAt(shore(world), world);
    const health = new Health();
    health.hurt(99);
    g.health = health;
    f.press(g);
    expect(f.state).toBe('idle');
  });
});
