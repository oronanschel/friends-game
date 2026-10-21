import { TILE_SIZE, CHUNK_SIZE } from './config.js';

// Tile types. `solid` tiles block movement.
export const TILES = {
  grass: { color: '#4a8c3a', solid: false },
  sand: { color: '#d8c47a', solid: false },
  water: { color: '#2f6fb3', solid: true },
  tree: { color: '#22582a', solid: true },
  rock: { color: '#777777', solid: true },
};

// Deterministic hash noise so the infinite world is the same every visit.
function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(x, y, scale, seed) {
  const gx = Math.floor(x / scale);
  const gy = Math.floor(y / scale);
  const fx = x / scale - gx;
  const fy = y / scale - gy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(gx, gy, seed);
  const b = hash(gx + 1, gy, seed);
  const c = hash(gx, gy + 1, seed);
  const d = hash(gx + 1, gy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export class World {
  constructor(seed = 1) {
    this.seed = seed;
    this.chunks = new Map();
  }

  // Override or replace this to change world generation.
  generateTile(tx, ty) {
    if (Math.abs(tx) < 3 && Math.abs(ty) < 3) return 'grass'; // clear spawn area
    let height = smooth(tx, ty, 12, this.seed) * 0.7 + smooth(tx, ty, 4, this.seed + 1) * 0.3;
    // Raise land around the origin so spawn is never cut off by water.
    height += Math.max(0, 0.35 - Math.hypot(tx, ty) / 40);
    if (height < 0.3) return 'water';
    if (height < 0.36) return 'sand';
    const r = hash(tx, ty, this.seed + 7);
    if (height > 0.62 && height < 0.8 && r < 0.35) return 'tree';
    if (r < 0.02) return 'rock';
    return 'grass';
  }

  getChunk(cx, cy) {
    const key = `${cx},${cy}`;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Array(CHUNK_SIZE * CHUNK_SIZE);
      for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          chunk[y * CHUNK_SIZE + x] = this.generateTile(cx * CHUNK_SIZE + x, cy * CHUNK_SIZE + y);
        }
      }
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  getTile(tx, ty) {
    const cx = Math.floor(tx / CHUNK_SIZE);
    const cy = Math.floor(ty / CHUNK_SIZE);
    const lx = tx - cx * CHUNK_SIZE;
    const ly = ty - cy * CHUNK_SIZE;
    return this.getChunk(cx, cy)[ly * CHUNK_SIZE + lx];
  }

  setTile(tx, ty, type) {
    const cx = Math.floor(tx / CHUNK_SIZE);
    const cy = Math.floor(ty / CHUNK_SIZE);
    this.getChunk(cx, cy)[(ty - cy * CHUNK_SIZE) * CHUNK_SIZE + (tx - cx * CHUNK_SIZE)] = type;
  }

  isSolidAt(px, py) {
    const type = this.getTile(Math.floor(px / TILE_SIZE), Math.floor(py / TILE_SIZE));
    return TILES[type].solid;
  }
}
