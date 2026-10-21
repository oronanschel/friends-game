import { describe, expect, it } from 'vitest';
import { LION, Lion } from '../src/animals/lion';
import { type Game, updateEntities } from '../src/game';
import { Inventory, ItemKind } from '../src/items/items';
import { WorldItem } from '../src/items/pickup';
import { Player } from '../src/player/player';
import { MAGNET_RANGE, PowerStoneSystem, WorldStone } from '../src/power/powerWorld';
import { PowerStones, STONE_INFO, STONE_ORDER, StoneKind, SWIFT_MULTIPLIER, stonesInChunk } from '../src/power/stones';
import { stoneSlotAt, stoneSlots } from '../src/ui/stoneHud';
import { Tile } from '../src/world/tiles';
import { TILE_SIZE, World } from '../src/world/world';

/** Open grass everywhere. */
const flatWorld = () => ({ seed: 1, getTile: () => Tile.Grass, isSolidAt: () => false }) as unknown as World;

function gameWith(stones: PowerStones, entities: unknown[] = [], world = flatWorld()): { game: Game; system: PowerStoneSystem } {
  const system = new PowerStoneSystem(stones, null);
  const game = { world, player: new Player(0, 0), entities: [system, ...entities] } as unknown as Game;
  return { game, system };
}

const tick = (game: Game, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) updateEntities(game, 1 / 60);
};

describe('stonesInChunk', () => {
  it('is deterministic, rare, and only on walkable tiles', () => {
    const a = new World(1337);
    const b = new World(1337);
    const kinds = new Set<StoneKind>();
    let total = 0;
    for (let cy = -4; cy <= 4; cy++) {
      for (let cx = -4; cx <= 4; cx++) {
        const stones = stonesInChunk(a, cx, cy);
        expect(stonesInChunk(b, cx, cy)).toEqual(stones);
        for (const s of stones) {
          expect(a.isSolidAt(Math.floor(s.x / TILE_SIZE), Math.floor(s.y / TILE_SIZE))).toBe(false);
          kinds.add(s.kind);
        }
        total += stones.length;
      }
    }
    expect([...kinds].sort()).toEqual([...STONE_ORDER].sort());
    expect(total).toBeLessThan(81 * 3); // a few per chunk at most
  });
});

describe('PowerStones', () => {
  it('collects, spends a stone to start its power, and runs out', () => {
    const s = new PowerStones();
    expect(s.use(StoneKind.Swift)).toBe(false);
    s.add(StoneKind.Swift, 'stone:1,1');
    expect(s.use(StoneKind.Swift)).toBe(true);
    expect(s.counts.swift).toBe(0);
    expect(s.speedMultiplier).toBe(SWIFT_MULTIPLIER);
    s.update(STONE_INFO.swift.duration + 0.1);
    expect(s.isActive(StoneKind.Swift)).toBe(false);
    expect(s.speedMultiplier).toBe(1);
  });

  it('saves and loads, ignoring junk', () => {
    const a = new PowerStones();
    a.add(StoneKind.Ward, 'stone:2,2');
    a.add(StoneKind.Ward, 'stone:3,3');
    a.use(StoneKind.Ward);
    const b = new PowerStones();
    b.load(JSON.parse(JSON.stringify(a.save())));
    expect(b.counts.ward).toBe(1);
    expect(b.active.ward).toBe(STONE_INFO.ward.duration);
    expect(b.collected.has('stone:3,3')).toBe(true);
    b.load({ counts: { swift: -1, magnet: 'x' }, active: { ward: 999 }, collected: [5] });
    expect(b.counts.swift).toBe(0);
    expect(b.active.ward).toBe(STONE_INFO.ward.duration);
    b.load(null);
    expect(b.counts.ward).toBe(1);
  });
});

describe('PowerStoneSystem', () => {
  it('picks up a stone on touch and never respawns it', () => {
    const stones = new PowerStones();
    const spot = { id: 'stone:0,0', kind: StoneKind.Magnet, x: 5, y: 0 };
    const { game } = gameWith(stones, [new WorldStone(spot, stones, '0,0')]);
    tick(game, 0.1);
    expect(stones.counts.magnet).toBe(1);
    expect(stones.collected.has('stone:0,0')).toBe(true);
    expect(game.entities.some((e) => e instanceof WorldStone && e.spot.id === 'stone:0,0')).toBe(false);
  });

  it('Swift makes the player faster, then back to normal', () => {
    const stones = new PowerStones();
    stones.add(StoneKind.Swift, 'a');
    const { game, system } = gameWith(stones);
    tick(game, 0.05);
    const base = game.player.speed;
    system.request(StoneKind.Swift);
    tick(game, 0.05);
    expect(game.player.speed).toBeCloseTo(base * SWIFT_MULTIPLIER);
    tick(game, STONE_INFO.swift.duration);
    expect(game.player.speed).toBeCloseTo(base);
  });

  it('Magnet pulls nearby items in so they get collected', () => {
    const stones = new PowerStones();
    stones.add(StoneKind.Magnet, 'a');
    const inv = new Inventory();
    const near = new WorldItem({ id: 'n', kind: ItemKind.Coin, x: MAGNET_RANGE - 10, y: 0 }, inv, '0,0');
    const far = new WorldItem({ id: 'f', kind: ItemKind.Coin, x: MAGNET_RANGE * 2, y: 0 }, inv, '0,0');
    const { game, system } = gameWith(stones, [near, far]);
    system.request(StoneKind.Magnet);
    tick(game, 2);
    expect(inv.counts.coin).toBe(1);
    expect(far.spot.x).toBe(MAGNET_RANGE * 2);
  });

  it('Lion ward stops a chase and walks the lion away', () => {
    const stones = new PowerStones();
    stones.add(StoneKind.Ward, 'a');
    const lion = new Lion(LION.noticeRange - 20, 0, 7);
    const { game, system } = gameWith(stones, [lion]);
    system.request(StoneKind.Ward);
    tick(game, 3);
    expect(lion.state).not.toBe('chase');
    expect(lion.x).toBeGreaterThan(LION.noticeRange - 20);
  });
});

describe('stone HUD', () => {
  it('maps taps to slots', () => {
    const slots = stoneSlots(800, 600);
    expect(slots.map((s) => s.kind)).toEqual(STONE_ORDER);
    const mid = slots[1];
    expect(stoneSlotAt(mid.x + 5, mid.y + 5, 800, 600)).toBe(StoneKind.Magnet);
    expect(stoneSlotAt(5, 5, 800, 600)).toBeNull();
  });
});
