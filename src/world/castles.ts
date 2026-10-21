import { hash2 } from './noise';
import { Tile } from './tiles';

/** What a castle occupies on one tile. */
export enum CastlePart {
  None = 0,
  /** Cobbled courtyard: walkable. */
  Floor = 1,
  Wall = 2,
  Tower = 3,
  /** Open gate in the south wall: walkable. */
  Gate = 4,
  /** The main building in the courtyard. */
  Keep = 5,
}

/**
 * Castle layout, top row first. T tower, W wall, G gate, K keep, . courtyard.
 * The gate faces south so you walk in from below.
 */
const LAYOUT = [
  'TWWWWWWWT',
  'W.KKKKK.W',
  'W.KKKKK.W',
  'W.KKKKK.W',
  'W.......W',
  'W.......W',
  'W.......W',
  'TWWWGWWWT',
];
const PART_OF: Record<string, CastlePart> = {
  T: CastlePart.Tower,
  W: CastlePart.Wall,
  G: CastlePart.Gate,
  K: CastlePart.Keep,
  '.': CastlePart.Floor,
};

export const CASTLE_WIDTH = LAYOUT[0].length;
export const CASTLE_HEIGHT = LAYOUT.length;
/** The keep's tile rectangle, relative to the castle's top-left corner. */
export const KEEP = { x: 2, y: 1, w: 5, h: 3 };

/** Castles are placed at most one per CASTLE_CELL × CASTLE_CELL tile cell. */
export const CASTLE_CELL = 40;
/** Fraction of cells (other than the spawn cell) that try to hold a castle. */
const CASTLE_CHANCE = 0.45;
/** Empty tiles kept between a castle and its cell edge, so a castle never spans two cells. */
const CELL_MARGIN = 2;
/** Castles keep at least this many tiles (Chebyshev) away from the spawn point. */
const SPAWN_CLEARANCE = 6;
const PLACEMENT_TRIES = 12;

/** Ground a castle (and the one-tile ring around it) can stand on. */
const BUILDABLE = new Set<Tile>([Tile.Grass, Tile.Forest, Tile.Sand, Tile.Snow, Tile.Taiga]);

const BANNERS = ['#d32f2f', '#1976d2', '#fbc02d', '#7b1fa2', '#388e3c'];

export interface Castle {
  /** Top-left tile of the castle. */
  tx: number;
  ty: number;
  /** Flag colour. */
  banner: string;
}

/**
 * The castle in placement cell (cellX, cellY), or null if it has none.
 * Deterministic from the seed. The spawn cell always tries to get one so there is a castle to find nearby.
 */
export function findCastle(
  cellX: number,
  cellY: number,
  seed: number,
  getTile: (tx: number, ty: number) => Tile,
): Castle | null {
  const isSpawnCell = cellX === 0 && cellY === 0;
  if (!isSpawnCell && hash2(cellX, cellY, seed ^ 0xca57) >= CASTLE_CHANCE) return null;
  const range = CASTLE_CELL - CASTLE_WIDTH - 2 * CELL_MARGIN;
  for (let i = 0; i < PLACEMENT_TRIES; i++) {
    const tx = cellX * CASTLE_CELL + CELL_MARGIN + Math.floor(hash2(cellX * 31 + i, cellY, seed ^ 0xb0a7) * range);
    const ty = cellY * CASTLE_CELL + CELL_MARGIN + Math.floor(hash2(cellX, cellY * 31 + i, seed ^ 0xb0a7) * range);
    if (isSpawnCell && tx < SPAWN_CLEARANCE && ty < SPAWN_CLEARANCE) continue;
    if (canBuild(tx, ty, getTile)) {
      return { tx, ty, banner: BANNERS[Math.floor(hash2(cellX, cellY, seed ^ 0xf1a9) * BANNERS.length)] };
    }
  }
  return null;
}

function canBuild(tx: number, ty: number, getTile: (tx: number, ty: number) => Tile): boolean {
  for (let y = ty - 1; y <= ty + CASTLE_HEIGHT; y++) {
    for (let x = tx - 1; x <= tx + CASTLE_WIDTH; x++) if (!BUILDABLE.has(getTile(x, y))) return false;
  }
  return true;
}

/** The part of castle `c` on tile (tx, ty). */
export function castlePartAt(c: Castle, tx: number, ty: number): CastlePart {
  const lx = tx - c.tx;
  const ly = ty - c.ty;
  if (lx < 0 || ly < 0 || lx >= CASTLE_WIDTH || ly >= CASTLE_HEIGHT) return CastlePart.None;
  return PART_OF[LAYOUT[ly][lx]];
}

/** Whether tile (tx, ty) is on castle `c` or the one-tile ring around it (kept free of trees). */
export function isNearCastle(c: Castle, tx: number, ty: number): boolean {
  return tx >= c.tx - 1 && ty >= c.ty - 1 && tx <= c.tx + CASTLE_WIDTH && ty <= c.ty + CASTLE_HEIGHT;
}

export function isSolidCastlePart(p: CastlePart): boolean {
  return p === CastlePart.Wall || p === CastlePart.Tower || p === CastlePart.Keep;
}

/** Castle parts drawn in the y-sorted pass (they can hide the player). */
export function isTallCastlePart(p: CastlePart): boolean {
  return p === CastlePart.Wall || p === CastlePart.Tower;
}

const STONE = '#b8b1a5';
const STONE_DARK = '#8f887c';
const STONE_TOP = '#d6d0c4';

/** Draw a flat castle part (courtyard floor, gate) whose tile's top-left is at screen (x, y). */
export function drawCastleGround(ctx: CanvasRenderingContext2D, p: CastlePart, x: number, y: number, size: number): void {
  if (p === CastlePart.Gate) {
    // Lowered wooden drawbridge.
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#5d3d22';
    for (let i = 1; i < 4; i++) ctx.fillRect(x, y + (size * i) / 4, size, 2);
    return;
  }
  ctx.fillStyle = '#a39d92';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#928c81';
  const h = size / 2;
  ctx.fillRect(x, y + h - 1, size, 2);
  ctx.fillRect(x + h - 1, y, 2, h);
  ctx.fillRect(x + size / 4, y + h, 2, h);
  ctx.fillRect(x + (size * 3) / 4, y + h, 2, h);
}

/** Draw a wall or tower whose tile's top-left is at screen (x, y). It rises above its tile. */
export function drawCastleWall(ctx: CanvasRenderingContext2D, p: CastlePart, x: number, y: number, size: number): void {
  const tower = p === CastlePart.Tower;
  const rise = size * (tower ? 0.9 : 0.5);
  const inset = tower ? -2 : 0;
  const left = x + inset;
  const width = size - 2 * inset;
  const top = y - rise;
  // Front face.
  ctx.fillStyle = STONE;
  ctx.fillRect(left, top, width, size + rise);
  ctx.fillStyle = STONE_DARK;
  ctx.fillRect(left, y + size - 4, width, 4);
  ctx.fillRect(left, y + size * 0.35, width, 1);
  // Walkway on top with crenellations.
  ctx.fillStyle = STONE_TOP;
  ctx.fillRect(left, top, width, size * 0.3);
  ctx.fillStyle = STONE;
  const merlons = tower ? 3 : 2;
  const mw = width / (merlons * 2 - 1);
  for (let i = 0; i < merlons; i++) ctx.fillRect(left + i * 2 * mw, top - 5, mw, 6);
  if (tower) {
    // Arrow slit.
    ctx.fillStyle = '#3e3a35';
    ctx.fillRect(x + size / 2 - 2, y + size * 0.05, 4, size * 0.3);
  }
}

/** Draw castle `c`'s keep, with the castle's top-left tile at screen (x, y). */
export function drawKeep(ctx: CanvasRenderingContext2D, c: Castle, x: number, y: number, size: number): void {
  const left = x + KEEP.x * size;
  const top = y + KEEP.y * size;
  const w = KEEP.w * size;
  const h = KEEP.h * size;
  const roofH = size * 1.4;
  // Shadow, walls, roof.
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(left + 4, top + h - 4, w, 8);
  ctx.fillStyle = STONE;
  ctx.fillRect(left, top - size * 0.5, w, h + size * 0.5);
  ctx.fillStyle = STONE_DARK;
  ctx.fillRect(left, top + h - 4, w, 4);
  ctx.fillStyle = '#8e3b2f';
  ctx.beginPath();
  ctx.moveTo(left - 4, top - size * 0.5);
  ctx.lineTo(left + w / 2, top - size * 0.5 - roofH);
  ctx.lineTo(left + w + 4, top - size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.moveTo(left + w / 2, top - size * 0.5 - roofH);
  ctx.lineTo(left + w + 4, top - size * 0.5);
  ctx.lineTo(left + w / 2, top - size * 0.5);
  ctx.closePath();
  ctx.fill();
  // Door and windows.
  ctx.fillStyle = '#5d3d22';
  ctx.fillRect(left + w / 2 - size * 0.35, top + h - size * 0.9, size * 0.7, size * 0.9 - 4);
  ctx.fillStyle = '#3e3a35';
  for (const fx of [0.18, 0.82]) ctx.fillRect(left + w * fx - 4, top + size * 0.4, 8, 12);
  // Flag on the roof peak.
  const px = left + w / 2;
  const py = top - size * 0.5 - roofH;
  ctx.fillStyle = '#4e342e';
  ctx.fillRect(px - 1, py - size * 0.9, 2, size * 0.9);
  ctx.fillStyle = c.banner;
  ctx.beginPath();
  ctx.moveTo(px + 1, py - size * 0.9);
  ctx.lineTo(px + size * 0.6, py - size * 0.72);
  ctx.lineTo(px + 1, py - size * 0.54);
  ctx.closePath();
  ctx.fill();
}
