import type { Camera } from '../engine/camera';

/** Real seconds for one full in-game day. */
export const DAY_LENGTH_S = 240;

export type Phase = 'dawn' | 'day' | 'dusk' | 'night';

/** Screen tint over the world: colour plus how strongly it covers it. */
export interface Tint {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** A light in the world (e.g. a campfire) that cuts through the night tint. */
export interface Light {
  x: number;
  y: number;
  radius: number;
}

/** Tint keyframes by hour; the colour between two keyframes is blended. */
const KEYS: [hour: number, tint: Tint][] = [
  [0, { r: 8, g: 14, b: 50, a: 0.7 }],
  [5, { r: 8, g: 14, b: 50, a: 0.65 }],
  [6.5, { r: 255, g: 140, b: 80, a: 0.25 }],
  [8, { r: 255, g: 220, b: 180, a: 0 }],
  [17, { r: 255, g: 220, b: 180, a: 0 }],
  [18.5, { r: 255, g: 100, b: 40, a: 0.3 }],
  [20, { r: 20, g: 25, b: 70, a: 0.6 }],
  [24, { r: 8, g: 14, b: 50, a: 0.7 }],
];

/** Hour of day in [0, 24) for a day fraction `t` (any number; wraps). */
export function hourOf(t: number): number {
  return (((t % 1) + 1) % 1) * 24;
}

export function phaseOf(t: number): Phase {
  const h = hourOf(t);
  if (h < 5 || h >= 20) return 'night';
  if (h < 8) return 'dawn';
  if (h < 17) return 'day';
  return 'dusk';
}

/** "HH:MM" clock for the HUD. */
export function clockLabel(t: number): string {
  const minutes = Math.floor(hourOf(t) * 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function tintAt(t: number): Tint {
  const h = hourOf(t);
  let i = 0;
  while (KEYS[i + 1][0] <= h) i++;
  const [h0, a] = KEYS[i];
  const [h1, b] = KEYS[i + 1];
  const f = (h - h0) / (h1 - h0);
  const mix = (x: number, y: number) => x + (y - x) * f;
  return { r: mix(a.r, b.r), g: mix(a.g, b.g), b: mix(a.b, b.b), a: mix(a.a, b.a) };
}

/** How much light the player carries, 0 by day up to 1 deep at night. */
export function lightStrength(tint: Tint): number {
  return Math.max(0, Math.min(1, (tint.a - 0.3) / 0.3));
}

/**
 * Time of day that tints the screen. Starts in the morning; `?time=0.8`
 * in the URL picks another start (0 = midnight, 0.5 = noon).
 */
export class DayNight {
  /** Fraction of the current day in [0, 1). */
  t: number;
  private overlay: HTMLCanvasElement | null = null;

  constructor(start = 0.3) {
    this.t = hourOf(start) / 24;
  }

  update(dt: number): void {
    this.t = (this.t + dt / DAY_LENGTH_S) % 1;
  }

  get phase(): Phase {
    return phaseOf(this.t);
  }

  get clock(): string {
    return clockLabel(this.t);
  }

  /** Tint the whole screen, leaving soft pools of light around the player and any `lights` at night. */
  draw(ctx: CanvasRenderingContext2D, camera: Camera, playerX: number, playerY: number, lights: Light[] = []): void {
    const tint = tintAt(this.t);
    const { width, height } = ctx.canvas;
    if (tint.a <= 0.005 || width === 0 || height === 0) return;
    if (!this.overlay) this.overlay = document.createElement('canvas');
    const o = this.overlay;
    if (o.width !== width || o.height !== height) {
      o.width = width;
      o.height = height;
    }
    const octx = o.getContext('2d')!;
    octx.globalCompositeOperation = 'source-over';
    octx.clearRect(0, 0, width, height);
    octx.fillStyle = `rgba(${tint.r | 0},${tint.g | 0},${tint.b | 0},${tint.a})`;
    octx.fillRect(0, 0, width, height);

    const light = lightStrength(tint);
    if (light > 0) {
      octx.globalCompositeOperation = 'destination-out';
      for (const l of [{ x: playerX, y: playerY, radius: 150 }, ...lights]) {
        const p = camera.toScreen(l.x, l.y);
        const glow = octx.createRadialGradient(p.x, p.y, 0, p.x, p.y, l.radius);
        glow.addColorStop(0, `rgba(0,0,0,${0.85 * light})`);
        glow.addColorStop(0.6, `rgba(0,0,0,${0.5 * light})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        octx.fillStyle = glow;
        octx.fillRect(p.x - l.radius, p.y - l.radius, l.radius * 2, l.radius * 2);
      }
    }
    ctx.drawImage(o, 0, 0);
  }
}
