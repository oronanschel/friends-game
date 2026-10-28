import type { Camera } from '../engine/camera';
import type { Entity, Game } from '../game';
import type { Light } from '../ui/daynight';
import { hash2 } from '../world/noise';
import { Tile } from '../world/tiles';
import { CHUNK_SIZE, TILE_SIZE, type World } from '../world/world';

/** Chance that a chunk has a campfire. */
export const CAMPFIRE_CHANCE = 0.4;
/** How close the player must be to light a campfire and rest there, in world pixels. */
export const REST_RANGE = 36;
/** Radius of the pool of light a lit campfire casts at night, in world pixels. */
export const CAMPFIRE_LIGHT = 120;
/** Tiles a campfire can be built on. */
const CAMP_TILES = [Tile.Grass, Tile.Sand, Tile.Forest, Tile.Taiga, Tile.Snow];
/** Random tiles tried per chunk before giving up (e.g. a chunk that is mostly water). */
const TRIES = 12;
const SPAWN_RADIUS = 1;
const DESPAWN_RADIUS = 2;
const SALT = 0x5ca3f;

export interface CampfireSpot {
  /** Stable id (the tile it sits on), used to remember it was lit. */
  id: string;
  x: number;
  y: number;
}

/** The campfire in a chunk, if it has one, chosen deterministically from the world seed. */
export function campfireInChunk(world: World, cx: number, cy: number): CampfireSpot | null {
  if (hash2(cx, cy, world.seed ^ SALT) >= CAMPFIRE_CHANCE) return null;
  for (let i = 0; i < TRIES; i++) {
    const tx = cx * CHUNK_SIZE + Math.floor(hash2(cx, cy, world.seed ^ (SALT + 1 + i * 2)) * CHUNK_SIZE);
    const ty = cy * CHUNK_SIZE + Math.floor(hash2(cx, cy, world.seed ^ (SALT + 2 + i * 2)) * CHUNK_SIZE);
    if (!CAMP_TILES.includes(world.getTile(tx, ty))) continue;
    if (world.isSolidAt(tx, ty) || world.castleAt(tx, ty)) continue;
    return { id: `${tx},${ty}`, x: (tx + 0.5) * TILE_SIZE, y: (ty + 0.5) * TILE_SIZE };
  }
  return null;
}

/** Which campfires are lit, and the one the player wakes up at after fainting. */
export class Campfires {
  lit = new Set<string>();
  /** Last campfire rested at, or null to wake up at the start. */
  respawn: { x: number; y: number } | null = null;

  /** Light a campfire (if it isn't yet) and make it the respawn point. Returns true if the respawn point moved. */
  rest(spot: CampfireSpot): boolean {
    this.lit.add(spot.id);
    if (this.respawn && this.respawn.x === spot.x && this.respawn.y === spot.y) return false;
    this.respawn = { x: spot.x, y: spot.y };
    return true;
  }

  /** Walkable tile next to the respawn campfire, or null if the player hasn't rested at one. */
  wakeTile(world: World): { tx: number; ty: number } | null {
    if (!this.respawn) return null;
    return world.findWalkableNear(Math.floor(this.respawn.x / TILE_SIZE), Math.floor(this.respawn.y / TILE_SIZE) + 1);
  }

  save(): unknown {
    return { lit: [...this.lit], respawn: this.respawn };
  }

  load(data: unknown): void {
    const d = data as { lit?: unknown; respawn?: { x?: unknown; y?: unknown } | null } | null;
    if (!d || typeof d !== 'object') return;
    if (Array.isArray(d.lit)) this.lit = new Set(d.lit.filter((x): x is string => typeof x === 'string'));
    const r = d.respawn;
    if (r && typeof r.x === 'number' && typeof r.y === 'number' && Number.isFinite(r.x) && Number.isFinite(r.y)) {
      this.respawn = { x: r.x, y: r.y };
    }
  }
}

/** A ring of stones and logs; walking up to it lights it and makes it your respawn point. */
export class Campfire implements Entity {
  dead = false;
  private t: number;

  constructor(readonly spot: CampfireSpot, private campfires: Campfires, readonly home: string) {
    this.t = (spot.x * 7 + spot.y * 13) % 10;
  }

  get x(): number {
    return this.spot.x;
  }

  get y(): number {
    return this.spot.y;
  }

  get lit(): boolean {
    return this.campfires.lit.has(this.spot.id);
  }

  /** Light radius, flickering a little. */
  get lightRadius(): number {
    return CAMPFIRE_LIGHT * (1 + 0.05 * Math.sin(this.t * 9) + 0.03 * Math.sin(this.t * 23));
  }

  update(dt: number, game: Game): void {
    this.t += dt;
    if (game.health && !game.health.awake) return;
    if (Math.hypot(game.player.x - this.x, game.player.y - this.y) > REST_RANGE) return;
    if (this.campfires.rest(this.spot)) {
      game.sound?.play('chime');
      game.entities.push(new RestPopup(this.x, this.y - 24));
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const p = camera.toScreen(this.x, this.y);
    const x = Math.round(p.x);
    const y = Math.round(p.y);

    if (this.lit) {
      const glow = ctx.createRadialGradient(x, y - 4, 0, x, y - 4, 34);
      glow.addColorStop(0, 'rgba(255,170,60,0.35)');
      glow.addColorStop(1, 'rgba(255,170,60,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 34, y - 38, 68, 68);
    }

    // Stone ring.
    ctx.fillStyle = '#8a8580';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * 11, y + 3 + Math.sin(a) * 5, 3.2, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crossed logs.
    ctx.fillStyle = this.lit ? '#6d4325' : '#5a4636';
    ctx.save();
    ctx.translate(x, y + 2);
    for (const r of [-0.45, 0.45]) {
      ctx.save();
      ctx.rotate(r);
      ctx.fillRect(-9, -2, 18, 4);
      ctx.restore();
    }
    ctx.restore();

    if (!this.lit) return;
    // Flames: three layers that sway and flicker.
    const sway = Math.sin(this.t * 6) * 1.5;
    const h = 14 + Math.sin(this.t * 11) * 2 + Math.sin(this.t * 17) * 1.5;
    for (const [w, k, color] of [
      [7, 1, '#e8501f'],
      [5, 0.75, '#ff9f1c'],
      [2.5, 0.5, '#ffe36b'],
    ] as const) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x - w, y + 1);
      ctx.quadraticCurveTo(x - w * 0.6, y - h * k * 0.5, x + sway * k, y - h * k);
      ctx.quadraticCurveTo(x + w * 0.6, y - h * k * 0.5, x + w, y + 1);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** "You'll wake up here" text that floats up and fades after resting at a campfire. */
export class RestPopup implements Entity {
  dead = false;
  age = 0;

  constructor(public x: number, public y: number) {}

  update(dt: number): void {
    this.age += dt;
    if (this.age > 2) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const p = camera.toScreen(this.x, this.y - this.age * 18);
    ctx.globalAlpha = Math.max(0, Math.min(1, (2 - this.age) / 0.6));
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#ffd27a';
    ctx.strokeText("Campfire lit: you'll wake up here", Math.round(p.x), Math.round(p.y));
    ctx.fillText("Campfire lit: you'll wake up here", Math.round(p.x), Math.round(p.y));
    ctx.textAlign = 'start';
    ctx.globalAlpha = 1;
  }
}

/** Invisible entity that keeps the campfires in the chunks around the player present. */
export class CampfireSpawner implements Entity {
  x = 0;
  y = -Infinity;
  readonly active = new Set<string>();

  constructor(private campfires: Campfires) {}

  update(_dt: number, game: Game): void {
    const pcx = Math.floor(game.player.x / TILE_SIZE / CHUNK_SIZE);
    const pcy = Math.floor(game.player.y / TILE_SIZE / CHUNK_SIZE);

    for (const e of game.entities) {
      if (!(e instanceof Campfire)) continue;
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
        const spot = campfireInChunk(game.world, cx, cy);
        if (spot) game.entities.push(new Campfire(spot, this.campfires, key));
      }
    }
  }
}

/** Lit campfires near the player, as lights for the night overlay. */
export function campfireLights(entities: Entity[]): Light[] {
  const lights: Light[] = [];
  for (const e of entities) {
    if (e instanceof Campfire && e.lit) lights.push({ x: e.x, y: e.y - 4, radius: e.lightRadius });
  }
  return lights;
}
