import type { Camera } from '../engine/camera';
import type { Entity, Game } from '../game';
import { TILE_SIZE, type World } from '../world/world';

/** Lion tuning, in world pixels and seconds. */
export const LION = {
  size: 22,
  wanderSpeed: 40,
  /** Faster than walking (160) but slower than running (280), so Shift escapes. */
  chaseSpeed: 205,
  /** Distance at which a lion notices the player and starts chasing. */
  noticeRange: 6 * TILE_SIZE,
  /** Distance at which a chasing lion gives up. */
  giveUpRange: 11 * TILE_SIZE,
  /** Longest a chase lasts before the lion gets tired. */
  maxChaseTime: 6,
  /** How close counts as catching the player. */
  catchRange: 20,
  /** How long a lion rests after a chase before it can chase again. */
  restTime: 4,
  /** How long the "ROAR!" bubble shows. */
  roarTime: 1.2,
};

export type LionState = 'wander' | 'chase' | 'rest';

/** Small deterministic RNG so lions behave the same for the same seed. */
function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A lion that wanders, chases the player when close, and rests after a chase. */
export class Lion implements Entity {
  state: LionState = 'wander';
  dead = false;
  /** Seconds left in the current state (wander leg, chase budget or rest). */
  timer = 0;
  /** Seconds left to show the roar bubble. */
  roar = 0;
  dir = { x: 0, y: 0 };
  facingLeft = false;
  /** Leg animation phase. */
  private step = 0;
  private random: () => number;

  constructor(
    public x: number,
    public y: number,
    seed: number,
    /** Key of the chunk that spawned this lion (used for despawning). */
    readonly home = '',
  ) {
    this.random = rng(seed);
  }

  update(dt: number, game: Game): void {
    const { player, world } = game;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    this.roar = Math.max(0, this.roar - dt);
    this.timer -= dt;

    switch (this.state) {
      case 'wander':
        if (dist < LION.noticeRange) {
          this.state = 'chase';
          this.timer = LION.maxChaseTime;
          this.roar = LION.roarTime;
          break;
        }
        if (this.timer <= 0) {
          // Pick a new direction, or stand still for a while.
          const angle = this.random() * Math.PI * 2;
          const idle = this.random() < 0.4;
          this.dir = idle ? { x: 0, y: 0 } : { x: Math.cos(angle), y: Math.sin(angle) };
          this.timer = 1.5 + this.random() * 2.5;
        }
        this.move(this.dir.x * LION.wanderSpeed * dt, this.dir.y * LION.wanderSpeed * dt, world);
        break;

      case 'chase':
        if (dist < LION.catchRange) {
          // Pounce: knock the player back and lose interest for a while.
          const away = dist > 0 ? { x: dx / dist, y: dy / dist } : { x: 1, y: 0 };
          player.update(0.2, away, world, true);
          this.roar = LION.roarTime;
          this.rest();
          break;
        }
        if (dist > LION.giveUpRange || this.timer <= 0) {
          this.rest();
          break;
        }
        this.dir = { x: dx / dist, y: dy / dist };
        this.move(this.dir.x * LION.chaseSpeed * dt, this.dir.y * LION.chaseSpeed * dt, world);
        break;

      case 'rest':
        this.dir = { x: 0, y: 0 };
        if (this.timer <= 0) {
          this.state = 'wander';
          this.timer = 0;
        }
        break;
    }
  }

  private rest(): void {
    this.state = 'rest';
    this.timer = LION.restTime;
    this.dir = { x: 0, y: 0 };
  }

  /** Move with per-axis collision; turn around when blocked while wandering. */
  move(mx: number, my: number, world: World): void {
    if (mx < 0) this.facingLeft = true;
    else if (mx > 0) this.facingLeft = false;
    const moved = Math.hypot(mx, my);
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(mx), Math.abs(my)) / 4));
    let blocked = false;
    for (let i = 0; i < steps; i++) {
      const nx = this.x + mx / steps;
      if (!this.collides(nx, this.y, world)) this.x = nx;
      else blocked = true;
      const ny = this.y + my / steps;
      if (!this.collides(this.x, ny, world)) this.y = ny;
      else blocked = true;
    }
    if (blocked && this.state === 'wander') this.timer = 0;
    this.step += moved * 0.25;
  }

  /** Whether the lion's box centred at (cx, cy) overlaps a solid tile. */
  collides(cx: number, cy: number, world: World): boolean {
    const half = LION.size / 2;
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
    const legSwing = this.dir.x || this.dir.y ? Math.sin(this.step) * 3 : 0;

    ctx.save();
    ctx.translate(x, y);
    // Drawn a bit larger than the collision box so lions read well on screen.
    ctx.scale(f * 1.3, 1.3);

    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail with a dark tuft.
    ctx.strokeStyle = '#c98f3a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-12, -1);
    ctx.quadraticCurveTo(-20, -4, -20, -12);
    ctx.stroke();
    ctx.fillStyle = '#6b3b12';
    ctx.beginPath();
    ctx.arc(-20, -13, 3, 0, Math.PI * 2);
    ctx.fill();

    // Legs.
    ctx.fillStyle = '#b97f2e';
    ctx.fillRect(-10 + legSwing, 4, 4, 8);
    ctx.fillRect(6 - legSwing, 4, 4, 8);

    // Body.
    ctx.fillStyle = '#d9a24a';
    ctx.beginPath();
    ctx.ellipse(-1, 0, 13, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mane and head.
    ctx.fillStyle = '#8a4b17';
    ctx.beginPath();
    ctx.arc(11, -5, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e3b25c';
    ctx.beginPath();
    ctx.arc(13, -4, 5.5, 0, Math.PI * 2);
    ctx.fill();
    // Eye and nose.
    ctx.fillStyle = this.state === 'chase' ? '#c0201a' : '#222';
    ctx.fillRect(14, -7, 2, 2);
    ctx.fillStyle = '#5a2e0e';
    ctx.fillRect(17, -4, 2, 2);

    // Sleeping "z" while resting.
    ctx.restore();
    if (this.state === 'rest' && this.roar === 0) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('z', x + 12, y - 20);
    }
    if (this.roar > 0) drawRoar(ctx, x, y - 32);
  }
}

function drawRoar(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.font = 'bold 13px monospace';
  const text = 'ROAR!';
  const w = ctx.measureText(text).width + 10;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(Math.round(x - w / 2), y - 10, Math.round(w), 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#b3261e';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y + 4);
  ctx.textAlign = 'left';
}
