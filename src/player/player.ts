import type { Camera } from '../engine/camera';
import { drawPlayer } from '../render';
import { TILE_SIZE, World } from '../world/world';

/** Speed multiplier while running (Shift). */
export const RUN_MULTIPLIER = 1.75;

/** The player: an axis-aligned box that moves and collides with solid tiles. */
export class Player {
  /** Width/height of the collision box in world pixels. */
  readonly size = 20;
  /** Movement speed in world pixels per second. */
  speed = 160;
  facing: 'up' | 'down' | 'left' | 'right' = 'down';

  constructor(public x: number, public y: number) {}

  /** Move by input direction for `dt` seconds, resolving collisions per axis. */
  update(dt: number, dir: { x: number; y: number }, world: World, running = false): void {
    let { x: dx, y: dy } = dir;
    // Never faster than full speed, including diagonals; analog input below 1 moves slower.
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    if (dx !== 0 || dy !== 0) {
      if (Math.abs(dx) >= Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left';
      else this.facing = dy > 0 ? 'down' : 'up';
    }

    // Move in small sub-steps so large moves can't tunnel through walls.
    const speed = this.speed * (running ? RUN_MULTIPLIER : 1);
    const mx = dx * speed * dt;
    const my = dy * speed * dt;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(mx), Math.abs(my)) / 4));
    for (let i = 0; i < steps; i++) {
      const nx = this.x + mx / steps;
      if (!this.collides(nx, this.y, world)) this.x = nx;
      const ny = this.y + my / steps;
      if (!this.collides(this.x, ny, world)) this.y = ny;
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    drawPlayer(ctx, camera, this);
  }

  /** Whether the box centred at (cx, cy) overlaps any solid tile. */
  collides(cx: number, cy: number, world: World): boolean {
    const half = this.size / 2;
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
}
