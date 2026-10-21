import type { Camera } from '../engine/camera';
import type { Entity, Game } from '../game';
import { TILE_SIZE } from '../world/world';

/** Spell tuning, in world pixels and seconds. */
export const SPELL = {
  /** Slower than running (280) so a sprint outpaces it, faster than walking (160). */
  speed: 230,
  /** How close to the player's centre counts as a hit. */
  hitRange: 15,
  /** Seconds before an unspent spell fizzles out. */
  life: 3,
};

/**
 * A magic bolt flying in a straight line. It hurts the player on contact and
 * fizzles against anything solid (trees, boulders, castle walls), so you can hide behind them.
 */
export class Spell implements Entity {
  dead = false;
  /** Seconds since it was cast. */
  age = 0;

  constructor(
    public x: number,
    public y: number,
    readonly vx: number,
    readonly vy: number,
  ) {}

  update(dt: number, game: Game): void {
    this.age += dt;
    if (this.age >= SPELL.life) {
      this.dead = true;
      return;
    }
    const { world, player, health } = game;
    // Small sub-steps so a fast bolt can't skip over a thin wall or the player.
    const steps = Math.max(1, Math.ceil((Math.hypot(this.vx, this.vy) * dt) / 6));
    for (let i = 0; i < steps; i++) {
      this.x += (this.vx * dt) / steps;
      this.y += (this.vy * dt) / steps;
      if (world.isSolidAt(Math.floor(this.x / TILE_SIZE), Math.floor(this.y / TILE_SIZE))) {
        this.dead = true;
        return;
      }
      if (health && health.awake && Math.hypot(player.x - this.x, player.y - this.y) < SPELL.hitRange) {
        // While the player is protected after a hit the bolt passes through.
        if (health.hurt()) {
          game.sound?.play('pounce');
          this.dead = true;
          return;
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const p = camera.toScreen(this.x, this.y);
    const x = Math.round(p.x);
    const y = Math.round(p.y) - 10;
    const len = Math.hypot(this.vx, this.vy) || 1;
    const dx = this.vx / len;
    const dy = this.vy / len;
    // Fading trail.
    for (let i = 4; i >= 1; i--) {
      ctx.fillStyle = `rgba(190,80,255,${0.12 * (5 - i)})`;
      ctx.beginPath();
      ctx.arc(x - dx * i * 6, y - dy * i * 6, 7 - i, 0, Math.PI * 2);
      ctx.fill();
    }
    // Glowing core, pulsing a little.
    const pulse = 1 + Math.sin(this.age * 30) * 0.15;
    ctx.fillStyle = 'rgba(190,80,255,0.35)';
    ctx.beginPath();
    ctx.arc(x, y, 11 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c15cff';
    ctx.beginPath();
    ctx.arc(x, y, 7 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - 1, y - 1, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
