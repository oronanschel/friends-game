import { describe, expect, it } from 'vitest';
import { joystickVector } from '../src/ui/touch';

describe('joystickVector', () => {
  it('ignores tiny drags', () => {
    expect(joystickVector(3, 2, 56)).toEqual({ x: 0, y: 0 });
  });
  it('is proportional inside the radius and clamped outside', () => {
    expect(joystickVector(28, 0, 56).x).toBeCloseTo(0.5);
    const v = joystickVector(300, 400, 56);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
    expect(v.x).toBeCloseTo(0.6);
  });
});
