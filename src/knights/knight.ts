import { falloff } from '../audio/sound';
import type { Camera } from '../engine/camera';
import type { Entity, Game } from '../game';
import { CASTLE_HEIGHT, CASTLE_WIDTH, type Castle } from '../world/castles';
import { TILE_SIZE, type World } from '../world/world';

/** Knight tuning, in tiles, world pixels and seconds. */
export const KNIGHT = {
  /** How long one hop takes. */
  hopTime: 0.32,
  /** Pause between hops while patrolling (min, extra random). */
  patrolPause: [0.7, 1.6] as const,
  /** Pause between hops while chasing. */
  chasePause: 0.12,
  /** A knight notices the player this close (tiles, to the knight). */
  noticeRange: 7,
  /** A chasing knight gives up when the player is this far from it (tiles). */
  giveUpRange: 11,
  /** Knights never stray further than this from their castle's centre (tiles). */
  leash: 15,
  /** Patrol hops stay within this many tiles of the knight's post. */
  patrolRadius: 4,
  /** Longest a chase lasts before the knight tires. */
  maxChaseTime: 8,
  /** How close counts as catching the player (world pixels). */
  catchRange: 26,
  /** Rest after a catch or a tired chase. */
  restTime: 3,
  /** How long the "HALT!" bubble shows. */
  shoutTime: 1.2,
};

export type KnightState = 'patrol' | 'chase' | 'rest';

/** The eight L-shaped chess knight moves: two tiles one way, one tile the other. */
export const KNIGHT_MOVES: readonly (readonly [number, number])[] = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];

/** Knights hop over anything in between, so only the landing tile has to be free. */
export function knightLandings(world: World, tx: number, ty: number): { tx: number; ty: number }[] {
  const out: { tx: number; ty: number }[] = [];
  for (const [dx, dy] of KNIGHT_MOVES) {
    if (!world.isSolidAt(tx + dx, ty + dy)) out.push({ tx: tx + dx, ty: ty + dy });
  }
  return out;
}

/** Where a castle's two guards stand: either side of the gate, just outside the wall. */
export function guardPosts(c: Castle): { tx: number; ty: number }[] {
  const y = c.ty + CASTLE_HEIGHT;
  const mid = c.tx + Math.floor(CASTLE_WIDTH / 2);
  return [
    { tx: mid - 2, ty: y },
    { tx: mid + 2, ty: y },
  ];
}

/** Centre of a castle in tile coordinates. */
export function castleCentre(c: Castle): { tx: number; ty: number } {
  return { tx: c.tx + CASTLE_WIDTH / 2, ty: c.ty + CASTLE_HEIGHT / 2 };
}

/** Small deterministic RNG so knights behave the same for the same seed. */
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
 * A chess knight that guards a castle: it hops in L-shapes around its post,
 * and when the player comes close it hops after them (never leaving the castle's
 * surroundings), shoves them back if it catches them, then rests.
 */
export class Knight implements Entity {
  state: KnightState = 'patrol';
  dead = false;
  x: number;
  y: number;
  /** Tile the knight stands on (or is hopping from). */
  tx: number;
  ty: number;
  /** Seconds left in the current pause, chase budget or rest. */
  timer = 0;
  /** Seconds left to show the shout bubble. */
  shout = 0;
  private hop: { fromX: number; fromY: number; toTx: number; toTy: number; t: number } | null = null;
  private pause = 1;
  private random: () => number;

  constructor(
    readonly post: { tx: number; ty: number },
    readonly castle: Castle,
    seed: number,
    /** Key of the placement cell that spawned this knight (used for despawning). */
    readonly home = '',
  ) {
    this.tx = post.tx;
    this.ty = post.ty;
    this.x = (post.tx + 0.5) * TILE_SIZE;
    this.y = (post.ty + 0.5) * TILE_SIZE;
    this.random = rng(seed);
  }

  /** Whether the knight is mid-hop. */
  get hopping(): boolean {
    return this.hop !== null;
  }

  update(dt: number, game: Game): void {
    const { player, world } = game;
    const dist = Math.hypot(player.x - this.x, player.y - this.y) / TILE_SIZE;
    this.shout = Math.max(0, this.shout - dt);
    this.timer -= dt;

    if (this.hop) {
      this.advanceHop(dt);
    } else {
      this.pause -= dt;
    }

    switch (this.state) {
      case 'patrol':
        if (dist < KNIGHT.noticeRange && this.inLeash(player.x / TILE_SIZE, player.y / TILE_SIZE)) {
          this.state = 'chase';
          this.timer = KNIGHT.maxChaseTime;
          this.shout = KNIGHT.shoutTime;
          game.sound?.play('roar', falloff(dist * TILE_SIZE) * 0.5);
          this.pause = 0;
        }
        break;
      case 'chase':
        if (dist * TILE_SIZE < KNIGHT.catchRange) {
          // Shove the player away from the castle and take a breather.
          const dx = player.x - this.x;
          const dy = player.y - this.y;
          const len = Math.hypot(dx, dy) || 1;
          player.update(0.2, { x: dx / len, y: dy / len }, world, true);
          this.shout = KNIGHT.shoutTime;
          game.sound?.play('pounce');
          this.rest();
        } else if (dist > KNIGHT.giveUpRange || this.timer <= 0 || !this.inLeash(player.x / TILE_SIZE, player.y / TILE_SIZE)) {
          this.rest();
        }
        break;
      case 'rest':
        if (this.timer <= 0) {
          this.state = 'patrol';
          this.pause = 0.5;
        }
        break;
    }

    if (this.hop || this.pause > 0) return;
    if (this.state === 'chase') this.hopToward(world, player.x / TILE_SIZE, player.y / TILE_SIZE, KNIGHT.chasePause);
    else this.hopToward(world, this.state === 'rest' ? this.post.tx : null, this.state === 'rest' ? this.post.ty : null, 1);
  }

  private rest(): void {
    this.state = 'rest';
    this.timer = KNIGHT.restTime;
  }

  /** Whether a position (in tiles) is within the leash around the castle. */
  inLeash(tx: number, ty: number): boolean {
    const c = castleCentre(this.castle);
    return Math.hypot(tx - c.tx, ty - c.ty) <= KNIGHT.leash;
  }

  /**
   * Start the next hop. With a target, hop to the landing closest to it;
   * without one, patrol: hop to a random landing near the post.
   */
  private hopToward(world: World, targetX: number | null, targetY: number | null, pause: number): void {
    const centre = castleCentre(this.castle);
    const options = knightLandings(world, this.tx, this.ty).filter(
      (l) => Math.hypot(l.tx - centre.tx, l.ty - centre.ty) <= KNIGHT.leash,
    );
    let pick: { tx: number; ty: number } | undefined;
    if (targetX !== null && targetY !== null) {
      // Chasing the player (or heading home): take the landing that gets closest, if it helps at all.
      const here = Math.hypot(targetX - (this.tx + 0.5), targetY - (this.ty + 0.5));
      let best = here;
      for (const l of options) {
        const d = Math.hypot(targetX - (l.tx + 0.5), targetY - (l.ty + 0.5));
        if (d < best) {
          best = d;
          pick = l;
        }
      }
    } else {
      const near = options.filter(
        (l) => Math.hypot(l.tx - this.post.tx, l.ty - this.post.ty) <= KNIGHT.patrolRadius,
      );
      if (near.length > 0) pick = near[Math.floor(this.random() * near.length)];
      this.pause = KNIGHT.patrolPause[0] + this.random() * KNIGHT.patrolPause[1];
      if (!pick) return;
      this.startHop(pick);
      return;
    }
    this.pause = pause;
    if (pick) this.startHop(pick);
  }

  private startHop(to: { tx: number; ty: number }): void {
    this.hop = { fromX: this.x, fromY: this.y, toTx: to.tx, toTy: to.ty, t: 0 };
  }

  private advanceHop(dt: number): void {
    const h = this.hop!;
    h.t = Math.min(1, h.t + dt / KNIGHT.hopTime);
    const toX = (h.toTx + 0.5) * TILE_SIZE;
    const toY = (h.toTy + 0.5) * TILE_SIZE;
    this.x = h.fromX + (toX - h.fromX) * h.t;
    this.y = h.fromY + (toY - h.fromY) * h.t;
    if (h.t >= 1) {
      this.tx = h.toTx;
      this.ty = h.toTy;
      this.hop = null;
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const p = camera.toScreen(this.x, this.y);
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    // Arc while hopping.
    const lift = this.hop ? Math.sin(this.hop.t * Math.PI) * 18 : 0;
    const body = this.castle.banner;

    // Shadow stays on the ground.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + 12, 13 - lift * 0.15, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(x, y - lift);
    ctx.scale(1.15, 1.15);

    // Plinth, like a chess piece.
    ctx.fillStyle = '#3a3633';
    ctx.fillRect(-12, 6, 24, 5);
    ctx.fillStyle = body;
    ctx.fillRect(-10, 2, 20, 5);

    // Horse-head silhouette.
    ctx.fillStyle = body;
    ctx.strokeStyle = '#1c1a18';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-8, 3);
    ctx.lineTo(-7, -8);
    ctx.lineTo(-10, -13);
    ctx.lineTo(-4, -19);
    ctx.lineTo(0, -26);
    ctx.lineTo(3, -20);
    ctx.lineTo(13, -12);
    ctx.lineTo(12, -8);
    ctx.lineTo(5, -9);
    ctx.lineTo(2, -4);
    ctx.lineTo(9, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Mane, eye and nostril.
    ctx.fillStyle = '#1c1a18';
    ctx.fillRect(-5, -19, 3, 12);
    ctx.fillRect(4, -16, 2, 2);
    ctx.fillStyle = this.state === 'chase' ? '#ff3b30' : '#f5f0e6';
    ctx.fillRect(1, -17, 2, 2);
    ctx.restore();

    if (this.state === 'rest' && this.shout === 0) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('z', x + 12, y - 30);
    }
    if (this.shout > 0) drawShout(ctx, x, y - 44);
  }
}

function drawShout(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.font = 'bold 13px monospace';
  const text = 'HALT!';
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
