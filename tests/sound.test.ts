import { describe, expect, it } from 'vitest';
import { StepCounter, falloff, footstepFor } from '../src/audio/sound';
import { Tile } from '../src/world/tiles';

describe('sound helpers', () => {
  it('sounds a footstep once per stride', () => {
    const s = new StepCounter(20);
    const steps = [5, 5, 5, 5, 5, 5, 5, 5].map((d) => s.advance(d));
    expect(steps.filter(Boolean)).toHaveLength(2);
    expect(steps[3]).toBe(true);
  });

  it('fades distant sounds to silence', () => {
    expect(falloff(0)).toBe(1);
    expect(falloff(300, 600)).toBeCloseTo(0.25);
    expect(falloff(1000, 600)).toBe(0);
  });

  it('gives sand and snow different footsteps from grass', () => {
    expect(footstepFor(Tile.Sand)!.freq).not.toBe(footstepFor(Tile.Grass)!.freq);
    expect(footstepFor(Tile.Snow)!.freq).not.toBe(footstepFor(Tile.Grass)!.freq);
  });
});
