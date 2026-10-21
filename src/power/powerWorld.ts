import { FAIRY, Fairy } from '../animals/fairy';
import type { Camera } from '../engine/camera';
import type { Entity, Game } from '../game';
import { PICKUP_RANGE, WorldItem } from '../items/pickup';
import { CHUNK_SIZE, TILE_SIZE } from '../world/world';
import { type PowerStones, STONE_INFO, STONE_ORDER, StoneKind, type StoneSpot, stonesInChunk } from './stones';

/** How far the Magnet stone reaches, and how fast items fly in (world pixels, per second). */
export const MAGNET_RANGE = 7 * TILE_SIZE;
const MAGNET_SPEED = 320;
/** Fairies inside this distance fly over while the Fairy call is active. */
export const WARD_RANGE = FAIRY.giveUpRange - TILE_SIZE;
const SPAWN_RADIUS = 1;
const DESPAWN_RADIUS = 2;

/** Draw a power stone centred at (x, y): a cut crystal with a soft glow. Shared with the HUD. */
export function drawStoneIcon(ctx: CanvasRenderingContext2D, kind: StoneKind, x: number, y: number, s = 1, glow = 1): void {
  const info = STONE_INFO[kind];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (glow > 0) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
    g.addColorStop(0, `rgba(${info.glow},${0.75 * glow})`);
    g.addColorStop(1, `rgba(${info.glow},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(-16, -16, 32, 32);
  }
  ctx.fillStyle = info.color;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(6, -3);
  ctx.lineTo(4, 7);
  ctx.lineTo(-4, 7);
  ctx.lineTo(-6, -3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(3, -3);
  ctx.lineTo(0, 1);
  ctx.lineTo(-2, -3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A power stone lying in the world; walking over it picks it up. */
export class WorldStone implements Entity {
  dead = false;
  private t: number;

  constructor(readonly spot: StoneSpot, private stones: PowerStones, readonly home: string) {
    this.t = (spot.x * 5 + spot.y * 11) % 7;
  }

  get x(): number {
    return this.spot.x;
  }

  get y(): number {
    return this.spot.y;
  }

  update(dt: number, game: Game): void {
    this.t += dt;
    if (Math.hypot(game.player.x - this.x, game.player.y - this.y) < PICKUP_RANGE) {
      this.stones.add(this.spot.kind, this.spot.id, performance.now());
      game.sound?.play('power');
      this.dead = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const p = camera.toScreen(this.x, this.y);
    const bob = Math.sin(this.t * 2.5) * 2.5;
    const pulse = 0.65 + 0.35 * Math.sin(this.t * 4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 9, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    drawStoneIcon(ctx, this.spot.kind, Math.round(p.x), Math.round(p.y - 4 + bob), 1.1, pulse);
  }
}

/**
 * Invisible entity that keeps power stones present around the player,
 * uses a stone when its key (1, 2, 3) is pressed, and applies active powers.
 */
export class PowerStoneSystem implements Entity {
  x = 0;
  y = -Infinity;
  readonly active = new Set<string>();
  private baseSpeed: number | null = null;
  private pending: StoneKind[] = [];

  constructor(private stones: PowerStones, target: Window | null = typeof window === 'undefined' ? null : window) {
    target?.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const kind = STONE_ORDER.find((k) => e.code === `Digit${STONE_INFO[k].key}` || e.code === `Numpad${STONE_INFO[k].key}`);
      if (kind) this.pending.push(kind);
    });
  }

  /** Ask to use a stone on the next update (keys and HUD taps both go through here). */
  request(kind: StoneKind): void {
    this.pending.push(kind);
  }

  update(dt: number, game: Game): void {
    for (const kind of this.pending.splice(0)) {
      if (this.stones.use(kind, performance.now())) game.sound?.play('power');
    }
    this.stones.update(dt);

    this.baseSpeed ??= game.player.speed;
    game.player.speed = this.baseSpeed * this.stones.speedMultiplier;

    if (this.stones.isActive(StoneKind.Magnet)) this.pullItems(dt, game);
    if (this.stones.isActive(StoneKind.Ward)) this.callFairies(game);
    this.keepStonesNearby(game);
  }

  private pullItems(dt: number, game: Game): void {
    const { player } = game;
    for (const e of game.entities) {
      if (!(e instanceof WorldItem)) continue;
      const dx = player.x - e.spot.x;
      const dy = player.y - e.spot.y;
      const dist = Math.hypot(dx, dy);
      if (dist > MAGNET_RANGE || dist === 0) continue;
      const step = Math.min(dist, MAGNET_SPEED * dt);
      e.spot.x += (dx / dist) * step;
      e.spot.y += (dy / dist) * step;
    }
  }

  private callFairies(game: Game): void {
    const { player } = game;
    for (const e of game.entities) {
      if (!(e instanceof Fairy) || e.state !== 'wander' || e.cooldown > 0) continue;
      if (Math.hypot(e.x - player.x, e.y - player.y) > WARD_RANGE) continue;
      // Summoned: fly over to visit the player.
      e.state = 'visit';
      e.say('Coming!');
    }
  }

  private keepStonesNearby(game: Game): void {
    const pcx = Math.floor(game.player.x / TILE_SIZE / CHUNK_SIZE);
    const pcy = Math.floor(game.player.y / TILE_SIZE / CHUNK_SIZE);
    for (const e of game.entities) {
      if (!(e instanceof WorldStone)) continue;
      const [cx, cy] = e.home.split(',').map(Number);
      if (Math.max(Math.abs(cx - pcx), Math.abs(cy - pcy)) > DESPAWN_RADIUS) {
        e.dead = true;
        this.active.delete(e.home);
      }
    }
    for (let cy = pcy - SPAWN_RADIUS; cy <= pcy + SPAWN_RADIUS; cy++) {
      for (let cx = pcx - SPAWN_RADIUS; cx <= pcx + SPAWN_RADIUS; cx++) {
        const key = `${cx},${cy}`;
        if (this.active.has(key)) continue;
        this.active.add(key);
        for (const spot of stonesInChunk(game.world, cx, cy)) {
          if (!this.stones.collected.has(spot.id)) game.entities.push(new WorldStone(spot, this.stones, key));
        }
      }
    }
  }
}

/** Coloured aura around the player for each active power; draw after the world. */
export function drawPowerAura(ctx: CanvasRenderingContext2D, camera: Camera, stones: PowerStones, px: number, py: number, now = performance.now()): void {
  const p = camera.toScreen(px, py);
  STONE_ORDER.filter((k) => stones.isActive(k)).forEach((kind, i) => {
    const left = stones.active[kind];
    // Blink during the last 3 seconds so players know it's ending.
    if (left < 3 && Math.floor(now / 150) % 2 === 0) return;
    ctx.strokeStyle = `rgba(${STONE_INFO[kind].glow},0.85)`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 17 + i * 5 + Math.sin(now / 200) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  });
}
