import { describe, expect, it } from 'vitest';
import { Inventory, ItemKind } from '../src/items/items';
import { Dialogue, pagesFor } from '../src/npc/dialogue';
import { type Quest, QuestLog } from '../src/npc/quests';
import { VILLAGERS, type NpcDef } from '../src/npc/villagers';

const quest: Quest = {
  id: 'test-mushrooms',
  title: 'Soup',
  want: { kind: ItemKind.Mushroom, n: 3 },
  reward: { kind: ItemKind.Coin, n: 4 },
  ask: 'Bring 3 mushrooms?',
  thanks: 'Yum!',
};

const giver: NpcDef = { name: 'Gia', color: '#fff', home: { dx: 0, dy: 0 }, lines: ['Hi!'], quest };

describe('QuestLog', () => {
  it('accepts, tracks and completes a quest', () => {
    const log = new QuestLog([quest]);
    const inv = new Inventory();
    expect(log.statusOf(quest)).toBe('new');
    log.accept(quest);
    expect(log.statusOf(quest)).toBe('active');
    expect(log.active).toEqual([quest]);
    inv.counts.mushroom = 2;
    expect(log.complete(quest, inv)).toBe(false);
    inv.counts.mushroom = 5;
    expect(log.complete(quest, inv)).toBe(true);
    expect(inv.counts.mushroom).toBe(2);
    expect(inv.counts.coin).toBe(4);
    expect(log.statusOf(quest)).toBe('done');
    expect(log.active).toEqual([]);
  });

  it('cannot be completed twice', () => {
    const log = new QuestLog([quest]);
    const inv = new Inventory();
    inv.counts.mushroom = 10;
    log.accept(quest);
    log.complete(quest, inv);
    log.accept(quest);
    expect(log.complete(quest, inv)).toBe(false);
    expect(inv.counts.coin).toBe(4);
  });

  it('round-trips through save and load', () => {
    const log = new QuestLog([quest]);
    log.accept(quest);
    const restored = new QuestLog([quest]);
    restored.load(JSON.parse(JSON.stringify(log.save())));
    expect(restored.statusOf(quest)).toBe('active');
    expect(restored.active).toEqual([quest]);
  });

  it('ignores bad save data', () => {
    const log = new QuestLog([quest]);
    log.load({ [quest.id]: 'bogus', other: 42 });
    expect(log.statusOf(quest)).toBe('new');
    log.load(null);
    expect(log.active).toEqual([]);
  });
});

describe('Quest dialogue', () => {
  it('offers a new quest after the lines', () => {
    const pages = pagesFor(giver, new QuestLog([quest]), new Inventory());
    expect(pages.map((p) => p.action)).toEqual([undefined, 'accept']);
  });

  it('accepts, reminds, then completes through conversation', () => {
    const log = new QuestLog([quest]);
    const inv = new Inventory();
    const d = new Dialogue();

    d.start(giver, log, inv);
    d.advance(inv, log); // "Hi!"
    d.advance(inv, log); // accept
    expect(log.statusOf(quest)).toBe('active');
    d.advance(inv, log);
    expect(d.open).toBe(false);

    inv.counts.mushroom = 1;
    d.start(giver, log, inv);
    expect(d.page?.text).toContain('still need 2 mushrooms');

    inv.counts.mushroom = 3;
    d.start(giver, log, inv);
    expect(d.page?.action).toBe('complete');
    d.advance(inv, log);
    expect(d.page?.text).toBe('Yum!');
    expect(inv.counts.coin).toBe(4);
    expect(log.statusOf(quest)).toBe('done');

    // Once done, the villager is back to their usual lines.
    d.start(giver, log, inv);
    expect(d.page?.text).toBe('Hi!');
  });

  it('declining leaves the quest open for later', () => {
    const log = new QuestLog([quest]);
    const d = new Dialogue();
    d.start(giver, log, new Inventory());
    d.close();
    expect(log.statusOf(quest)).toBe('new');
  });

  it('at least two villagers give quests with unique ids', () => {
    const ids = VILLAGERS.flatMap((v) => (v.quest ? [v.quest.id] : []));
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
