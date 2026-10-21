/** Minimal subset of the Web Storage API, so tests can pass a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Something that wants its state saved: inventory, NPCs, quests, ... */
export interface Saveable {
  save(): unknown;
  load(data: unknown): void;
}

export interface SaveData {
  version: 1;
  seed: number;
  player: { x: number; y: number };
  /** State from registered saveables, by key. */
  extra: Record<string, unknown>;
  savedAt: number;
}

export const SAVE_KEY = 'friends-game-save';

/** Saves the world seed, player position and registered feature state to storage. */
export class SaveManager {
  private saveables = new Map<string, Saveable>();

  constructor(private store: KeyValueStore, private key = SAVE_KEY) {}

  /**
   * Register feature state to persist under `key`. If a save was already
   * loaded, `load` is called right away with that feature's saved data.
   */
  register(key: string, saveable: Saveable, loaded: SaveData | null = null): void {
    this.saveables.set(key, saveable);
    if (loaded && key in loaded.extra) saveable.load(loaded.extra[key]);
  }

  save(seed: number, player: { x: number; y: number }, now = Date.now()): SaveData {
    const extra: Record<string, unknown> = {};
    for (const [k, s] of this.saveables) extra[k] = s.save();
    const data: SaveData = { version: 1, seed, player: { x: player.x, y: player.y }, extra, savedAt: now };
    try {
      this.store.setItem(this.key, JSON.stringify(data));
    } catch {
      // Storage full or disabled (e.g. private mode): the game still works, just without saving.
    }
    return data;
  }

  /** The saved game, or null if there is none or it is unreadable. */
  load(): SaveData | null {
    let raw: string | null;
    try {
      raw = this.store.getItem(this.key);
    } catch {
      return null;
    }
    if (!raw) return null;
    try {
      const d = JSON.parse(raw);
      if (
        d?.version !== 1 ||
        !Number.isFinite(d.seed) ||
        !Number.isFinite(d.player?.x) ||
        !Number.isFinite(d.player?.y)
      ) {
        return null;
      }
      return { ...d, extra: d.extra && typeof d.extra === 'object' ? d.extra : {} };
    } catch {
      return null;
    }
  }

  clear(): void {
    try {
      this.store.removeItem(this.key);
    } catch {
      // Ignore: nothing to clear.
    }
  }
}

/**
 * Decide which world to start from URL params and an existing save.
 * - `?new` starts a fresh random world.
 * - `?seed=N` opens world N (keeping the save only if it is for N).
 * - Otherwise continue the saved world, or the default world.
 */
export function chooseStart(
  params: URLSearchParams,
  saved: SaveData | null,
  defaultSeed: number,
  random: () => number = Math.random,
): { seed: number; resume: SaveData | null } {
  if (params.has('new')) return { seed: Math.floor(random() * 2 ** 31), resume: null };
  const seedParam = params.get('seed');
  if (seedParam !== null) {
    const seed = Number(seedParam) | 0;
    return { seed, resume: saved && saved.seed === seed ? saved : null };
  }
  if (saved) return { seed: saved.seed, resume: saved };
  return { seed: defaultSeed, resume: null };
}
