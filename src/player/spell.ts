import type { Camera } from '../engine/camera';
import type { Entity, Game } from '../game';
import { TILE_SIZE } from '../world/world';
import type { Player } from './player';

export const SPELL = {
  speed: 420,
  /** Seconds a bolt flies before fizzling out. */
  life: 0.9,
  /** Seconds between casts. */
  cooldown: 0.3,
  /** How close a bolt must pass to hit an entity. */
  hitRange: 20,
};

const FACING_DIR = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

/** A glowing magic bolt fired by the wizard. Stops at solid tiles; calls `onSpellHit` on what it touches. */
export class MagicBolt implements Entity {
  dead = false;
  age = 0;
  /** Recent positions for the trail. */
  private trail: { x: number; y: number }[] = [];

  constructor(
    public x: number,
    public y: number,
    readonly dir: { x: number; y: number },
  ) {}

  update(dt: number, game: Game): void {
    if (this.dead) return;
    this.age += dt;
    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > 8) this.trail.pop();
    if (this.age > SPELL.life) {
      this.burst(game);
      return;
    }
    this.x += this.dir.x * SPELL.speed * dt;
    this.y += this.dir.y * SPELL.speed * dt;
    if (game.world.isSolidAt(Math.floor(this.x / TILE_SIZE), Math.floor(this.y / TILE_SIZE))) {
      this.burst(game);
      return;
    }
    for (const e of game.entities) {
      if (e === this || !e.onSpellHit || e.dead) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) < SPELL.hitRange) {
        e.onSpellHit(game);
        this.burst(game);
        return;
      }
    }
  }

  private burst(game: Game): void {
    this.dead = true;
    game.entities.push(new SparkleBurst(this.x, this.y));
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    this.trail.forEach((pt, i) => {
      const p = camera.toScreen(pt.x, pt.y - 12);
      ctx.fillStyle = `rgba(170, 120, 255, ${0.5 * (1 - i / this.trail.length)})`;
      const r = 5 * (1 - i / this.trail.length);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    const p = camera.toScreen(this.x, this.y - 12);
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 14);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(190,140,255,0.9)');
    g.addColorStop(1, 'rgba(120,60,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(p.x - 14, p.y - 14, 28, 28);
  }
}

/** Short star burst where a bolt ends. */
export class SparkleBurst implements Entity {
  dead = false;
  age = 0;

  constructor(
    public x: number,
    public y: number,
  ) {}

  update(dt: number): void {
    this.age += dt;
    if (this.age > 0.4) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const p = camera.toScreen(this.x, this.y - 12);
    const k = this.age / 0.4;
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = '#fff3a8';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const d = 4 + k * 22;
      ctx.fillRect(Math.round(p.x + Math.cos(a) * d - 2), Math.round(p.y + Math.sin(a) * d - 2), 4, 4);
    }
    ctx.globalAlpha = 1;
  }
}

/** Casting with a cooldown. `cast` returns the new bolt, or null while recharging. */
export class Spellbook {
  recharge = 0;

  update(dt: number): void {
    this.recharge = Math.max(0, this.recharge - dt);
  }

  cast(player: Player, game: Game): MagicBolt | null {
    if (this.recharge > 0) return null;
    this.recharge = SPELL.cooldown;
    const dir = FACING_DIR[player.facing];
    const bolt = new MagicBolt(player.x + dir.x * 14, player.y + dir.y * 14, dir);
    game.entities.push(bolt);
    game.sound?.play('zap');
    return bolt;
  }
}
