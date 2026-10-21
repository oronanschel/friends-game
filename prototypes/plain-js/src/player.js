import { axis, isDown } from './input.js';

const SPEED = 160; // pixels per second
const RUN_MULT = 1.75;

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 10; // collision radius in pixels
    this.facing = { x: 0, y: 1 };
  }

  update(dt, world) {
    const dir = axis();
    if (dir.x || dir.y) this.facing = dir;
    const speed = SPEED * (isDown('ShiftLeft') || isDown('ShiftRight') ? RUN_MULT : 1);
    // Move one axis at a time so the player slides along walls.
    this.tryMove(dir.x * speed * dt, 0, world);
    this.tryMove(0, dir.y * speed * dt, world);
  }

  tryMove(dx, dy, world) {
    const nx = this.x + dx;
    const ny = this.y + dy;
    const r = this.radius;
    const blocked =
      world.isSolidAt(nx - r, ny - r) ||
      world.isSolidAt(nx + r, ny - r) ||
      world.isSolidAt(nx - r, ny + r) ||
      world.isSolidAt(nx + r, ny + r);
    if (!blocked) {
      this.x = nx;
      this.y = ny;
    }
  }

  draw(ctx, camera) {
    const { x, y } = camera.worldToScreen(this.x, this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b04a';
    ctx.beginPath();
    ctx.arc(x, y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Eye dot showing facing direction.
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x + this.facing.x * 5, y + this.facing.y * 5, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
