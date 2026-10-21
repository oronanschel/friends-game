import { falloff } from '../audio/sound';
import type { Camera } from '../engine/camera';
import type { Entity, Game } from '../game';
import { TILE_SIZE } from '../world/world';

/** Fairy tuning, in world pixels and seconds. */
export const FAIRY = {
  wanderSpeed: 30,
  flySpeed: 170,
  /** Distance at which a fairy notices the player and flies over to visit. */
  noticeRange: 6 * TILE_SIZE,
  /** Distance at which a visiting fairy loses interest. */
  giveUpRange: 11 * TILE_SIZE,
  /** How close the fairy orbits the player while visiting. */
  orbitRadius: 34,
  /** Within this distance a visiting fairy sprinkles fairy dust (heals a heart). */
  blessRange: 44,
  /** Seconds before the same fairy will bless again. */
  blessCooldown: 20,
  /** How long a speech bubble shows. */
  bubbleTime: 1.4,
};

export type FairyState = 'wander' | 'visit';

/** Pastel wing/dress colours; each fairy picks one from its seed. */
const PALETTES = [
  { dress: '#ff8fc8', wing: 'rgba(255, 210, 240, 0.75)', glow: '255, 170, 220' },
  { dress: '#9fd8ff', wing: 'rgba(210, 240, 255, 0.75)', glow: '150, 210, 255' },
  { dress: '#c7a4ff', wing: 'rgba(235, 220, 255, 0.75)', glow: '200, 160, 255' },
  { dress: '#a8f0b8', wing: 'rgba(220, 255, 225, 0.75)', glow: '160, 240, 180' },
];

/** Small deterministic RNG so fairies behave the same for the same seed. */
function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A cute fairy that flutters over meadows. When the player comes close it
 * flies over, circles them and sprinkles fairy dust that restores a heart.
 * Fairies fly, so trees and water don't stop them.
 */
export class Fairy implements Entity {
  state: FairyState = 'wander';
  dead = false;
  /** Seconds left on the current wander leg. */
  timer = 0;
  /** Seconds until this fairy can bless again. */
  cooldown = 0;
  /** Speech bubble text and how long it still shows. */
  bubble = '';
  bubbleLeft = 0;
  /** Seconds left of a happy spin (after being hit by a spell). */
  spin = 0;
  dir = { x: 0, y: 0 };
  /** Animation clock (wing flaps, bobbing, orbit). */
  private t: number;
  private random: () => number;
  private palette: (typeof PALETTES)[number];

  constructor(
    public x: number,
    public y: number,
    seed: number,
    /** Key of the chunk that spawned this fairy (used for despawning). */
    readonly home = '',
  ) {
    this.random = rng(seed);
    this.palette = PALETTES[Math.floor(this.random() * PALETTES.length)];
    this.t = this.random() * 10;
  }

  say(text: string): void {
    this.bubble = text;
    this.bubbleLeft = FAIRY.bubbleTime;
  }

  update(dt: number, game: Game): void {
    const { player } = game;
    this.t += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.bubbleLeft = Math.max(0, this.bubbleLeft - dt);
    this.spin = Math.max(0, this.spin - dt);
    this.timer -= dt;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    const playerAwake = game.health?.awake ?? true;

    if (this.state === 'wander') {
      if (dist < FAIRY.noticeRange && playerAwake && this.cooldown === 0) {
        this.state = 'visit';
        this.say('Hi!');
        game.sound?.play('chime', falloff(dist));
        return;
      }
      if (this.timer <= 0) {
        const angle = this.random() * Math.PI * 2;
        this.dir = { x: Math.cos(angle), y: Math.sin(angle) };
        this.timer = 1.5 + this.random() * 2.5;
      }
      this.x += this.dir.x * FAIRY.wanderSpeed * dt;
      this.y += this.dir.y * FAIRY.wanderSpeed * dt;
      return;
    }

    // Visiting: fly to a point circling the player.
    if (dist > FAIRY.giveUpRange || !playerAwake) {
      this.state = 'wander';
      this.say('Bye!');
      return;
    }
    const a = this.t * 2;
    const tx = player.x + Math.cos(a) * FAIRY.orbitRadius;
    const ty = player.y - 10 + Math.sin(a) * FAIRY.orbitRadius * 0.5;
    const ox = tx - this.x;
    const oy = ty - this.y;
    const od = Math.hypot(ox, oy);
    const step = Math.min(od, FAIRY.flySpeed * dt);
    if (od > 0) {
      this.dir = { x: ox / od, y: oy / od };
      this.x += this.dir.x * step;
      this.y += this.dir.y * step;
    }
    if (dist < FAIRY.blessRange && this.cooldown === 0) {
      this.cooldown = FAIRY.blessCooldown;
      if (game.health?.heal()) {
        this.say('♥ +1');
        game.sound?.play('chime');
      } else {
        this.say('✨');
      }
      this.state = 'wander';
      this.timer = 0;
    }
  }

  /** Wizard spells don't hurt fairies; they just giggle and twirl. */
  onSpellHit(game: Game): void {
    this.spin = 1;
    this.say('Hehe!');
    game.sound?.play('chime', 0.6);
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const p = camera.toScreen(this.x, this.y);
    const bob = Math.sin(this.t * 4) * 3;
    const x = Math.round(p.x);
    const y = Math.round(p.y - 14 + bob);
    const flap = Math.abs(Math.sin(this.t * 22));
    const { dress, wing, glow } = this.palette;

    // Shadow on the ground (fairies hover).
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 6, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Soft glow.
    const g = ctx.createRadialGradient(x, y, 0, x, y, 22);
    g.addColorStop(0, `rgba(${glow}, 0.55)`);
    g.addColorStop(1, `rgba(${glow}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - 22, y - 22, 44, 44);

    ctx.save();
    ctx.translate(x, y);
    if (this.spin > 0) ctx.rotate((1 - this.spin) * Math.PI * 4);

    // Wings (flapping).
    ctx.fillStyle = wing;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * 7, -4, 7 * (0.4 + 0.6 * flap), 9, side * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(side * 6, 4, 5 * (0.4 + 0.6 * flap), 5, side * -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Dress.
    ctx.fillStyle = dress;
    ctx.beginPath();
    ctx.moveTo(-5, 8);
    ctx.lineTo(5, 8);
    ctx.lineTo(2, -1);
    ctx.lineTo(-2, -1);
    ctx.closePath();
    ctx.fill();

    // Head with hair, rosy cheeks and happy eyes.
    ctx.fillStyle = '#ffe0c7';
    ctx.beginPath();
    ctx.arc(0, -6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd36b';
    ctx.beginPath();
    ctx.arc(0, -8, 5, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#3a2a2a';
    ctx.fillRect(-3, -6, 1.5, 1.5);
    ctx.fillRect(1.5, -6, 1.5, 1.5);
    ctx.fillStyle = 'rgba(255, 120, 150, 0.7)';
    ctx.fillRect(-4, -4, 2, 1);
    ctx.fillRect(2, -4, 2, 1);
    ctx.restore();

    // Sparkles trailing behind.
    ctx.fillStyle = '#fffbe0';
    for (let i = 0; i < 3; i++) {
      const s = (this.t * 1.7 + i / 3) % 1;
      const sx = x - this.dir.x * 14 * s + Math.sin((this.t + i) * 9) * 4;
      const sy = y + 8 + s * 10;
      const r = 1.6 * (1 - s);
      ctx.globalAlpha = 1 - s;
      ctx.fillRect(Math.round(sx - r), Math.round(sy - r), Math.max(1, r * 2), Math.max(1, r * 2));
    }
    ctx.globalAlpha = 1;

    if (this.bubbleLeft > 0) drawBubble(ctx, this.bubble, x, y - 24);
  }
}

function drawBubble(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.font = 'bold 12px monospace';
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#d06ba8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect?.(Math.round(x - w / 2), y - 10, Math.round(w), 18, 8);
  if (!ctx.roundRect) ctx.rect(Math.round(x - w / 2), y - 10, Math.round(w), 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#b0306e';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y + 4);
  ctx.textAlign = 'left';
}
