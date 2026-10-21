import type { Camera } from '../engine/camera';
import type { Entity, Game } from '../game';
import { CHUNK_SIZE, TILE_SIZE } from '../world/world';
import { type Inventory, ItemKind, type ItemSpot, itemsInChunk } from './items';

/** How close the player must be to pick something up, in world pixels. */
export const PICKUP_RANGE = 20;
const SPAWN_RADIUS = 1;
const DESPAWN_RADIUS = 2;

/** Draw a small icon for an item centred at (x, y). Shared with the HUD. */
export function drawItemIcon(ctx: CanvasRenderingContext2D, kind: ItemKind, x: number, y: number, s = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  switch (kind) {
    case ItemKind.Coin:
      ctx.fillStyle = '#f2c230';
      ctx.strokeStyle = '#a77a0e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(-1, -3, 2, 6);
      break;
    case ItemKind.Berry:
      ctx.fillStyle = '#2e7d32';
      ctx.fillRect(-1, -8, 2, 4);
      ctx.fillStyle = '#c2185b';
      for (const [bx, by] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) {
        ctx.beginPath();
        ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case ItemKind.Mushroom:
      ctx.fillStyle = '#f5ead6';
      ctx.fillRect(-2, -1, 4, 7);
      ctx.fillStyle = '#d32f2f';
      ctx.beginPath();
      ctx.arc(0, -1, 7, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(-4, -5, 2, 2);
      ctx.fillRect(2, -4, 2, 2);
      break;
    case ItemKind.Gem:
      ctx.fillStyle = '#4dd0e1';
      ctx.strokeStyle = '#006978';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6, -1);
      ctx.lineTo(0, 7);
      ctx.lineTo(-6, -1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e0f7fa';
      ctx.fillRect(-2, -4, 2, 3);
      break;
  }
  ctx.restore();
}

/** An item lying in the world; walking over it picks it up. */
export class WorldItem implements Entity {
  dead = false;
  private t: number;

  constructor(readonly spot: ItemSpot, private inventory: Inventory, readonly home: string) {
    this.t = (spot.x * 7 + spot.y * 13) % 6;
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
      this.inventory.add(this.spot.kind, this.spot.id, performance.now());
      game.sound?.play('pickup');
      this.dead = true;
      game.entities.push(new PickupPopup(this.spot.kind, this.x, this.y));
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const p = camera.toScreen(this.x, this.y);
    const bob = Math.sin(this.t * 3) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 8, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    drawItemIcon(ctx, this.spot.kind, Math.round(p.x), Math.round(p.y - 2 + bob));
  }
}

/** A "+1" icon that floats up and fades after a pickup. */
export class PickupPopup implements Entity {
  dead = false;
  age = 0;

  constructor(readonly kind: ItemKind, public x: number, public y: number) {}

  update(dt: number): void {
    this.age += dt;
    if (this.age > 0.8) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const p = camera.toScreen(this.x, this.y - this.age * 40);
    ctx.globalAlpha = Math.max(0, 1 - this.age / 0.8);
    drawItemIcon(ctx, this.kind, Math.round(p.x - 6), Math.round(p.y - 10));
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.font = 'bold 13px monospace';
    ctx.strokeText('+1', Math.round(p.x + 4), Math.round(p.y - 5));
    ctx.fillText('+1', Math.round(p.x + 4), Math.round(p.y - 5));
    ctx.globalAlpha = 1;
  }
}

/** Invisible entity that keeps uncollected items present in the chunks around the player. */
export class ItemSpawner implements Entity {
  x = 0;
  y = -Infinity;
  readonly active = new Set<string>();

  constructor(private inventory: Inventory) {}

  update(_dt: number, game: Game): void {
    const pcx = Math.floor(game.player.x / TILE_SIZE / CHUNK_SIZE);
    const pcy = Math.floor(game.player.y / TILE_SIZE / CHUNK_SIZE);

    for (const e of game.entities) {
      if (!(e instanceof WorldItem)) continue;
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
        for (const spot of itemsInChunk(game.world, cx, cy)) {
          if (!this.inventory.collected.has(spot.id)) game.entities.push(new WorldItem(spot, this.inventory, key));
        }
      }
    }
  }
}
