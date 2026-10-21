import { type Inventory } from '../items/items';
import { type QuestLog, amount } from './quests';
import type { NpcDef } from './villagers';

/** What confirming a page does besides moving on. */
export type PageAction = 'trade' | 'accept' | 'complete';

/** One box of text; pages with an action carry it out when confirmed. */
export interface Page {
  text: string;
  action?: PageAction;
}

/**
 * Pages for a conversation. A villager with an unfinished quest talks about it first;
 * otherwise you hear their lines, then their trade offer if they have one.
 */
export function pagesFor(def: NpcDef, quests?: QuestLog, inventory?: Inventory): Page[] {
  const quest = def.quest;
  const status = quest && quests ? quests.statusOf(quest) : 'done';
  if (quest && status === 'new') {
    return [...def.lines.map((text) => ({ text })), { text: `${quest.ask} (E: accept, Esc: not now)`, action: 'accept' }];
  }
  const pages: Page[] = [];
  if (quest && quests && inventory && status === 'active') {
    const have = inventory.counts[quest.want.kind];
    if (quests.ready(quest, inventory)) {
      pages.push({ text: `You found ${amount(quest.want.kind, quest.want.n)}! (E: hand them over)`, action: 'complete' });
    } else {
      pages.push({ text: `Any luck? I still need ${amount(quest.want.kind, quest.want.n - have)}.` });
    }
  } else {
    pages.push(...def.lines.map((text) => ({ text })));
  }
  if (def.trade) {
    const { give, get } = def.trade;
    pages.push({
      text: `Trade ${amount(give.kind, give.n)} for ${amount(get.kind, get.n)}? (E: yes, Esc: no)`,
      action: 'trade',
    });
  }
  return pages;
}

/**
 * The open conversation, if any. Pure logic (no drawing or input) so it is easy to test.
 */
export class Dialogue {
  def: NpcDef | null = null;
  pages: Page[] = [];
  index = 0;

  get open(): boolean {
    return this.def !== null;
  }

  get page(): Page | null {
    return this.def ? this.pages[this.index] : null;
  }

  start(def: NpcDef, quests?: QuestLog, inventory?: Inventory): void {
    this.def = def;
    this.pages = pagesFor(def, quests, inventory);
    this.index = 0;
  }

  close(): void {
    this.def = null;
    this.pages = [];
    this.index = 0;
  }

  /** Confirm the current page: carry out its action, go to the next page, or close at the end. */
  advance(inventory: Inventory, quests?: QuestLog): void {
    const page = this.page;
    const def = this.def;
    if (!page || !def) return;
    if (page.action === 'trade' && def.trade) {
      const { give, get, thanks } = def.trade;
      let reply: string;
      if (inventory.take(give.kind, give.n)) {
        inventory.counts[get.kind] += get.n;
        reply = thanks;
      } else {
        reply = `You only have ${amount(give.kind, inventory.counts[give.kind])}. Come back with ${give.n}!`;
      }
      this.pages[this.index] = { text: reply };
      return;
    }
    if (page.action === 'accept' && def.quest && quests) {
      quests.accept(def.quest);
      this.pages[this.index] = { text: `Thank you! Come back when you have ${amount(def.quest.want.kind, def.quest.want.n)}.` };
      return;
    }
    if (page.action === 'complete' && def.quest && quests) {
      quests.complete(def.quest, inventory);
      this.pages[this.index] = { text: def.quest.thanks };
      return;
    }
    if (this.index + 1 < this.pages.length) this.index += 1;
    else this.close();
  }
}
