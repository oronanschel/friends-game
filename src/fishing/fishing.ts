import type { Camera } from '../engine/camera';
import type { Entity, Game } from '../game';
import { ItemKind } from '../items/items';
import { PickupPopup } from '../items/pickup';
import type { Player } from '../player/player';
import { Tile } from '../world/tiles';
import { TILE_SIZE, type World } from '../world/world';

/** Shortest and longest wait, in seconds, before a fish bites. */
export const WAIT_MIN = 1.5;
export const WAIT_MAX = 4.5;
/** Seconds you have to press R again once the bobber dips. */
export const BITE_WINDOW = 0.9;
/** Moving further than this (world pixels) from where you cast reels the line in. */
const MOVE_CANCEL = 6;
/** How far ahead of the player, in world pixels, to look for water. */
const REACH = [18, 42];

const FACING_DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] } as const;

export type FishingState = 'idle' | 'waiting' | 'bite';

/** The water tile the player is facing and close enough to fish in, if any. */
export function waterInFront(world: World, player: Player): { tx: number; ty: number } | null {
  const [dx, dy] = FACING_DIR[player.facing];
  for (const d of REACH) {
    const tx = Math.floor((player.x + dx * d) / TILE_SIZE);
    const ty = Math.floor((player.y + dy * d) / TILE_SIZE);
    const tile = world.getTile(tx, ty);
    if (tile === Tile.Water || tile === Tile.DeepWater) return { tx, ty };
  }
  return null;
}

/**
 * Face the water and press R to cast. When the bobber dips, press R again
 * within `BITE_WINDOW` seconds to catch a fish. Too early scares it off.
 */
export class Fishing implements Entity {
  state: FishingState = 'idle';
  /** Seconds until a bite (waiting) or until the fish gets away (bite). */
  timer = 0;
  /** Bobber position in world pixels. */
  bobber = { x: 0, y: 0 };
  private castFrom = { x: 0, y: 0 };
  private t = 0;
  private player: Player | null = null;

  constructor(private rng: () => number = Math.random) {}

  /** Drawn just in front of the player. */
  get x(): number {
    return this.player?.x ?? 0;
  }

  get y(): number {
    return (this.player?.y ?? -Infinity) + 1;
  }

  /** R: cast, or reel in. */
  press(game: Game): void {
    if (game.health && !game.health.awake) return;
    if (this.state === 'idle') {
      const water = waterInFront(game.world, game.player);
      if (!water) return;
      this.state = 'waiting';
      this.timer = WAIT_MIN + this.rng() * (WAIT_MAX - WAIT_MIN);
      this.bobber = { x: (water.tx + 0.5) * TILE_SIZE, y: (water.ty + 0.5) * TILE_SIZE };
      this.castFrom = { x: game.player.x, y: game.player.y };
      this.player = game.player;
    } else if (this.state === 'waiting') {
      this.stop(game, 'Too soon! It swam off.');
    } else {
      game.inventory.counts[ItemKind.Fish] += 1;
      game.inventory.lastPickup = { kind: ItemKind.Fish, at: performance.now() };
      game.sound?.play('pickup');
      game.entities.push(new PickupPopup(ItemKind.Fish, game.player.x, game.player.y - 16));
      this.state = 'idle';
    }
  }

  update(dt: number, game: Game): void {
    this.t += dt;
    if (this.state === 'idle') return;
    const moved = Math.hypot(game.player.x - this.castFrom.x, game.player.y - this.castFrom.y) > MOVE_CANCEL;
    if (moved || (game.health && !game.health.awake)) {
      this.state = 'idle';
      return;
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    if (this.state === 'waiting') {
      this.state = 'bite';
      this.timer = BITE_WINDOW;
      game.sound?.play('chime');
    } else {
      this.stop(game, 'It got away...');
    }
  }

  private stop(game: Game, message: string): void {
    this.state = 'idle';
    game.entities.push(new FishingText(message, game.player.x, game.player.y - 24));
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (this.state === 'idle' || !this.player) return;
    const rod = camera.toScreen(this.player.x, this.player.y - 14);
    const bite = this.state === 'bite';
    const b = camera.toScreen(this.bobber.x, this.bobber.y + (bite ? 3 : Math.sin(this.t * 4) * 1.5));

    // Line, sagging a little.
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rod.x, rod.y);
    ctx.quadraticCurveTo((rod.x + b.x) / 2, Math.max(rod.y, b.y) + 10, b.x, b.y - 3);
    ctx.stroke();

    // Ripple and bobber.
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 2, 6 + (bite ? 4 : 0), 2.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.arc(b.x, b.y - 2, 3.5, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#fafafa';
    ctx.beginPath();
    ctx.arc(b.x, b.y - 2, 3.5, 0, Math.PI);
    ctx.fill();

    if (bite) {
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = '#ffeb3b';
      ctx.strokeText('!', b.x, b.y - 12);
      ctx.fillText('!', b.x, b.y - 12);
      ctx.textAlign = 'start';
    }
  }
}

/** A short message that floats up and fades, e.g. when a fish gets away. */
export class FishingText implements Entity {
  dead = false;
  age = 0;

  constructor(readonly text: string, public x: number, public y: number) {}

  update(dt: number): void {
    this.age += dt;
    if (this.age > 1.4) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const p = camera.toScreen(this.x, this.y - this.age * 18);
    ctx.globalAlpha = Math.max(0, Math.min(1, (1.4 - this.age) / 0.5));
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#fff';
    ctx.strokeText(this.text, Math.round(p.x), Math.round(p.y));
    ctx.fillText(this.text, Math.round(p.x), Math.round(p.y));
    ctx.textAlign = 'start';
    ctx.globalAlpha = 1;
  }
}
