import { ITEM_ORDER, type Inventory } from '../items/items';
import { drawItemIcon } from '../items/pickup';

const ROW = 26;
const PAD = 8;
const WIDTH = 92;
/** How long the row of a just-collected item stays highlighted, in ms. */
const FLASH_MS = 600;

/** Bottom-left panel listing collected items and their counts. */
export function drawInventoryHud(
  ctx: CanvasRenderingContext2D,
  inventory: Inventory,
  screenHeight: number,
  now = performance.now(),
): void {
  const h = PAD * 2 + ROW * ITEM_ORDER.length;
  const x0 = 10;
  const y0 = screenHeight - h - 10;
  ctx.fillStyle = 'rgba(20, 20, 28, 0.72)';
  ctx.fillRect(x0, y0, WIDTH, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, WIDTH - 1, h - 1);

  ctx.font = 'bold 15px monospace';
  ctx.textBaseline = 'middle';
  ITEM_ORDER.forEach((kind, i) => {
    const cy = y0 + PAD + ROW * i + ROW / 2;
    const last = inventory.lastPickup;
    if (last && last.kind === kind && now - last.at < FLASH_MS) {
      ctx.fillStyle = `rgba(255, 230, 120, ${0.45 * (1 - (now - last.at) / FLASH_MS)})`;
      ctx.fillRect(x0 + 2, cy - ROW / 2 + 1, WIDTH - 4, ROW - 2);
    }
    drawItemIcon(ctx, kind, x0 + PAD + 10, cy, 1.2);
    ctx.fillStyle = '#fff';
    ctx.fillText(`× ${inventory.counts[kind]}`, x0 + PAD + 26, cy + 1);
  });
  ctx.textBaseline = 'alphabetic';
}

