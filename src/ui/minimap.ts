import { TILE_INFO, Tile } from '../world/tiles';
import { TILE_SIZE, World } from '../world/world';

/** Parse #rrggbb into [r, g, b]. */
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const TILE_RGB: Record<number, [number, number, number]> = {};
for (const [tile, info] of Object.entries(TILE_INFO)) TILE_RGB[Number(tile)] = rgb(info.color);

/**
 * RGBA pixels for a `size`×`size` tile area centred on tile (cx, cy),
 * one pixel per tile. Pure so it can be tested without a DOM.
 */
export function minimapPixels(world: World, cx: number, cy: number, size: number): Uint8ClampedArray<ArrayBuffer> {
  const px = new Uint8ClampedArray(size * size * 4);
  const x0 = cx - Math.floor(size / 2);
  const y0 = cy - Math.floor(size / 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = TILE_RGB[world.getTile(x0 + x, y0 + y) as Tile];
      const i = (y * size + x) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = 255;
    }
  }
  return px;
}

/**
 * Corner minimap showing the area around the player. Toggle with M.
 * The map image is only rebuilt when the player has moved a few tiles,
 * not every frame.
 */
export class Minimap {
  visible = true;
  /** Tiles shown along each side. */
  readonly tiles = 128;
  /** Screen pixels per tile. */
  readonly scale = 1.25;
  private image: HTMLCanvasElement;
  private centre: { tx: number; ty: number } | null = null;
  private static readonly REBUILD_DISTANCE = 6;

  constructor(target: Window = window) {
    this.image = document.createElement('canvas');
    this.image.width = this.tiles;
    this.image.height = this.tiles;
    target.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM' && !e.repeat) this.visible = !this.visible;
    });
  }

  draw(ctx: CanvasRenderingContext2D, world: World, playerX: number, playerY: number): void {
    if (!this.visible) return;
    const ptx = playerX / TILE_SIZE;
    const pty = playerY / TILE_SIZE;
    if (
      !this.centre ||
      Math.abs(ptx - this.centre.tx) > Minimap.REBUILD_DISTANCE ||
      Math.abs(pty - this.centre.ty) > Minimap.REBUILD_DISTANCE
    ) {
      this.rebuild(world, Math.floor(ptx), Math.floor(pty));
    }
    const c = this.centre!;
    const side = this.tiles * this.scale;
    const margin = 12;
    const sx = ctx.canvas.width - side - margin;
    const sy = margin;
    const half = side / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(sx - 3, sy - 3, side + 6, side + 6);
    ctx.beginPath();
    ctx.rect(sx, sy, side, side);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    // Image pixel i covers tile (c.tx - tiles/2 + i); shift so the player stays centred between rebuilds.
    const offX = (c.tx - this.tiles / 2 - ptx) * this.scale + half;
    const offY = (c.ty - this.tiles / 2 - pty) * this.scale + half;
    ctx.drawImage(this.image, sx + offX, sy + offY, side, side);
    ctx.restore();

    // Player dot in the centre.
    ctx.fillStyle = '#ff3b30';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx + half, sy + half, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  private rebuild(world: World, tx: number, ty: number): void {
    const pixels = minimapPixels(world, tx, ty, this.tiles);
    this.image.getContext('2d')!.putImageData(new ImageData(pixels, this.tiles, this.tiles), 0, 0);
    this.centre = { tx, ty };
  }
}
