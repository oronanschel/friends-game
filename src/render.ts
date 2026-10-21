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
import { type HeroColours, drawHero, walkFrame } from './player/sprite';
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

/** Wizard colours for the pixel-art hero: purple robe, silver hair and beard. */
const WIZARD: HeroColours = {
  skin: '#f2c9a0',
  hair: '#e6e9ef',
  tunic: '#5b2fa0',
  trousers: '#4a2585',
  boots: '#2a1a40',
};

/**
 * Draw the player as a powerful wizard: the animated pixel-art hero in a robe,
 * with a pointy starry hat, a white beard, a glowing staff and a turning magic ring.
 */
export function drawPlayer(ctx: CanvasRenderingContext2D, camera: Camera, player: Player): void {
  const p = camera.toScreen(player.x, player.y);
  const footY = p.y + player.size / 2;
  const frame = walkFrame(player.walked, player.moving);
  const t = performance.now() / 1000;
  const P = 2;
  const ox = Math.round(p.x - 5 * P);
  const oy = Math.round(footY - 14 * P);
  const by = frame === 1 || frame === 3 ? 1 : 0;
  const px = (gx: number, gy: number, w: number, h: number, colour: string) => {
    ctx.fillStyle = colour;
    ctx.fillRect(ox + gx * P, oy + gy * P, w * P, h * P);
  };
  const f = player.facing;

  // Magic ring under the feet.
  ctx.strokeStyle = 'rgba(170, 120, 255, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 4]);
  ctx.lineDashOffset = -t * 12;
  ctx.beginPath();
  ctx.ellipse(p.x, footY, 15, 6, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Staff behind the body when walking away, otherwise in front.
  const staffX = f === 'left' ? -1 : 10;
  const drawStaff = () => {
    px(staffX, 2 + by, 1, 12 - by, '#7a4a1e');
    const pulse = 0.75 + 0.25 * Math.sin(t * 5);
    const cx = ox + staffX * P + P / 2;
    const cy = oy + (1 + by) * P;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 9);
    glow.addColorStop(0, `rgba(255,255,255,${pulse})`);
    glow.addColorStop(0.4, `rgba(140,220,255,${0.8 * pulse})`);
    glow.addColorStop(1, 'rgba(120,80,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 9, cy - 9, 18, 18);
  };
  if (f === 'up') drawStaff();

  drawHero(ctx, p.x, footY, f, frame, WIZARD, P);
  // Robe hem over the legs.
  px(2, 10 + by, 6, 2, WIZARD.tunic);
  px(2, 11 + by, 6, 1, '#f2c230');

  // White beard.
  if (f === 'down') px(3, 4 + by, 4, 4, WIZARD.hair);
  else if (f === 'left') px(2, 4 + by, 2, 3, WIZARD.hair);
  else if (f === 'right') px(6, 4 + by, 2, 3, WIZARD.hair);

  // Pointy hat with a star, tip bending toward the facing side.
  const lean = f === 'left' ? -1 : f === 'right' ? 1 : 0;
  const hat = '#3a1f73';
  px(0, 0 + by, 10, 1, hat);
  px(2, -1 + by, 6, 1, hat);
  px(3, -2 + by, 4, 1, hat);
  px(3 + lean, -3 + by, 3, 1, hat);
  px(4 + lean, -4 + by, 2, 1, hat);
  px(4 + lean * 2, -5 + by, 1, 1, hat);
  px(4 + lean, -2 + by, 1, 1, '#ffe14d');

  if (f !== 'up') drawStaff();
}
