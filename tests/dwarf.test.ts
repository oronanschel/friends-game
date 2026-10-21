import { describe, expect, it } from 'vitest';
import { Camera } from '../src/engine/camera';
import { drawDwarf } from '../src/player/dwarf';
import { Player } from '../src/player/player';

/** A canvas context that records every drawing call, so we can compare what was drawn. */
function recorder(): { ctx: CanvasRenderingContext2D; log: string[] } {
  const log: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_t, name: string) => (...args: unknown[]) => {
        log.push(`${name}(${args.map((a) => (typeof a === 'number' ? Math.round(a * 100) / 100 : String(a))).join(',')})`);
      },
      set: (_t, name: string, value) => {
        log.push(`${name}=${String(value)}`);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, log };
}

function draw(player: Player): string[] {
  const { ctx, log } = recorder();
  drawDwarf(ctx, new Camera(800, 600), player);
  return log;
}

describe('dwarf hero', () => {
  it('draws something for every facing without errors', () => {
    for (const facing of ['up', 'down', 'left', 'right'] as const) {
      const p = new Player(100, 100);
      p.facing = facing;
      expect(draw(p).length).toBeGreaterThan(30);
    }
  });

  it('looks different from the front, the side and the back', () => {
    const looks = (['up', 'down', 'right'] as const).map((facing) => {
      const p = new Player(100, 100);
      p.facing = facing;
      return draw(p).join('|');
    });
    expect(new Set(looks).size).toBe(3);
  });

  it('is mirrored, not redrawn, when facing left', () => {
    const r = new Player(100, 100);
    r.facing = 'right';
    const l = new Player(100, 100);
    l.facing = 'left';
    const right = draw(r).filter((c) => c.startsWith('scale'));
    const left = draw(l).filter((c) => c.startsWith('scale'));
    expect(right).toEqual(['scale(1.2,1.2)']);
    expect(left).toEqual(['scale(-1.2,1.2)']);
  });

  it('stands still when idle and strides when moving', () => {
    const p = new Player(100, 100);
    p.facing = 'down';
    const idle1 = draw(p).join('|');
    p.walked = 500; // distance walked only matters while moving
    const idle2 = draw(p).join('|');
    expect(idle1).toBe(idle2);
    p.moving = true;
    p.walked = 7; // first stride frame
    const stride = draw(p).join('|');
    expect(stride).not.toBe(idle1);
    p.walked = 14; // passing frame, legs together again
    expect(draw(p).join('|')).not.toBe(stride);
  });

  it('keeps the shadow under the feet while the body bobs', () => {
    const camera = new Camera(800, 600);
    const p = new Player(100, 100);
    p.moving = true;
    p.walked = 7; // a stride frame: the body bobs, the shadow must not
    const { ctx, log } = recorder();
    drawDwarf(ctx, camera, p);
    const shadow = log.find((c) => c.startsWith('ellipse('))!;
    const [x, y] = shadow.slice('ellipse('.length, -1).split(',').map(Number);
    const feet = camera.toScreen(p.x, p.y);
    expect(x).toBeCloseTo(feet.x, 1);
    expect(y).toBeCloseTo(feet.y + p.size / 2 + 1, 1);
  });
});
