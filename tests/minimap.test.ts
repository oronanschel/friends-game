import { describe, expect, it } from 'vitest';
import { minimapPixels } from '../src/ui/minimap';
import { TILE_INFO, Tile } from '../src/world/tiles';
import { World } from '../src/world/world';

describe('minimapPixels', () => {
  it('colours each pixel by the tile under it', () => {
    const world = new World(1);
    world.getTile = (tx: number) => (tx < 0 ? Tile.Water : Tile.Grass);
    const px = minimapPixels(world, 0, 0, 4); // covers tiles -2..1
    const hex = (i: number) => '#' + [px[i], px[i + 1], px[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    expect(hex(0)).toBe(TILE_INFO[Tile.Water].color); // tile -2
    expect(hex(3 * 4)).toBe(TILE_INFO[Tile.Grass].color); // tile 1
    expect(px[3]).toBe(255);
    expect(px.length).toBe(4 * 4 * 4);
  });
});
