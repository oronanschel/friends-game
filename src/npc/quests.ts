import { ITEM_INFO, type Inventory, type ItemKind } from '../items/items';

/** A one-time "bring me items" request from a villager. */
export interface Quest {
  /** Stable id, used in the save. */
  id: string;
  /** Short title for the on-screen tracker. */
  title: string;
  want: { kind: ItemKind; n: number };
  reward: { kind: ItemKind; n: number };
  /** What the villager asks. */
  ask: string;
  /** What they say when you hand the items over. */
  thanks: string;
}

export type QuestStatus = 'new' | 'active' | 'done';

/** Lower-case item name, e.g. "3 mushrooms". */
export function amount(kind: ItemKind, n: number): string {
  return `${n} ${ITEM_INFO[kind].name.toLowerCase()}`;
}

/** Which quests the player has accepted or finished. Saved with `game.saves`. */
export class QuestLog {
  private status = new Map<string, QuestStatus>();
  /** Accepted, unfinished quests in the order they were accepted. */
  active: Quest[] = [];

  /** `known` lists every quest, so active ones can be tracked again after loading a save. */
  constructor(private known: Quest[] = []) {}

  statusOf(quest: Quest): QuestStatus {
    return this.status.get(quest.id) ?? 'new';
  }

  accept(quest: Quest): void {
    if (this.statusOf(quest) !== 'new') return;
    this.status.set(quest.id, 'active');
    this.active.push(quest);
  }

  /** Whether the player carries enough to finish an active quest. */
  ready(quest: Quest, inventory: Inventory): boolean {
    return this.statusOf(quest) === 'active' && inventory.counts[quest.want.kind] >= quest.want.n;
  }

  /** Hand over the items and collect the reward. Returns false if not ready. */
  complete(quest: Quest, inventory: Inventory): boolean {
    if (!this.ready(quest, inventory)) return false;
    inventory.take(quest.want.kind, quest.want.n);
    inventory.counts[quest.reward.kind] += quest.reward.n;
    this.status.set(quest.id, 'done');
    this.active = this.active.filter((q) => q.id !== quest.id);
    return true;
  }

  save(): unknown {
    return Object.fromEntries(this.status);
  }

  /** Restore statuses; ids of quests that no longer exist are kept but not tracked. */
  load(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    this.status.clear();
    this.active = [];
    for (const [id, s] of Object.entries(data as Record<string, unknown>)) {
      if (s !== 'active' && s !== 'done') continue;
      this.status.set(id, s);
      const quest = this.known.find((q) => q.id === id);
      if (s === 'active' && quest) this.active.push(quest);
    }
  }
}
