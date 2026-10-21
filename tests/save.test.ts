import { describe, expect, it } from 'vitest';
import { type KeyValueStore, SaveManager, chooseStart } from '../src/save/save';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('SaveManager', () => {
  it('round-trips seed, player and registered state', () => {
    const store = memoryStore();
    const a = new SaveManager(store);
    let coins = 7;
    a.register('coins', { save: () => coins, load: (d) => (coins = d as number) });
    a.save(42, { x: 10, y: -5 });

    const b = new SaveManager(store);
    const loaded = b.load();
    expect(loaded?.seed).toBe(42);
    expect(loaded?.player).toEqual({ x: 10, y: -5 });
    coins = 0;
    b.register('coins', { save: () => coins, load: (d) => (coins = d as number) }, loaded);
    expect(coins).toBe(7);
  });

  it('returns null for missing or corrupt saves', () => {
    const store = memoryStore();
    const m = new SaveManager(store);
    expect(m.load()).toBeNull();
    store.setItem('friends-game-save', '{not json');
    expect(m.load()).toBeNull();
    store.setItem('friends-game-save', JSON.stringify({ version: 1, seed: 'x', player: {} }));
    expect(m.load()).toBeNull();
  });

  it('survives storage that throws', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    const m = new SaveManager(broken);
    expect(() => m.save(1, { x: 0, y: 0 })).not.toThrow();
    expect(m.load()).toBeNull();
    expect(() => m.clear()).not.toThrow();
  });
});

describe('chooseStart', () => {
  const saved = { version: 1 as const, seed: 5, player: { x: 1, y: 2 }, extra: {}, savedAt: 0 };
  const p = (q: string) => new URLSearchParams(q);

  it('continues the saved world by default', () => {
    expect(chooseStart(p(''), saved, 1337)).toEqual({ seed: 5, resume: saved });
    expect(chooseStart(p(''), null, 1337)).toEqual({ seed: 1337, resume: null });
  });

  it('honours ?seed, resuming only a matching save', () => {
    expect(chooseStart(p('seed=5'), saved, 1337).resume).toBe(saved);
    expect(chooseStart(p('seed=9'), saved, 1337)).toEqual({ seed: 9, resume: null });
  });

  it('?new starts a fresh random world', () => {
    expect(chooseStart(p('new'), saved, 1337, () => 0.5)).toEqual({ seed: 2 ** 30, resume: null });
  });
});
