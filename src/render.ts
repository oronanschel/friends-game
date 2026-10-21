import { Camera } from './engine/camera';
import type { Entity } from './game';
import type { Player } from './player/player';
import {
  CASTLE_HEIGHT,
  type Castle,
  CastlePart,
  drawCastleGround,
  drawCastleWall,
  drawKeep,
  isTallCastlePart,
  KEEP,
} from './world/castles';
import { Decor, drawDecor, isTallDecor } from './world/decor';
import { hash2 } from './world/noise';
import { TILE_INFO, Tile } from './world/tiles';
import { TILE_SIZE, World } from './world/world';

/** Scale a #rrggbb colour's brightness by `f` (1 = unchanged). */
export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  const r = c((n >> 16) & 255);
  const g = c((n >> 8) & 255);
  const b = c(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** A few brightness variants per tile type so the ground doesn't look flat. */
const SHADES: Record<number, string[]> = {};
for (const [tile, info] of Object.entries(TILE_INFO)) {
  SHADES[Number(tile)] = [0.96, 0.99, 1.01, 1.04].map((f) => shade(info.color, f));
}

/** Draw the visible part of the world and the player. */
export function render(
  ctx: CanvasRenderingContext2D,
  world: World,
  camera: Camera,
  player: Player,
  entities: Entity[] = [],
): void {
  const { width, height } = camera;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  const tx0 = Math.floor(camera.left / TILE_SIZE);
  const ty0 = Math.floor(camera.top / TILE_SIZE);
  const tx1 = Math.floor((camera.left + width) / TILE_SIZE);
  const ty1 = Math.floor((camera.top + height) / TILE_SIZE);
  const ox = Math.round(-camera.left);
  const oy = Math.round(-camera.top);

  // Ground tiles and flat decor (flowers, bushes, ...).
  const drawables: Pick<Entity, 'y' | 'draw'>[] = [...entities, player];
  const keeps = new Set<Castle>();
  // Walls and keeps rise above their tiles, so look a few rows below the screen too.
  for (let ty = ty0; ty <= ty1 + CASTLE_HEIGHT; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const sx = tx * TILE_SIZE + ox;
      const sy = ty * TILE_SIZE + oy;
      const castle = world.castleAt(tx, ty);
      if (castle) {
        const { castle: c, part } = castle;
        if (isTallCastlePart(part)) {
          const baseY = (ty + 1) * TILE_SIZE - 4;
          drawables.push({ y: baseY, draw: (cx) => drawCastleWall(cx, part, sx, sy, TILE_SIZE) });
        } else {
          drawCastleGround(ctx, CastlePart.Floor, sx, sy, TILE_SIZE);
          if (part === CastlePart.Gate) drawCastleGround(ctx, part, sx, sy, TILE_SIZE);
          if (part === CastlePart.Keep && !keeps.has(c)) {
            // The keep is one big building: draw it once, sorted by its front edge.
            keeps.add(c);
            const kx = c.tx * TILE_SIZE + ox;
            const ky = c.ty * TILE_SIZE + oy;
            const baseY = (c.ty + KEEP.y + KEEP.h) * TILE_SIZE - 4;
            drawables.push({ y: baseY, draw: (cx) => drawKeep(cx, c, kx, ky, TILE_SIZE) });
          }
        }
        continue;
      }
      if (ty > ty1 + 1) continue;
      const tile: Tile = world.getTile(tx, ty);
      const variant = hash2(tx, ty, world.seed);
      ctx.fillStyle = SHADES[tile][Math.floor(variant * 4)];
      ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
      const decor = world.getDecor(tx, ty);
      if (decor === Decor.None) continue;
      if (isTallDecor(decor)) {
        // Tall decor is depth-sorted with the player so you can walk behind trees.
        const baseY = (ty + 1) * TILE_SIZE - 4;
        drawables.push({ y: baseY, draw: (c) => drawDecor(c, decor, sx, sy, TILE_SIZE, variant) });
      } else {
        drawDecor(ctx, decor, sx, sy, TILE_SIZE, variant);
      }
    }
  }

  // Entities, tall decor and the player, sorted by y for simple depth.
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw?.(ctx, camera);
}

/** Draw the player: a simple body with a facing indicator. */
export function drawPlayer(ctx: CanvasRenderingContext2D, camera: Camera, player: Player): void {
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
