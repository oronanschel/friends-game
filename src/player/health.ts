import { type Inventory, ItemKind } from '../items/items';

export const MAX_HEARTS = 5;
/** Seconds of protection after taking a hit. */
export const INVULNERABLE_TIME = 1.5;
/** Seconds the "You fainted" screen shows before waking up at spawn. */
export const FAINT_TIME = 2.5;

/** Player hearts: berries and fairies heal, at zero you faint and wake up at spawn. */
export class Health {
  hearts = MAX_HEARTS;
  /** Seconds of invulnerability left after a hit. */
  invulnerable = 0;
  /** Seconds left on the faint screen; 0 when awake. */
  fainted = 0;
  /** Seconds since the last hit (for the red flash). */
  sinceHit = Infinity;

  get awake(): boolean {
    return this.fainted <= 0;
  }

  /** Take damage. Returns true if it landed (not while protected or fainted). */
  hurt(n = 1): boolean {
    if (this.invulnerable > 0 || !this.awake) return false;
    this.hearts = Math.max(0, this.hearts - n);
    this.invulnerable = INVULNERABLE_TIME;
    this.sinceHit = 0;
    if (this.hearts === 0) this.fainted = FAINT_TIME;
    return true;
  }

  /** Restore hearts. Returns false if already full or fainted. */
  heal(n = 1): boolean {
    if (this.hearts >= MAX_HEARTS || !this.awake) return false;
    this.hearts = Math.min(MAX_HEARTS, this.hearts + n);
    return true;
  }

  /** Advance timers. Returns true on the frame the player wakes up from fainting. */
  update(dt: number): boolean {
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.sinceHit += dt;
    if (this.fainted > 0) {
      this.fainted -= dt;
      if (this.fainted <= 0) {
        this.fainted = 0;
        this.hearts = MAX_HEARTS;
        this.invulnerable = INVULNERABLE_TIME;
        return true;
      }
    }
    return false;
  }

  save(): unknown {
    return { hearts: this.hearts };
  }

  load(data: unknown): void {
    const h = (data as { hearts?: unknown } | null)?.hearts;
    // A save made while fainted wakes up with full hearts.
    if (typeof h === 'number' && Number.isFinite(h)) this.hearts = Math.min(MAX_HEARTS, Math.max(1, Math.floor(h)));
  }
}

/** Eat one berry to restore a heart. Returns false if hearts are full or there are no berries. */
export function eatBerry(health: Health, inventory: Inventory): boolean {
  if (health.hearts >= MAX_HEARTS || !health.awake || inventory.counts[ItemKind.Berry] < 1) return false;
  inventory.take(ItemKind.Berry);
  return health.heal();
}
