import { describe, expect, it } from 'vitest';
import { DAY_LENGTH_S, DayNight, clockLabel, lightStrength, phaseOf, tintAt } from '../src/ui/daynight';

const atHour = (h: number) => h / 24;

describe('day/night', () => {
  it('names the phase of the day', () => {
    expect(phaseOf(atHour(2))).toBe('night');
    expect(phaseOf(atHour(6))).toBe('dawn');
    expect(phaseOf(atHour(12))).toBe('day');
    expect(phaseOf(atHour(18))).toBe('dusk');
    expect(phaseOf(atHour(22))).toBe('night');
  });

  it('formats the clock and wraps past midnight', () => {
    expect(clockLabel(0)).toBe('00:00');
    expect(clockLabel(atHour(13.5))).toBe('13:30');
    expect(clockLabel(1 + atHour(7))).toBe('07:00');
  });

  it('leaves noon clear and darkens midnight, with a light only at night', () => {
    expect(tintAt(0.5).a).toBe(0);
    expect(tintAt(0).a).toBeCloseTo(0.7);
    expect(lightStrength(tintAt(0.5))).toBe(0);
    expect(lightStrength(tintAt(0))).toBe(1);
  });

  it('blends smoothly between keyframes', () => {
    const before = tintAt(atHour(19.9)).a;
    const after = tintAt(atHour(20.1)).a;
    expect(Math.abs(after - before)).toBeLessThan(0.05);
  });

  it('advances one full day every DAY_LENGTH_S seconds', () => {
    const dn = new DayNight(0.25);
    dn.update(DAY_LENGTH_S / 2);
    expect(dn.t).toBeCloseTo(0.75);
    expect(dn.phase).toBe('dusk');
    dn.update(DAY_LENGTH_S / 2);
    expect(dn.t).toBeCloseTo(0.25);
  });
});
