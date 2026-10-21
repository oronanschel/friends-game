import { fractalNoise } from './noise';
import { Tile, isSolid } from './tiles';

/** Size of one tile in world pixels. */
export const TILE_SIZE = 32;
/** Width/height of a chunk in tiles. */
export const CHUNK_SIZE = 32;

/** Pick a tile from elevation and moisture, both in [0, 1). */
export function classify(elevation: number, moisture: number): Tile {
  if (elevation < 0.3) return Tile.DeepWater;
  if (elevation < 0.4) return Tile.Water;
  if (elevation < 0.43) return Tile.Sand;
  if (elevation > 0.78) return Tile.Snow;
  if (elevation > 0.68) return Tile.Rock;
  return moisture > 0.55 ? Tile.Forest : Tile.Grass;
}

/**
 * An endless procedurally generated world, generated lazily in chunks.
 * The same seed always produces the same world.
 */
export class World {
  private chunks = new Map<string, Uint8Array>();

  constructor(readonly seed: number) {}

  /** Tile at integer tile coordinates. */
  getTile(tx: number, ty: number): Tile {
    const cx = Math.floor(tx / CHUNK_SIZE);
    const cy = Math.floor(ty / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cy);
    const lx = tx - cx * CHUNK_SIZE;
    const ly = ty - cy * CHUNK_SIZE;
    return chunk[ly * CHUNK_SIZE + lx] as Tile;
  }

  /** Whether the tile at the given tile coordinates blocks movement. */
  isSolidAt(tx: number, ty: number): boolean {
    return isSolid(this.getTile(tx, ty));
  }

  /** Number of chunks generated so far (for debugging/HUD). */
  get loadedChunks(): number {
    return this.chunks.size;
  }

  /** Find the walkable tile closest to (tx, ty), searching in growing rings. */
  findWalkableNear(tx: number, ty: number, maxRadius = 500): { tx: number; ty: number } {
    for (let r = 0; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (!this.isSolidAt(tx + dx, ty + dy)) return { tx: tx + dx, ty: ty + dy };
        }
      }
    }
    return { tx, ty };
  }

  private getChunk(cx: number, cy: number): Uint8Array {
    const key = `${cx},${cy}`;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = this.generateChunk(cx, cy);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  private generateChunk(cx: number, cy: number): Uint8Array {
    const data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const tx = cx * CHUNK_SIZE + lx;
        const ty = cy * CHUNK_SIZE + ly;
        // Raise land around the origin so the spawn is never a tiny island.
        const spawnBoost = 0.3 * Math.max(0, 1 - Math.hypot(tx, ty) / 24);
        const elevation = Math.min(0.66, fractalNoise(tx / 64, ty / 64, this.seed, 5) + spawnBoost);
        const moisture = fractalNoise(tx / 48, ty / 48, this.seed + 7777, 3);
        data[ly * CHUNK_SIZE + lx] = classify(elevation, moisture);
      }
    }
    return data;
  }
}
