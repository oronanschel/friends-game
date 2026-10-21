import { describe, expect, it } from 'vitest';
import { Player } from '../src/player/player';
import { legOffsets, walkFrame } from '../src/player/sprite';
import { World } from '../src/world/world';

describe('hero sprite animation', () => {
  it('stands still on frame 0 and cycles through 4 frames while walking', () => {
    expect(walkFrame(123, false)).toBe(0);
    const frames = new Set([0, 7, 14, 21, 28].map((d) => walkFrame(d, true)));
    expect(frames).toEqual(new Set([0, 1, 2, 3]));
  });

  it('moves the legs in opposite directions mid-stride', () => {
    const [l, r] = legOffsets(1);
    expect(l).toBe(-r);
    expect(legOffsets(0)).toEqual([0, 0]);
  });

  it('tracks distance walked and whether the player is moving', () => {
    const world = new World(1);
    world.isSolidAt = () => false;
    const p = new Player(0, 0);
    p.update(0.5, { x: 1, y: 0 }, world);
    expect(p.moving).toBe(true);
    expect(p.walked).toBeCloseTo(p.speed * 0.5);
    p.update(0.5, { x: 0, y: 0 }, world);
    expect(p.moving).toBe(false);
  });
});
