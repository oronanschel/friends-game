// Procedurally generated tile world. Deterministic for a given seed.

export const TILE_SIZE = 32;
export const WORLD_W = 256; // tiles
export const WORLD_H = 256; // tiles

export const TILES = {
  WATER: { id: 0, color: '#2b5fa8', solid: true },
  SAND: { id: 1, color: '#d9c58b', solid: false },
  GRASS: { id: 2, color: '#4f9a3d', solid: false },
  FOREST: { id: 3, color: '#2f6b2a', solid: false },
  TREE: { id: 4, color: '#1d4a1a', solid: true },
  ROCK: { id: 5, color: '#7a7a7a', solid: true },
};
const BY_ID = Object.values(TILES).sort((a, b) => a.id - b.id);

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth value noise built from a random lattice.
function makeNoise(rand, cell) {
  const gw = Math.ceil(WORLD_W / cell) + 2;
  const gh = Math.ceil(WORLD_H / cell) + 2;
  const grid = new Float32Array(gw * gh).map(() => rand());
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = x / cell;
    const gy = y / cell;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = smooth(gx - x0);
    const ty = smooth(gy - y0);
    const g = (i, j) => grid[j * gw + i];
    const a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * tx;
    const b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * tx;
    return a + (b - a) * ty;
  };
}

export class World {
  constructor(seed = 1337) {
    this.seed = seed;
    this.width = WORLD_W;
    this.height = WORLD_H;
    this.tiles = new Uint8Array(WORLD_W * WORLD_H);
    this.generate();
  }

  generate() {
    const rand = mulberry32(this.seed);
    const big = makeNoise(rand, 32);
    const mid = makeNoise(rand, 12);
    const small = makeNoise(rand, 4);
    const veg = makeNoise(rand, 16);
    const cx = WORLD_W / 2;
    const cy = WORLD_H / 2;

    for (let y = 0; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        // Island shape: height falls off toward the edges.
        const dx = (x - cx) / cx;
        const dy = (y - cy) / cy;
        const falloff = Math.sqrt(dx * dx + dy * dy);
        const h = big(x, y) * 0.6 + mid(x, y) * 0.3 + small(x, y) * 0.1 - falloff * 0.55;
        let t;
        if (h < 0.05) t = TILES.WATER;
        else if (h < 0.1) t = TILES.SAND;
        else if (h > 0.5) t = TILES.ROCK;
        else {
          const v = veg(x, y);
          if (v > 0.6) t = rand() < 0.35 ? TILES.TREE : TILES.FOREST;
          else t = rand() < 0.02 ? TILES.TREE : TILES.GRASS;
        }
        this.tiles[y * WORLD_W + x] = t.id;
      }
    }

    // Guarantee a walkable spawn area in the middle.
    for (let y = cy - 3; y <= cy + 3; y++) {
      for (let x = cx - 3; x <= cx + 3; x++) this.tiles[y * WORLD_W + x] = TILES.GRASS.id;
    }
    this.spawn = { x: cx * TILE_SIZE + TILE_SIZE / 2, y: cy * TILE_SIZE + TILE_SIZE / 2 };
  }

  tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return TILES.WATER;
    return BY_ID[this.tiles[ty * WORLD_W + tx]];
  }

  // Is the world-pixel point inside a solid tile?
  isSolidAt(px, py) {
    return this.tileAt(Math.floor(px / TILE_SIZE), Math.floor(py / TILE_SIZE)).solid;
  }

  draw(ctx, camera) {
    const x0 = Math.max(0, Math.floor(camera.x / TILE_SIZE));
    const y0 = Math.max(0, Math.floor(camera.y / TILE_SIZE));
    const x1 = Math.min(WORLD_W - 1, Math.floor((camera.x + camera.w) / TILE_SIZE));
    const y1 = Math.min(WORLD_H - 1, Math.floor((camera.y + camera.h) / TILE_SIZE));
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.tileAt(tx, ty);
        const sx = tx * TILE_SIZE - camera.x;
        const sy = ty * TILE_SIZE - camera.y;
        if (t === TILES.TREE) {
          ctx.fillStyle = TILES.FOREST.color;
          ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#5a3a1a';
          ctx.fillRect(sx + 13, sy + 18, 6, 12);
          ctx.fillStyle = t.color;
          ctx.beginPath();
          ctx.arc(sx + 16, sy + 14, 12, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = t.color;
          ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }
}
