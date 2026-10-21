import type { Camera } from '../engine/camera';
import type { Entity, Game } from '../game';
import { TILE_SIZE, type World } from '../world/world';
import { SPELL, Spell } from './spell';

/** Wizard tuning, in tiles, world pixels and seconds. */
export const WIZARD = {
  size: 20,
  /** Slower than the player's walk (160), so you can always walk away from him. */
  speed: 120,
  /** He closes in until he is this close... */
  maxRange: 7 * TILE_SIZE,
  /** ...and backs off when the player is closer than this. */
  minRange: 4 * TILE_SIZE,
  /** He only casts when the player is within this distance. */
  castRange: 10 * TILE_SIZE,
  /** Seconds the staff glows before the bolt is released. */
  windup: 0.55,
  /** Seconds between casts: base plus a random extra. */
  cooldown: [2.6, 1.0] as const,
  /** Quiet time after appearing, so the player gets a moment before the first spell. */
  grace: 5,
  /** Every Nth cast is a fan of three bolts. */
  fanEvery: 3,
  fanSpread: 0.35,
  /** If the player gets this far away (e.g. woke up at spawn) he blinks back next to them. */
  blinkRange: 22 * TILE_SIZE,
  /** Blinks land about this far from the player. */
  blinkDistance: 9 * TILE_SIZE,
  /** Seconds stuck behind something before blinking out. */
  stuckTime: 3,
  /** How long the blink puff shows. */
  puffTime: 0.5,
};

/** Small deterministic RNG so the wizard behaves the same for the same seed. */
function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Velocity of a bolt travelling at `angle` radians. */
export function boltVelocity(angle: number): { vx: number; vy: number } {
  return { vx: Math.cos(angle) * SPELL.speed, vy: Math.sin(angle) * SPELL.speed };
}

/**
 * A wizard who follows the player at a distance and throws magic bolts at them.
 * Walls and trees stop the bolts, and a sprint outruns him; if you get too far away he blinks back.
 */
export class Wizard implements Entity {
  dead = false;
  /** Seconds until the next cast may start. */
  cooldown: number;
  /** Seconds of windup left while casting; 0 when not casting. */
  casting = 0;
  /** Number of casts so far. */
  casts = 0;
  /** Seconds left on the blink puff. */
  puff = 0;
  facingLeft = false;
  /** Orbit direction while at a comfortable distance. */
  private strafe = 1;
  private stuck = 0;
  private placed = false;
  private walk = 0;
  private random: () => number;

  constructor(
    public x: number,
    public y: number,
    seed = 1,
  ) {
    this.random = rng(seed);
    this.cooldown = WIZARD.grace;
  }

  update(dt: number, game: Game): void {
    const { player, world, health } = game;
    this.puff = Math.max(0, this.puff - dt);
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (!this.placed || dist > WIZARD.blinkRange || this.stuck > WIZARD.stuckTime) {
      this.blinkNear(game);
      return;
    }
    // While the player is fainted the wizard stands down.
    if (health && !health.awake) {
      this.casting = 0;
      this.cooldown = Math.max(this.cooldown, WIZARD.grace);
      return;
    }

    if (dx !== 0) this.facingLeft = dx < 0;
    this.cooldown -= dt;

    if (this.casting > 0) {
      // Stand still while the staff charges, then fire.
      this.casting -= dt;
      if (this.casting <= 0) {
        this.casting = 0;
        this.cast(game);
      }
      return;
    }
    if (this.cooldown <= 0 && dist < WIZARD.castRange) {
      this.casting = WIZARD.windup;
      return;
    }

    // Movement: close in, back off, or circle.
    let mx = 0;
    let my = 0;
    if (dist > WIZARD.maxRange) {
      mx = dx / dist;
      my = dy / dist;
    } else if (dist < WIZARD.minRange) {
      mx = -dx / dist;
      my = -dy / dist;
    } else {
      mx = (-dy / dist) * this.strafe * 0.5;
      my = (dx / dist) * this.strafe * 0.5;
    }
    const moved = this.move(mx * WIZARD.speed * dt, my * WIZARD.speed * dt, world);
    // Blocked by something while wanting to move: flip the circling direction and count towards a blink.
    if (moved < Math.hypot(mx, my) * WIZARD.speed * dt * 0.25) {
      this.stuck += dt;
      if (dist <= WIZARD.maxRange && dist >= WIZARD.minRange) this.strafe = -this.strafe;
    } else {
      this.stuck = 0;
    }
  }

  /** Throw a bolt (every Nth time, a fan of three) at the player's current position. */
  private cast(game: Game): void {
    this.casts++;
    const aim = Math.atan2(game.player.y - this.y, game.player.x - this.x);
    const fan = this.casts % WIZARD.fanEvery === 0;
    const angles = fan ? [aim - WIZARD.fanSpread, aim, aim + WIZARD.fanSpread] : [aim];
    for (const a of angles) {
      const { vx, vy } = boltVelocity(a);
      // Start at the staff, a little ahead of the wizard.
      game.entities.push(new Spell(this.x + Math.cos(a) * 14, this.y + Math.sin(a) * 14, vx, vy));
    }
    game.sound?.play('zap', 0.6);
    this.cooldown = WIZARD.cooldown[0] + this.random() * WIZARD.cooldown[1];
  }

  /** Vanish and reappear on open ground near the player. */
  private blinkNear(game: Game): void {
    const { player, world } = game;
    const start = this.random() * Math.PI * 2;
    for (let i = 0; i < 16; i++) {
      const a = start + (i * Math.PI * 2) / 16;
      const tx = Math.floor((player.x + Math.cos(a) * WIZARD.blinkDistance) / TILE_SIZE);
      const ty = Math.floor((player.y + Math.sin(a) * WIZARD.blinkDistance) / TILE_SIZE);
      if (!world.isSolidAt(tx, ty) && !this.collides((tx + 0.5) * TILE_SIZE, (ty + 0.5) * TILE_SIZE, world)) {
        this.x = (tx + 0.5) * TILE_SIZE;
        this.y = (ty + 0.5) * TILE_SIZE;
        this.placed = true;
        this.stuck = 0;
        this.puff = WIZARD.puffTime;
        this.casting = 0;
        this.cooldown = Math.max(this.cooldown, 2);
        return;
      }
    }
    // Nowhere free around the player this frame (all water?): try again next frame.
    this.stuck = 0;
  }

  /** Move with per-axis collision; returns the distance actually travelled. */
  move(mx: number, my: number, world: World): number {
    if (mx < 0) this.facingLeft = true;
    else if (mx > 0) this.facingLeft = false;
    const ox = this.x;
    const oy = this.y;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(mx), Math.abs(my)) / 4));
    for (let i = 0; i < steps; i++) {
      const nx = this.x + mx / steps;
      if (!this.collides(nx, this.y, world)) this.x = nx;
      const ny = this.y + my / steps;
      if (!this.collides(this.x, ny, world)) this.y = ny;
    }
    const moved = Math.hypot(this.x - ox, this.y - oy);
    this.walk += moved * 0.2;
    return moved;
  }

  /** Whether the wizard's box centred at (cx, cy) overlaps a solid tile. */
  collides(cx: number, cy: number, world: World): boolean {
    const half = WIZARD.size / 2;
    const x0 = Math.floor((cx - half) / TILE_SIZE);
    const x1 = Math.floor((cx + half - 0.001) / TILE_SIZE);
    const y0 = Math.floor((cy - half) / TILE_SIZE);
    const y1 = Math.floor((cy + half - 0.001) / TILE_SIZE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (world.isSolidAt(tx, ty)) return true;
      }
    }
    return false;
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const p = camera.toScreen(this.x, this.y);
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const f = this.facingLeft ? -1 : 1;
    const bob = this.walk > 0 ? Math.sin(this.walk) * 1.5 : 0;
    const charge = this.casting > 0 ? 1 - this.casting / WIZARD.windup : 0;

    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + 12, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(f * 1.15, 1.15);

    // Staff with a glowing orb that swells while charging.
    const sx = 13;
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(sx - 1, -14, 2.5, 26);
    const orb = 3.5 + charge * 5;
    if (charge > 0) {
      ctx.fillStyle = `rgba(190,80,255,${0.15 + charge * 0.3})`;
      ctx.beginPath();
      ctx.arc(sx, -16, orb + 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = charge > 0 ? '#e1a8ff' : '#9c4fd6';
    ctx.beginPath();
    ctx.arc(sx, -16, orb, 0, Math.PI * 2);
    ctx.fill();

    // Robe.
    ctx.fillStyle = '#4a2f8f';
    ctx.beginPath();
    ctx.moveTo(-9, 12);
    ctx.lineTo(-6, -6);
    ctx.lineTo(6, -6);
    ctx.lineTo(9, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e0b84a';
    ctx.fillRect(-7, 2, 14, 2);
    // Face and beard.
    ctx.fillStyle = '#f0c9a0';
    ctx.fillRect(-4, -12, 8, 7);
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath();
    ctx.moveTo(-4, -8);
    ctx.lineTo(4, -8);
    ctx.lineTo(0, 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1c1a18';
    ctx.fillRect(0, -11, 2, 2);
    // Pointed hat with a star.
    ctx.fillStyle = '#3a2575';
    ctx.beginPath();
    ctx.moveTo(-8, -11);
    ctx.lineTo(0, -30);
    ctx.lineTo(8, -11);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-10, -13, 20, 3);
    ctx.fillStyle = '#ffd84a';
    ctx.fillRect(-1, -22, 3, 3);
    ctx.restore();

    // Blink puff.
    if (this.puff > 0) {
      const t = 1 - this.puff / WIZARD.puffTime;
      ctx.fillStyle = `rgba(200,150,255,${0.5 * (1 - t)})`;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * (6 + t * 18), y - 6 + Math.sin(a) * (6 + t * 14), 6 * (1 - t) + 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
