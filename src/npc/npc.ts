import type { Camera } from '../engine/camera';
import type { Entity, Game } from '../game';
import { TILE_SIZE, type World } from '../world/world';
import type { NpcDef } from './villagers';

/** NPC tuning, in world pixels and seconds. */
export const NPC = {
  size: 18,
  speed: 36,
  /** How far an NPC strolls from home before heading back. */
  leash: 4 * TILE_SIZE,
};

/** Small deterministic RNG so NPCs stroll the same way for the same seed. */
function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A villager who strolls around home, stops to chat and avoids solid tiles. */
export class Npc implements Entity {
  dir = { x: 0, y: 0 };
  /** Seconds left in the current stroll leg or pause. */
  timer = 0;
  /** While true the NPC stands still and faces the player. */
  talking = false;
  facingLeft = false;
  protected step = 0;
  private random: () => number;

  constructor(
    public x: number,
    public y: number,
    readonly def: NpcDef,
    seed = 1,
    /** Home position in world pixels; defaults to where it starts. */
    readonly homeX = x,
    readonly homeY = y,
  ) {
    this.random = rng(seed);
  }

  update(dt: number, game: Game): void {
    if (this.talking) {
      this.dir = { x: 0, y: 0 };
      this.facingLeft = game.player.x < this.x;
      return;
    }
    this.timer -= dt;
    if (this.timer <= 0) this.chooseDirection();
    this.move(this.dir.x * NPC.speed * dt, this.dir.y * NPC.speed * dt, game.world);
  }

  /** Pick the next stroll leg: head home when too far, otherwise wander or pause. */
  chooseDirection(): void {
    const hx = this.homeX - this.x;
    const hy = this.homeY - this.y;
    const away = Math.hypot(hx, hy);
    if (away > NPC.leash) {
      this.dir = { x: hx / away, y: hy / away };
      this.timer = 1 + this.random();
      return;
    }
    if (this.random() < 0.45) {
      this.dir = { x: 0, y: 0 };
    } else {
      const angle = this.random() * Math.PI * 2;
      this.dir = { x: Math.cos(angle), y: Math.sin(angle) };
    }
    this.timer = 1 + this.random() * 2.5;
  }

  /** Move with per-axis collision; pick a new direction when blocked. */
  move(mx: number, my: number, world: World): void {
    if (mx < -0.01) this.facingLeft = true;
    else if (mx > 0.01) this.facingLeft = false;
    let blocked = false;
    const nx = this.x + mx;
    if (!this.collides(nx, this.y, world)) this.x = nx;
    else blocked = true;
    const ny = this.y + my;
    if (!this.collides(this.x, ny, world)) this.y = ny;
    else blocked = true;
    if (blocked) this.timer = 0;
    this.step += Math.hypot(mx, my) * 0.3;
  }

  /** Whether the NPC's box centred at (cx, cy) overlaps a solid tile. */
  collides(cx: number, cy: number, world: World): boolean {
    const half = NPC.size / 2;
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
    const walking = this.dir.x !== 0 || this.dir.y !== 0;
    const swing = walking ? Math.sin(this.step) * 2 : 0;
    const f = this.facingLeft ? -1 : 1;

    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Legs.
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(x - 5, y + 3 + swing, 4, 7);
    ctx.fillRect(x + 1, y + 3 - swing, 4, 7);
    // Body.
    ctx.fillStyle = this.def.color;
    ctx.fillRect(x - 7, y - 7, 14, 12);
    // Head.
    ctx.fillStyle = '#f1c9a0';
    ctx.beginPath();
    ctx.arc(x, y - 13, 6, 0, Math.PI * 2);
    ctx.fill();
    // Eye on the side they face.
    ctx.fillStyle = '#222';
    ctx.fillRect(x + f * 2 - 1, y - 14, 2, 2);
    // Hat.
    if (this.def.hat) {
      ctx.fillStyle = this.def.hat;
      ctx.fillRect(x - 7, y - 20, 14, 3);
      ctx.fillRect(x - 4, y - 24, 8, 4);
    }
  }
}
