import { hash2 } from '../world/noise';
import { Tile } from '../world/tiles';
import { CHUNK_SIZE, TILE_SIZE, type World } from '../world/world';

export enum ItemKind {
  Coin = 'coin',
  Berry = 'berry',
  Mushroom = 'mushroom',
  Gem = 'gem',
  /** Caught by fishing (see `src/fishing/`), never found lying around. */
  Fish = 'fish',
}

export interface ItemInfo {
  name: string;
  /** Tiles this item can appear on. */
  tiles: Tile[];
  /** Chance per candidate tile. */
  chance: number;
}

export const ITEM_INFO: Record<ItemKind, ItemInfo> = {
  [ItemKind.Coin]: { name: 'Coins', tiles: [Tile.Grass, Tile.Sand, Tile.Forest, Tile.Taiga, Tile.Snow], chance: 0.004 },
  [ItemKind.Berry]: { name: 'Berries', tiles: [Tile.Grass, Tile.Forest], chance: 0.006 },
  [ItemKind.Mushroom]: { name: 'Mushrooms', tiles: [Tile.Forest, Tile.Taiga], chance: 0.008 },
  [ItemKind.Gem]: { name: 'Gems', tiles: [Tile.Sand, Tile.Snow], chance: 0.004 },
  [ItemKind.Fish]: { name: 'Fish', tiles: [], chance: 0 },
};

/** Order items are listed in the HUD. */
export const ITEM_ORDER: ItemKind[] = [ItemKind.Coin, ItemKind.Berry, ItemKind.Mushroom, ItemKind.Gem, ItemKind.Fish];

export interface ItemSpot {
  /** Stable id (the tile it sits on), used to remember it was collected. */
  id: string;
  kind: ItemKind;
  x: number;
  y: number;
}

const SALT = 0x17e45;

/** Every item in a chunk, chosen deterministically from the world seed. */
export function itemsInChunk(world: World, cx: number, cy: number): ItemSpot[] {
  const spots: ItemSpot[] = [];
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const tx = cx * CHUNK_SIZE + lx;
      const ty = cy * CHUNK_SIZE + ly;
      const tile = world.getTile(tx, ty);
      let r = hash2(tx, ty, world.seed ^ SALT);
      for (const kind of ITEM_ORDER) {
        const info = ITEM_INFO[kind];
        if (!info.tiles.includes(tile)) continue;
        if (r < info.chance) {
          if (!world.isSolidAt(tx, ty)) {
            spots.push({ id: `${tx},${ty}`, kind, x: (tx + 0.5) * TILE_SIZE, y: (ty + 0.5) * TILE_SIZE });
          }
          break;
        }
        r -= info.chance;
      }
    }
  }
  return spots;
}

/** What the player has collected, plus which world items are already gone. */
export class Inventory {
  counts: Record<ItemKind, number> = { coin: 0, berry: 0, mushroom: 0, gem: 0, fish: 0 };
  /** Ids of collected item spots, so they don't respawn. */
  collected = new Set<string>();
  /** Last item picked up and when (for a HUD highlight). */
  lastPickup: { kind: ItemKind; at: number } | null = null;

  add(kind: ItemKind, id: string, now = 0): void {
    this.counts[kind] += 1;
    this.collected.add(id);
    this.lastPickup = { kind, at: now };
  }

  /** Remove `n` of an item, e.g. to trade or craft. Returns false if there aren't enough. */
  take(kind: ItemKind, n = 1): boolean {
    if (this.counts[kind] < n) return false;
    this.counts[kind] -= n;
    return true;
  }

  save(): unknown {
    return { counts: this.counts, collected: [...this.collected] };
  }

  load(data: unknown): void {
    const d = data as { counts?: Record<string, unknown>; collected?: unknown } | null;
    if (!d || typeof d !== 'object') return;
    for (const kind of ITEM_ORDER) {
      const n = d.counts?.[kind];
      if (typeof n === 'number' && Number.isFinite(n) && n >= 0) this.counts[kind] = Math.floor(n);
    }
    if (Array.isArray(d.collected)) {
      this.collected = new Set(d.collected.filter((x): x is string => typeof x === 'string'));
    }
  }
}
