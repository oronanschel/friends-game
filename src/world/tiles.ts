export enum Tile {
  DeepWater = 0,
  Water = 1,
  Sand = 2,
  Grass = 3,
  Forest = 4,
  Rock = 5,
  Snow = 6,
  /** Pine forest on high ground. */
  Taiga = 7,
}

export interface TileInfo {
  name: string;
  color: string;
  /** Solid tiles block movement. */
  solid: boolean;
}

export const TILE_INFO: Record<Tile, TileInfo> = {
  [Tile.DeepWater]: { name: 'Deep water', color: '#1d3f8f', solid: true },
  [Tile.Water]: { name: 'Water', color: '#2f62c4', solid: true },
  [Tile.Sand]: { name: 'Sand', color: '#e3d18a', solid: false },
  [Tile.Grass]: { name: 'Grass', color: '#5fa84a', solid: false },
  [Tile.Forest]: { name: 'Forest', color: '#2f6e34', solid: false },
  [Tile.Rock]: { name: 'Rock', color: '#7d7a73', solid: true },
  [Tile.Snow]: { name: 'Snow', color: '#eef2f5', solid: false },
  [Tile.Taiga]: { name: 'Pine forest', color: '#3d6b4f', solid: false },
};

export function isSolid(tile: Tile): boolean {
  return TILE_INFO[tile].solid;
}
