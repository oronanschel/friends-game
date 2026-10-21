import { PLAYER_SPEED } from './config.js';
import { moveAxis } from './input.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 10;
    this.facing = { x: 0, y: 1 };
  }

  update(dt, world) {
    const dir = moveAxis();
    if (dir.x || dir.y) this.facing = dir;
    // Move each axis separately so the player slides along walls.
    const nx = this.x + dir.x * PLAYER_SPEED * dt;
    if (!this.collides(nx, this.y, world)) this.x = nx;
    const ny = this.y + dir.y * PLAYER_SPEED * dt;
    if (!this.collides(this.x, ny, world)) this.y = ny;
  }

  collides(x, y, world) {
    const r = this.radius;
    return (
      world.isSolidAt(x - r, y - r) ||
      world.isSolidAt(x + r, y - r) ||
      world.isSolidAt(x - r, y + r) ||
      world.isSolidAt(x + r, y + r)
    );
  }

  draw(ctx) {
    ctx.fillStyle = '#f2d14b';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(this.x + this.facing.x * 5, this.y + this.facing.y * 5, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
