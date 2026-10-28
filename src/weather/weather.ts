import type { Camera } from '../engine/camera';
import { hash2 } from '../world/noise';
import { Tile } from '../world/tiles';

/** Seconds each weather spell lasts before the next one is rolled. */
export const SPELL_S = 150;
/** Chance that a spell is wet (rain, or snow on snowy ground). */
export const WET_CHANCE = 0.35;
/** Seconds to fade precipitation in at the start of a wet spell and out at its end. */
const FADE_S = 20;
/** Particles at full intensity. */
const MAX_DROPS = { rain: 220, snow: 140 };
const SALT = 0x3ea7;

export type Precip = 'rain' | 'snow';
export type WeatherMode = Precip | 'clear';

/** How hard it is raining or snowing at `time` seconds into the session, in [0, 1]. Fully determined by the seed. */
export function wetnessAt(time: number, seed: number): number {
  const spell = Math.floor(time / SPELL_S);
  if (hash2(spell, 0, seed ^ SALT) >= WET_CHANCE) return 0;
  const into = time - spell * SPELL_S;
  const edge = Math.min(into, SPELL_S - into) / FADE_S;
  const f = Math.max(0, Math.min(1, edge));
  return f * f * (3 - 2 * f);
}

/** Snow falls over snow and pine forest, rain everywhere else. */
export function precipFor(tile: Tile): Precip {
  return tile === Tile.Snow || tile === Tile.Taiga ? 'snow' : 'rain';
}

/** `?weather=rain|snow|clear` from the URL, or undefined for the natural cycle. */
export function parseWeather(value: string | null): WeatherMode | undefined {
  return value === 'rain' || value === 'snow' || value === 'clear' ? value : undefined;
}

interface Drop {
  x: number;
  y: number;
  /** Per-drop variety in [0, 1): speed, size and sway phase. */
  v: number;
}

/**
 * Rain and snow that come and go on their own. Drops live in screen space but
 * shift with the camera, so they feel anchored to the world as you walk.
 */
export class Weather {
  /** Seconds since the session started. */
  time = 0;
  /** Current strength in [0, 1], easing towards the target. */
  intensity = 0;
  kind: Precip = 'rain';
  drops: Drop[] = [];
  private camX: number | null = null;
  private camY = 0;

  constructor(private seed: number, private forced?: WeatherMode, private rng: () => number = Math.random) {}

  update(dt: number, tile: Tile, camera: Camera): void {
    this.time += dt;
    const target = this.forced ? (this.forced === 'clear' ? 0 : 1) : wetnessAt(this.time, this.seed);
    this.intensity += (target - this.intensity) * Math.min(1, dt * 0.8);
    if (this.intensity < 0.01 && target === 0) this.intensity = 0;
    this.kind = this.forced && this.forced !== 'clear' ? this.forced : precipFor(tile);

    const { width: w, height: h } = camera;
    const want = Math.round(MAX_DROPS[this.kind] * this.intensity);
    while (this.drops.length < want) this.drops.push({ x: this.rng() * w, y: this.rng() * h, v: this.rng() });
    if (this.drops.length > want) this.drops.length = want;

    const dx = this.camX === null ? 0 : camera.x - this.camX;
    const dy = this.camX === null ? 0 : camera.y - this.camY;
    this.camX = camera.x;
    this.camY = camera.y;
    for (const d of this.drops) {
      if (this.kind === 'rain') {
        d.x += -60 * dt - dx;
        d.y += (620 + d.v * 260) * dt - dy;
      } else {
        d.x += Math.sin(this.time * 1.5 + d.v * 10) * 25 * dt - dx;
        d.y += (45 + d.v * 40) * dt - dy;
      }
      d.x = ((d.x % w) + w) % w;
      d.y = ((d.y % h) + h) % h;
    }
  }

  /** "rain" or "snow" for the HUD while it's falling noticeably, else "". */
  get label(): string {
    return this.intensity > 0.2 ? this.kind : '';
  }

  /** Overcast tint plus falling drops, drawn over the world. */
  draw(ctx: CanvasRenderingContext2D): void {
    if (this.intensity <= 0) return;
    const { width, height } = ctx.canvas;
    ctx.fillStyle = `rgba(40,50,70,${0.18 * this.intensity})`;
    ctx.fillRect(0, 0, width, height);
    if (this.kind === 'rain') {
      ctx.strokeStyle = 'rgba(200,215,255,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of this.drops) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + 2, d.y - 10 - d.v * 6);
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const d of this.drops) {
        const r = 1 + d.v * 1.6;
        ctx.fillRect(d.x - r / 2, d.y - r / 2, r, r);
      }
    }
  }
}
