import { Camera } from './engine/camera';
import { Player } from './player/player';
import { TILE_INFO } from './world/tiles';
import { TILE_SIZE, World } from './world/world';

/** Draw the visible part of the world and the player. */
export function render(ctx: CanvasRenderingContext2D, world: World, camera: Camera, player: Player): void {
  const { width, height } = camera;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  const tx0 = Math.floor(camera.left / TILE_SIZE);
  const ty0 = Math.floor(camera.top / TILE_SIZE);
  const tx1 = Math.floor((camera.left + width) / TILE_SIZE);
  const ty1 = Math.floor((camera.top + height) / TILE_SIZE);
  const ox = Math.round(-camera.left);
  const oy = Math.round(-camera.top);

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      ctx.fillStyle = TILE_INFO[world.getTile(tx, ty)].color;
      ctx.fillRect(tx * TILE_SIZE + ox, ty * TILE_SIZE + oy, TILE_SIZE, TILE_SIZE);
    }
  }

  // Player: simple body with a facing indicator.
  const p = camera.toScreen(player.x, player.y);
  const half = player.size / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + half, half, half / 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8463c';
  ctx.fillRect(Math.round(p.x - half), Math.round(p.y - half), player.size, player.size);
  ctx.fillStyle = '#fff';
  const eye = { up: [0, -6], down: [0, 6], left: [-6, 0], right: [6, 0] }[player.facing];
  ctx.fillRect(Math.round(p.x + eye[0] - 2), Math.round(p.y + eye[1] - 2), 4, 4);
}
