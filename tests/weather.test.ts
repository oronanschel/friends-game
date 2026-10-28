import { describe, expect, it } from 'vitest';
import { Camera } from '../src/engine/camera';
import { SPELL_S, WET_CHANCE, Weather, parseWeather, precipFor, wetnessAt } from '../src/weather/weather';
import { Tile } from '../src/world/tiles';

/** A tiny seeded random generator so drop positions are repeatable. */
function rng(seed = 1): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

describe('wetnessAt', () => {
  it('is deterministic, stays in [0, 1], and is wet for roughly WET_CHANCE of the spells', () => {
    let wet = 0;
    const spells = 200;
    for (let i = 0; i < spells; i++) {
      const mid = (i + 0.5) * SPELL_S;
      const w = wetnessAt(mid, 1337);
      expect(wetnessAt(mid, 1337)).toBe(w);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
      if (w > 0) wet++;
    }
    expect(wet / spells).toBeGreaterThan(WET_CHANCE * 0.5);
    expect(wet / spells).toBeLessThan(WET_CHANCE * 1.5);
  });

  it('fades in and out instead of switching at once', () => {
    let last = wetnessAt(0, 1337);
    for (let t = 0.5; t < SPELL_S * 20; t += 0.5) {
      const w = wetnessAt(t, 1337);
      expect(Math.abs(w - last)).toBeLessThan(0.05);
      last = w;
    }
  });
});

describe('precipFor and parseWeather', () => {
  it('snows on snowy and pine ground and rains elsewhere', () => {
    expect(precipFor(Tile.Snow)).toBe('snow');
    expect(precipFor(Tile.Taiga)).toBe('snow');
    expect(precipFor(Tile.Grass)).toBe('rain');
    expect(precipFor(Tile.Sand)).toBe('rain');
  });

  it('accepts only known weather names from the URL', () => {
    expect(parseWeather('rain')).toBe('rain');
    expect(parseWeather('clear')).toBe('clear');
    expect(parseWeather('hail')).toBeUndefined();
    expect(parseWeather(null)).toBeUndefined();
  });
});

describe('Weather', () => {
  it('builds up to full rain when forced, keeping drops on screen', () => {
    const cam = new Camera(800, 600);
    const w = new Weather(1, 'rain', rng());
    for (let i = 0; i < 300; i++) {
      cam.x += 3; // walking right
      w.update(1 / 60, Tile.Grass, cam);
    }
    expect(w.intensity).toBeGreaterThan(0.95);
    expect(w.kind).toBe('rain');
    expect(w.label).toBe('rain');
    expect(w.drops.length).toBeGreaterThan(150);
    for (const d of w.drops) {
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.x).toBeLessThan(800);
      expect(d.y).toBeGreaterThanOrEqual(0);
      expect(d.y).toBeLessThan(600);
    }
  });

  it('follows the ground: snow over snowy tiles unless a kind is forced', () => {
    const cam = new Camera(800, 600);
    const natural = new Weather(1, undefined, rng());
    natural.update(0.1, Tile.Snow, cam);
    expect(natural.kind).toBe('snow');
    const forced = new Weather(1, 'rain', rng());
    forced.update(0.1, Tile.Snow, cam);
    expect(forced.kind).toBe('rain');
  });

  it('clears up completely when forced clear', () => {
    const cam = new Camera(800, 600);
    const w = new Weather(1, 'clear', rng());
    w.intensity = 1;
    for (let i = 0; i < 600; i++) w.update(1 / 60, Tile.Grass, cam);
    expect(w.intensity).toBe(0);
    expect(w.drops).toHaveLength(0);
    expect(w.label).toBe('');
  });

  it('survives a zero-length frame', () => {
    const cam = new Camera(800, 600);
    const w = new Weather(1, 'snow', rng());
    w.intensity = 1;
    w.update(0, Tile.Snow, cam);
    w.update(0, Tile.Snow, cam);
    for (const d of w.drops) expect(Number.isFinite(d.x) && Number.isFinite(d.y)).toBe(true);
  });
});
