import { describe, expect, it } from 'vitest';
import {
  CAMPFIRE_CHANCE,
  Campfire,
  CampfireSpawner,
  Campfires,
  REST_RANGE,
  RestPopup,
  campfireInChunk,
  campfireLights,
} from '../src/campfire/campfires';
import type { Game } from '../src/game';
import { Health } from '../src/player/health';
import { Player } from '../src/player/player';
import { SaveManager } from '../src/save/save';
import { CHUNK_SIZE, TILE_SIZE, World } from '../src/world/world';

function gameAt(x: number, y: number, campfires: Campfires, world = new World(1337)): Game {
  return { world, player: new Player(x, y), entities: [new CampfireSpawner(campfires)] } as unknown as Game;
}

const fires = (g: Game) => g.entities.filter((e): e is Campfire => e instanceof Campfire);

/** The first chunk (scanning outwards from the origin) that has a campfire. */
function firstSpot(world: World) {
  for (let cy = -4; cy <= 4; cy++) {
    for (let cx = -4; cx <= 4; cx++) {
      const spot = campfireInChunk(world, cx, cy);
      if (spot) return { spot, cx, cy };
    }
  }
  throw new Error('no campfire found');
}

describe('campfireInChunk', () => {
  it('is deterministic and places campfires on walkable ground inside their chunk', () => {
    const a = new World(1337);
    const b = new World(1337);
    let found = 0;
    for (let cy = -4; cy <= 4; cy++) {
      for (let cx = -4; cx <= 4; cx++) {
        const spot = campfireInChunk(a, cx, cy);
        expect(campfireInChunk(b, cx, cy)).toEqual(spot);
        if (!spot) continue;
        found++;
        const tx = Math.floor(spot.x / TILE_SIZE);
        const ty = Math.floor(spot.y / TILE_SIZE);
        expect(spot.id).toBe(`${tx},${ty}`);
        expect(Math.floor(tx / CHUNK_SIZE)).toBe(cx);
        expect(Math.floor(ty / CHUNK_SIZE)).toBe(cy);
        expect(a.isSolidAt(tx, ty)).toBe(false);
        expect(a.castleAt(tx, ty)).toBeNull();
      }
    }
    // Roughly CAMPFIRE_CHANCE of 81 chunks: some, but not every chunk.
    expect(found).toBeGreaterThan(81 * CAMPFIRE_CHANCE * 0.4);
    expect(found).toBeLessThan(81);
  });
});

describe('Campfires', () => {
  it('lights a campfire and moves the respawn point only when it changes', () => {
    const c = new Campfires();
    const a = { id: '1,1', x: 48, y: 48 };
    const b = { id: '5,1', x: 176, y: 48 };
    expect(c.rest(a)).toBe(true);
    expect(c.rest(a)).toBe(false);
    expect(c.lit.has('1,1')).toBe(true);
    expect(c.rest(b)).toBe(true);
    expect(c.respawn).toEqual({ x: 176, y: 48 });
    expect(c.lit.size).toBe(2);
  });

  it('wakes up on a walkable tile next to the respawn campfire', () => {
    const world = new World(1337);
    const c = new Campfires();
    expect(c.wakeTile(world)).toBeNull();
    const { spot } = firstSpot(world);
    c.rest(spot);
    const wake = c.wakeTile(world)!;
    expect(world.isSolidAt(wake.tx, wake.ty)).toBe(false);
    expect(Math.hypot((wake.tx + 0.5) * TILE_SIZE - spot.x, (wake.ty + 0.5) * TILE_SIZE - spot.y)).toBeLessThan(TILE_SIZE * 4);
  });

  it('round-trips through the save system and ignores junk', () => {
    const data = new Map<string, string>();
    const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: () => {} };
    const a = new Campfires();
    a.rest({ id: '3,4', x: 112, y: 144 });
    const saves = new SaveManager(store);
    saves.register('campfires', a);
    saves.save(1, { x: 0, y: 0 });

    const b = new Campfires();
    new SaveManager(store).register('campfires', b, new SaveManager(store).load());
    expect([...b.lit]).toEqual(['3,4']);
    expect(b.respawn).toEqual({ x: 112, y: 144 });

    const c = new Campfires();
    c.load({ lit: [1, '2,2', null], respawn: { x: 'a', y: 3 } });
    expect([...c.lit]).toEqual(['2,2']);
    expect(c.respawn).toBeNull();
    c.load(null);
    c.load('junk');
    expect([...c.lit]).toEqual(['2,2']);
  });
});

describe('Campfire', () => {
  it('is lit by walking up to it, which sets the respawn point', () => {
    const world = new World(1337);
    const { spot } = firstSpot(world);
    const campfires = new Campfires();
    const fire = new Campfire(spot, campfires, '0,0');
    const g = { world, player: new Player(spot.x + REST_RANGE * 2, spot.y), entities: [] } as unknown as Game;

    fire.update(0.1, g);
    expect(fire.lit).toBe(false);
    expect(campfireLights([fire])).toEqual([]);

    g.player.x = spot.x + REST_RANGE / 2;
    fire.update(0.1, g);
    expect(fire.lit).toBe(true);
    expect(campfires.respawn).toEqual({ x: spot.x, y: spot.y });
    expect(g.entities.some((e) => e instanceof RestPopup)).toBe(true);
    expect(campfireLights([fire])).toHaveLength(1);
  });

  it("can't be lit while the player has fainted", () => {
    const world = new World(1337);
    const { spot } = firstSpot(world);
    const campfires = new Campfires();
    const health = new Health();
    health.hurt(99);
    const g = { world, player: new Player(spot.x, spot.y), entities: [], health } as unknown as Game;
    new Campfire(spot, campfires, '0,0').update(0.1, g);
    expect(campfires.respawn).toBeNull();
  });
});

describe('CampfireSpawner', () => {
  it('keeps campfires present in the chunks around the player only', () => {
    const world = new World(1337);
    const { spot, cx } = firstSpot(world);
    const g = gameAt(spot.x, spot.y, new Campfires(), world);
    g.entities[0].update!(0, g);
    expect(fires(g).map((f) => f.spot.id)).toContain(spot.id);
    const count = fires(g).length;

    // Updating again doesn't duplicate anything.
    g.entities[0].update!(0, g);
    expect(fires(g)).toHaveLength(count);

    // Walk far away: the old campfire is removed.
    g.player.x = (cx + 10) * CHUNK_SIZE * TILE_SIZE;
    g.entities[0].update!(0, g);
    const old = fires(g).find((f) => f.spot.id === spot.id)!;
    expect(old.dead).toBe(true);
  });
});
