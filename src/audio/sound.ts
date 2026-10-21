import { Tile } from '../world/tiles';

/** Sound effects other features can trigger with `game.sound?.play(name, at)`. */
export type SfxName = 'roar' | 'pounce' | 'pickup';

/** Footstep timbre per ground type: noise filter frequency (Hz) and loudness. */
export function footstepFor(tile: Tile): { freq: number; gain: number } | null {
  switch (tile) {
    case Tile.Sand:
      return { freq: 2600, gain: 0.22 };
    case Tile.Snow:
      return { freq: 1300, gain: 0.25 };
    case Tile.Grass:
    case Tile.Forest:
    case Tile.Taiga:
      return { freq: 900, gain: 0.18 };
    default:
      return { freq: 1600, gain: 0.18 };
  }
}

/** Counts distance walked and says when the next footstep is due. */
export class StepCounter {
  private travelled = 0;
  constructor(readonly stride = 26) {}

  /** Add movement; returns true when a step should sound. */
  advance(distance: number): boolean {
    this.travelled += distance;
    if (this.travelled >= this.stride) {
      this.travelled %= this.stride;
      return true;
    }
    return false;
  }
}

/** Volume for a sound at `distance` pixels from the player: 1 nearby, fading to 0 by `range`. */
export function falloff(distance: number, range = 600): number {
  return Math.max(0, 1 - distance / range) ** 2;
}

const MUTE_KEY = 'friends-game-muted';
/** Calm pentatonic notes (A minor pentatonic, Hz) for the ambient tune. */
const SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];

/**
 * Procedural audio with WebAudio: footsteps, a soft ambient tune and
 * effects. No asset files. Starts on the first key or touch (browser
 * autoplay rules); V toggles mute, which is remembered.
 */
export class Sound {
  muted: boolean;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private steps = new StepCounter();
  private nextNote = 0;

  constructor(private store: Storage | null = window.localStorage) {
    this.muted = this.read() === '1';
    const unlock = () => this.start();
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyV' && !e.repeat) this.toggleMute();
    });
  }

  toggleMute(): void {
    this.muted = !this.muted;
    try {
      this.store?.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // Storage unavailable: mute just won't be remembered.
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
  }

  /** Call every frame with how far the player moved and the tile underfoot. */
  update(moved: number, tile: Tile, running: boolean): void {
    if (!this.ctx || this.muted) return;
    if (this.steps.advance(running ? moved * 0.8 : moved)) {
      const f = footstepFor(tile);
      if (f) this.burst(f.freq, f.gain, 0.06);
    }
    if (this.ctx.currentTime >= this.nextNote) this.playNote();
  }

  /** Play an effect; `volume` is 0..1 (use `falloff` for distant sources). */
  play(name: SfxName, volume = 1): void {
    if (!this.ctx || this.muted || volume <= 0) return;
    switch (name) {
      case 'roar':
        this.roar(volume);
        break;
      case 'pounce':
        this.burst(400, 0.5 * volume, 0.25);
        break;
      case 'pickup':
        this.tone(880, 0.15 * volume, 0.08);
        this.tone(1320, 0.15 * volume, 0.12, 0.08);
        break;
    }
  }

  private start(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    // One second of white noise, reused for footsteps and roars.
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.nextNote = this.ctx.currentTime + 1;
  }

  private read(): string | null {
    try {
      return this.store?.getItem(MUTE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  /** Short filtered noise burst. */
  private burst(freq: number, gain: number, duration: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq * (0.9 + Math.random() * 0.2);
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter).connect(g).connect(this.master!);
    src.start(t, Math.random() * 0.5, duration);
  }

  /** Soft sine tone with attack and release. */
  private tone(freq: number, gain: number, duration: number, delay = 0, type: OscillatorType = 'sine'): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    const t = ctx.currentTime + delay;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.05, duration / 3));
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  private roar(volume: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    // Growling low sawtooth sliding down, plus rumbling noise.
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.9);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35 * volume, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1);
    osc.connect(filter).connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + 1.05);
    this.burst(250, 0.4 * volume, 0.8);
  }

  /** Ambient tune: a quiet random note from the scale every couple of seconds. */
  private playNote(): void {
    const freq = SCALE[Math.floor(Math.random() * SCALE.length)];
    this.tone(freq, 0.05, 2.5, 0, 'triangle');
    if (Math.random() < 0.4) this.tone(freq * 1.5, 0.03, 2.5, 0.4, 'sine');
    this.nextNote = this.ctx!.currentTime + 1.5 + Math.random() * 2;
  }
}
