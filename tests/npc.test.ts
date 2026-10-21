import { describe, expect, it } from 'vitest';
import type { Game } from '../src/game';
import { Inventory, ItemKind } from '../src/items/items';
import { Dialogue, pagesFor } from '../src/npc/dialogue';
import { NPC, Npc } from '../src/npc/npc';
import { TALK_RANGE, TalkController, nearestNpc } from '../src/npc/talk';
import { VILLAGERS, type NpcDef } from '../src/npc/villagers';
import { Player } from '../src/player/player';
import { Tile } from '../src/world/tiles';
import { TILE_SIZE, type World } from '../src/world/world';

/** Open grass with a wall at tile x = 5. */
function fakeWorld(): World {
  return { seed: 1, getTile: () => Tile.Grass, isSolidAt: (tx: number) => tx === 5 } as unknown as World;
}

function gameWith(entities: Npc[], px = -10_000, py = 0): Game {
  return { world: fakeWorld(), player: new Player(px, py), entities, inventory: new Inventory() } as unknown as Game;
}

const trader: NpcDef = {
  name: 'Tess',
  color: '#fff',
  home: { dx: 0, dy: 0 },
  lines: ['Hello!'],
  trade: { give: { kind: ItemKind.Berry, n: 3 }, get: { kind: ItemKind.Coin, n: 2 }, thanks: 'Thanks!' },
};

describe('Npc', () => {
  it('never walks into solid tiles', () => {
    const npc = new Npc(4 * TILE_SIZE, 0, VILLAGERS[0], 3);
    const game = gameWith([npc]);
    for (let t = 0; t < 60; t += 1 / 60) {
      npc.update(1 / 60, game);
      expect(npc.collides(npc.x, npc.y, game.world)).toBe(false);
    }
  });

  it('stays near home', () => {
    const npc = new Npc(-50 * TILE_SIZE, 0, VILLAGERS[1], 9);
    const game = gameWith([npc], 0, 0);
    let farthest = 0;
    for (let t = 0; t < 120; t += 1 / 60) {
      npc.update(1 / 60, game);
      farthest = Math.max(farthest, Math.hypot(npc.x - npc.homeX, npc.y - npc.homeY));
    }
    // It may overshoot the leash a little before it turns back.
    expect(farthest).toBeLessThan(NPC.leash + 3 * NPC.speed);
  });

  it('walks back home when far away', () => {
    const npc = new Npc(-50 * TILE_SIZE, 0, VILLAGERS[1], 9, -30 * TILE_SIZE, 0);
    npc.chooseDirection();
    expect(npc.dir.x).toBeGreaterThan(0.9);
  });

  it('stands still and faces the player while talking', () => {
    const npc = new Npc(-100, 0, VILLAGERS[0], 1);
    npc.talking = true;
    const game = gameWith([npc], -200, 0);
    npc.update(1, game);
    expect(npc.x).toBe(-100);
    expect(npc.facingLeft).toBe(true);
  });
});

describe('Dialogue', () => {
  it('pages through lines and closes at the end', () => {
    const d = new Dialogue();
    d.start(VILLAGERS[1]);
    const inv = new Inventory();
    for (const line of VILLAGERS[1].lines) {
      expect(d.page?.text).toBe(line);
      d.advance(inv);
    }
    expect(d.open).toBe(false);
  });

  it('adds a trade offer after the lines', () => {
    const pages = pagesFor(trader);
    expect(pages).toHaveLength(2);
    expect(pages[1].trade).toBe(true);
    expect(pages[1].text).toContain('3 berries');
  });

  it('trades when the player has enough', () => {
    const d = new Dialogue();
    const inv = new Inventory();
    inv.counts.berry = 4;
    d.start(trader);
    d.advance(inv); // past "Hello!"
    d.advance(inv); // accept
    expect(inv.counts.berry).toBe(1);
    expect(inv.counts.coin).toBe(2);
    expect(d.page?.text).toBe('Thanks!');
    d.advance(inv);
    expect(d.open).toBe(false);
  });

  it('refuses the trade without enough items', () => {
    const d = new Dialogue();
    const inv = new Inventory();
    inv.counts.berry = 1;
    d.start(trader);
    d.advance(inv);
    d.advance(inv);
    expect(inv.counts.berry).toBe(1);
    expect(inv.counts.coin).toBe(0);
    expect(d.page?.text).toContain('only have 1');
  });
});

describe('TalkController', () => {
  const noEvents = { addEventListener: () => {} } as unknown as Window;

  it('finds the nearest NPC in range', () => {
    const near = new Npc(0, TALK_RANGE - 5, VILLAGERS[0]);
    const nearer = new Npc(10, 0, VILLAGERS[1]);
    const far = new Npc(TALK_RANGE * 3, 0, VILLAGERS[2]);
    expect(nearestNpc(gameWith([near, nearer, far], 0, 0))).toBe(nearer);
    expect(nearestNpc(gameWith([far], 0, 0))).toBeNull();
  });

  it('starts, advances and ends a conversation', () => {
    const npc = new Npc(10, 0, VILLAGERS[1]);
    const game = gameWith([npc], 0, 0);
    const talk = new TalkController(noEvents);
    talk.update(game);
    expect(talk.target).toBe(npc);
    talk.press('confirm');
    talk.update(game);
    expect(talk.busy).toBe(true);
    expect(npc.talking).toBe(true);
    talk.press('cancel');
    talk.update(game);
    expect(talk.busy).toBe(false);
    expect(npc.talking).toBe(false);
  });

  it('ends the conversation when the player walks away', () => {
    const npc = new Npc(10, 0, VILLAGERS[1]);
    const game = gameWith([npc], 0, 0);
    const talk = new TalkController(noEvents);
    talk.update(game);
    talk.press('confirm');
    talk.update(game);
    game.player.x = TALK_RANGE * 5;
    talk.update(game);
    expect(talk.busy).toBe(false);
  });
});
