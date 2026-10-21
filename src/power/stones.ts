import { hash2 } from '../world/noise';
import { CHUNK_SIZE, TILE_SIZE, type World } from '../world/world';

export enum StoneKind {
  Swift = 'swift',
  Magnet = 'magnet',
  Ward = 'ward',
}

export interface StoneInfo {
  name: string;
  /** What using it does, for the HUD. */
  effect: string;
  /** Key that uses it. */
  key: string;
  /** How long the power lasts, in seconds. */
  duration: number;
  color: string;
  glow: string;
}

export const STONE_INFO: Record<StoneKind, StoneInfo> = {
  [StoneKind.Swift]: { name: 'Swift stone', effect: 'Run faster', key: '1', duration: 12, color: '#ff8a1f', glow: '255,170,60' },
  [StoneKind.Magnet]: { name: 'Magnet stone', effect: 'Pull in items', key: '2', duration: 15, color: '#b04dff', glow: '200,120,255' },
  [StoneKind.Ward]: { name: 'Lion ward', effect: 'Lions keep away', key: '3', duration: 15, color: '#3fa9ff', glow: '120,200,255' },
};

export const STONE_ORDER: StoneKind[] = [StoneKind.Swift, StoneKind.Magnet, StoneKind.Ward];

/** Speed multiplier while the Swift stone is active. */
export const SWIFT_MULTIPLIER = 1.6;
/** Chance per walkable tile that a power stone lies there (one or two per chunk). */
export const STONE_CHANCE = 0.002;

export interface StoneSpot {
  /** Stable id, used to remember it was collected. */
  id: string;
  kind: StoneKind;
  x: number;
  y: number;
}

const SALT = 0x5703e;
const KIND_SALT = 0x2b1d9;

/** Every power stone in a chunk, chosen deterministically from the world seed. */
export function stonesInChunk(world: World, cx: number, cy: number): StoneSpot[] {
  const spots: StoneSpot[] = [];
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const tx = cx * CHUNK_SIZE + lx;
      const ty = cy * CHUNK_SIZE + ly;
      const r = hash2(tx, ty, world.seed ^ SALT);
      if (r >= STONE_CHANCE || world.isSolidAt(tx, ty)) continue;
      // A second roll picks the kind, so each kind is equally likely everywhere.
      const kind = STONE_ORDER[Math.floor(hash2(ty, tx, world.seed ^ KIND_SALT) * STONE_ORDER.length)];
      spots.push({ id: `stone:${tx},${ty}`, kind, x: (tx + 0.5) * TILE_SIZE, y: (ty + 0.5) * TILE_SIZE });
    }
  }
  return spots;
}

/** Power stones the player carries, which powers are active, and which stones are gone from the world. */
export class PowerStones {
  counts: Record<StoneKind, number> = { swift: 0, magnet: 0, ward: 0 };
  /** Seconds left for each active power (0 = off). */
  active: Record<StoneKind, number> = { swift: 0, magnet: 0, ward: 0 };
  collected = new Set<string>();
  /** Last stone picked up or used and when, in ms (for a HUD highlight). */
  lastChange: { kind: StoneKind; at: number } | null = null;

  add(kind: StoneKind, id: string, now = 0): void {
    this.counts[kind] += 1;
    this.collected.add(id);
    this.lastChange = { kind, at: now };
  }

  /** Spend one stone to start (or restart) its power. Returns false if none are left. */
  use(kind: StoneKind, now = 0): boolean {
    if (this.counts[kind] < 1) return false;
    this.counts[kind] -= 1;
    this.active[kind] = STONE_INFO[kind].duration;
    this.lastChange = { kind, at: now };
    return true;
  }

  isActive(kind: StoneKind): boolean {
    return this.active[kind] > 0;
  }

  update(dt: number): void {
    for (const kind of STONE_ORDER) this.active[kind] = Math.max(0, this.active[kind] - dt);
  }

  get speedMultiplier(): number {
    return this.isActive(StoneKind.Swift) ? SWIFT_MULTIPLIER : 1;
  }

  save(): unknown {
    return { counts: this.counts, active: this.active, collected: [...this.collected] };
  }

  load(data: unknown): void {
    const d = data as { counts?: Record<string, unknown>; active?: Record<string, unknown>; collected?: unknown } | null;
    if (!d || typeof d !== 'object') return;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
    for (const kind of STONE_ORDER) {
      const n = num(d.counts?.[kind]);
      if (n !== null) this.counts[kind] = Math.floor(n);
      const a = num(d.active?.[kind]);
      if (a !== null) this.active[kind] = Math.min(a, STONE_INFO[kind].duration);
    }
    if (Array.isArray(d.collected)) {
      this.collected = new Set(d.collected.filter((x): x is string => typeof x === 'string'));
    }
  }
}
