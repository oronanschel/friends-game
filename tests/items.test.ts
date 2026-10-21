import { describe, expect, it } from 'vitest';
import type { Game } from '../src/game';
import { ITEM_INFO, ITEM_ORDER, Inventory, ItemKind, itemsInChunk } from '../src/items/items';
import { ItemSpawner, PickupPopup, WorldItem } from '../src/items/pickup';
import { Player } from '../src/player/player';
import { SaveManager } from '../src/save/save';
import { TILE_SIZE, World } from '../src/world/world';

function gameAt(x: number, y: number, inventory: Inventory, world = new World(1337)): Game {
  return { world, player: new Player(x, y), entities: [new ItemSpawner(inventory)], inventory } as unknown as Game;
}

const worldItems = (g: Game) => g.entities.filter((e): e is WorldItem => e instanceof WorldItem);

describe('itemsInChunk', () => {
  it('is deterministic and places items on allowed, walkable tiles', () => {
    const a = new World(1337);
    const b = new World(1337);
    const kinds = new Set<ItemKind>();
    for (let cy = -3; cy <= 3; cy++) {
      for (let cx = -3; cx <= 3; cx++) {
        const items = itemsInChunk(a, cx, cy);
        expect(itemsInChunk(b, cx, cy)).toEqual(items);
        for (const it of items) {
          const tx = Math.floor(it.x / TILE_SIZE);
          const ty = Math.floor(it.y / TILE_SIZE);
          expect(it.id).toBe(`${tx},${ty}`);
          expect(ITEM_INFO[it.kind].tiles).toContain(a.getTile(tx, ty));
          expect(a.isSolidAt(tx, ty)).toBe(false);
          kinds.add(it.kind);
        }
      }
    }
    // A 7×7-chunk area is big enough to contain every kind of item.
    expect([...kinds].sort()).toEqual([...ITEM_ORDER].sort());
  });
});

describe('Inventory', () => {
  it('counts pickups and takes items', () => {
    const inv = new Inventory();
    inv.add(ItemKind.Coin, '1,1');
    inv.add(ItemKind.Coin, '2,1');
    expect(inv.counts.coin).toBe(2);
    expect(inv.collected.has('2,1')).toBe(true);
    expect(inv.take(ItemKind.Coin, 3)).toBe(false);
    expect(inv.take(ItemKind.Coin, 2)).toBe(true);
    expect(inv.counts.coin).toBe(0);
  });

  it('round-trips through the save system and ignores junk', () => {
    const data = new Map<string, string>();
    const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: () => {} };
    const a = new Inventory();
    a.add(ItemKind.Gem, '5,5');
    const saves = new SaveManager(store);
    saves.register('inventory', a);
    saves.save(1, { x: 0, y: 0 });

    const b = new Inventory();
    new SaveManager(store).register('inventory', b, new SaveManager(store).load());
    expect(b.counts.gem).toBe(1);
    expect(b.collected.has('5,5')).toBe(true);

    const c = new Inventory();
    c.load({ counts: { coin: -3, berry: 'x', gem: 2.7 }, collected: [1, 'a'] });
    expect(c.counts).toEqual({ coin: 0, berry: 0, mushroom: 0, gem: 2 });
    expect([...c.collected]).toEqual(['a']);
    c.load(null);
    expect(c.counts.gem).toBe(2);
  });
});

describe('picking up items', () => {
  it('spawns items around the player, collects on touch, and never respawns them', () => {
    const inv = new Inventory();
    const game = gameAt(0, 0, inv);
    const spawner = game.entities[0] as ItemSpawner;
    spawner.update(0, game);
    const items = worldItems(game);
    expect(items.length).toBeGreaterThan(0);

    // Stand on the first item.
    const target = items[0];
    game.player.x = target.x;
    game.player.y = target.y;
    target.update(1 / 60, game);
    expect(target.dead).toBe(true);
    expect(inv.counts[target.spot.kind]).toBe(1);
    expect(inv.collected.has(target.spot.id)).toBe(true);
    expect(game.entities.some((e) => e instanceof PickupPopup)).toBe(true);

    // Leave the area and come back: the collected item stays gone, the others return.
    game.entities = [spawner];
    game.player.x = 50 * 32 * TILE_SIZE;
    spawner.update(0, game);
    game.entities = [spawner];
    spawner.active.clear();
    game.player.x = 0;
    game.player.y = 0;
    spawner.update(0, game);
    const again = worldItems(game);
    expect(again.length).toBe(items.length - 1);
    expect(again.some((e) => e.spot.id === target.spot.id)).toBe(false);
  });

  it('despawns items when the player is far away', () => {
    const inv = new Inventory();
    const game = gameAt(0, 0, inv);
    const spawner = game.entities[0] as ItemSpawner;
    spawner.update(0, game);
    const items = worldItems(game);
    game.player.x = 10 * 32 * TILE_SIZE;
    spawner.update(0, game);
    expect(items.every((i) => i.dead)).toBe(true);
  });
});
