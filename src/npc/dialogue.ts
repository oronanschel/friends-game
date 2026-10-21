import { ITEM_INFO, type Inventory } from '../items/items';
import type { NpcDef } from './villagers';

/** One box of text; `trade` pages carry out the NPC's trade when confirmed. */
export interface Page {
  text: string;
  trade?: boolean;
}

/** Pages for a conversation: the NPC's lines, then a trade offer if they have one. */
export function pagesFor(def: NpcDef): Page[] {
  const pages: Page[] = def.lines.map((text) => ({ text }));
  if (def.trade) {
    const { give, get } = def.trade;
    const giveName = ITEM_INFO[give.kind].name.toLowerCase();
    const getName = ITEM_INFO[get.kind].name.toLowerCase();
    pages.push({ text: `Trade ${give.n} ${giveName} for ${get.n} ${getName}? (E: yes, Esc: no)`, trade: true });
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

  start(def: NpcDef): void {
    this.def = def;
    this.pages = pagesFor(def);
    this.index = 0;
  }

  close(): void {
    this.def = null;
    this.pages = [];
    this.index = 0;
  }

  /** Confirm the current page: go to the next one, trade, or close at the end. */
  advance(inventory: Inventory): void {
    const page = this.page;
    if (!page || !this.def) return;
    if (page.trade && this.def.trade) {
      const { give, get, thanks } = this.def.trade;
      let reply: string;
      if (inventory.take(give.kind, give.n)) {
        inventory.counts[get.kind] += get.n;
        reply = thanks;
      } else {
        const have = inventory.counts[give.kind];
        reply = `You only have ${have} ${ITEM_INFO[give.kind].name.toLowerCase()}. Come back with ${give.n}!`;
      }
      this.pages[this.index] = { text: reply };
      return;
    }
    if (this.index + 1 < this.pages.length) this.index += 1;
    else this.close();
  }
}
