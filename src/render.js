import { TILE_SIZE } from './config.js';
import { TILES } from './world.js';

export function drawWorld(ctx, world, camera) {
  const x0 = Math.floor(camera.x / TILE_SIZE);
  const y0 = Math.floor(camera.y / TILE_SIZE);
  const x1 = Math.ceil((camera.x + camera.width) / TILE_SIZE);
  const y1 = Math.ceil((camera.y + camera.height) / TILE_SIZE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const type = world.getTile(tx, ty);
      ctx.fillStyle = TILES[type].color;
      ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      if (type === 'tree') {
        ctx.fillStyle = '#2e7a35';
        ctx.beginPath();
        ctx.arc(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

export function drawHud(ctx, player) {
  const tx = Math.floor(player.x / TILE_SIZE);
  const ty = Math.floor(player.y / TILE_SIZE);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(8, 8, 220, 26);
  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  ctx.fillText(`x:${tx} y:${ty}  WASD to move`, 14, 26);
}
