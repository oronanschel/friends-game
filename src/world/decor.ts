import { hash2 } from './noise';
import { Tile } from './tiles';

/** Objects that sit on top of a tile. Chosen deterministically from the seed. */
export enum Decor {
  None = 0,
  Tree = 1,
  PineTree = 2,
  Bush = 3,
  Flowers = 4,
  Pebbles = 5,
  Boulder = 6,
}

/** Decor that blocks movement. */
const SOLID_DECOR = new Set<Decor>([Decor.Tree, Decor.PineTree, Decor.Boulder]);

export function isSolidDecor(d: Decor): boolean {
  return SOLID_DECOR.has(d);
}

/** Decor that is tall enough to be drawn in the y-sorted pass (can hide the player). */
export function isTallDecor(d: Decor): boolean {
  return d === Decor.Tree || d === Decor.PineTree;
}

/** Tiles this close to the origin never get solid decor, so spawn stays open. */
const CLEAR_SPAWN_RADIUS = 3;

/** Pick the decor for one tile from its type and a per-tile random number. */
export function chooseDecor(tile: Tile, tx: number, ty: number, seed: number): Decor {
  const r = hash2(tx, ty, seed ^ 0x5eed);
  let d = Decor.None;
  switch (tile) {
    case Tile.Forest:
      d = r < 0.38 ? Decor.Tree : r < 0.46 ? Decor.Bush : Decor.None;
      break;
    case Tile.Grass:
      d = r < 0.025 ? Decor.Tree : r < 0.05 ? Decor.Bush : r < 0.13 ? Decor.Flowers : Decor.None;
      break;
    case Tile.Sand:
      d = r < 0.04 ? Decor.Pebbles : Decor.None;
      break;
    case Tile.Snow:
      d = r < 0.12 ? Decor.PineTree : r < 0.16 ? Decor.Boulder : Decor.None;
      break;
    default:
      break;
  }
  if (isSolidDecor(d) && Math.max(Math.abs(tx), Math.abs(ty)) <= CLEAR_SPAWN_RADIUS) return Decor.None;
  return d;
}

/** Draw decor whose tile's top-left corner is at screen (x, y). */
export function drawDecor(ctx: CanvasRenderingContext2D, d: Decor, x: number, y: number, size: number, variant: number): void {
  const cx = x + size / 2;
  switch (d) {
    case Decor.Tree: {
      // Trunk sits on the tile; the canopy overhangs the tile above.
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(cx, y + size * 0.85, size * 0.42, size * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6b4423';
      ctx.fillRect(cx - size * 0.09, y + size * 0.4, size * 0.18, size * 0.48);
      const green = variant < 0.5 ? '#2e7d32' : '#388e3c';
      ctx.fillStyle = green;
      ctx.beginPath();
      ctx.arc(cx, y + size * 0.1, size * 0.48, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(cx - size * 0.15, y - size * 0.05, size * 0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case Decor.PineTree: {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(cx, y + size * 0.88, size * 0.32, size * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(cx - size * 0.07, y + size * 0.6, size * 0.14, size * 0.3);
      ctx.fillStyle = '#1b5e20';
      for (let i = 0; i < 3; i++) {
        const top = y - size * 0.5 + i * size * 0.3;
        const half = size * (0.22 + i * 0.1);
        ctx.beginPath();
        ctx.moveTo(cx, top);
        ctx.lineTo(cx + half, top + size * 0.5);
        ctx.lineTo(cx - half, top + size * 0.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#f5f7f8';
      ctx.beginPath();
      ctx.moveTo(cx, y - size * 0.5);
      ctx.lineTo(cx + size * 0.1, y - size * 0.3);
      ctx.lineTo(cx - size * 0.1, y - size * 0.3);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case Decor.Bush:
      ctx.fillStyle = '#3f7f2f';
      ctx.beginPath();
      ctx.arc(cx - size * 0.14, y + size * 0.6, size * 0.2, 0, Math.PI * 2);
      ctx.arc(cx + size * 0.14, y + size * 0.6, size * 0.2, 0, Math.PI * 2);
      ctx.arc(cx, y + size * 0.48, size * 0.22, 0, Math.PI * 2);
      ctx.fill();
      break;
    case Decor.Flowers: {
      const colors = ['#ffeb3b', '#f06292', '#ffffff', '#ba68c8'];
      ctx.fillStyle = colors[Math.floor(variant * colors.length)];
      for (let i = 0; i < 4; i++) {
        const fx = x + size * (0.2 + ((variant * 7 + i * 0.37) % 0.6));
        const fy = y + size * (0.2 + ((variant * 13 + i * 0.53) % 0.6));
        ctx.fillRect(Math.round(fx), Math.round(fy), 3, 3);
      }
      break;
    }
    case Decor.Pebbles:
      ctx.fillStyle = '#a1887f';
      ctx.fillRect(Math.round(x + size * 0.3), Math.round(y + size * 0.5), 4, 3);
      ctx.fillRect(Math.round(x + size * 0.6), Math.round(y + size * 0.35), 3, 3);
      break;
    case Decor.Boulder:
      ctx.fillStyle = '#90a4ae';
      ctx.beginPath();
      ctx.ellipse(cx, y + size * 0.6, size * 0.38, size * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#cfd8dc';
      ctx.beginPath();
      ctx.ellipse(cx - size * 0.08, y + size * 0.48, size * 0.16, size * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    default:
      break;
  }
}
