import { drawStoneIcon } from '../power/powerWorld';
import { type PowerStones, STONE_INFO, STONE_ORDER, type StoneKind } from '../power/stones';

const SLOT = 52;
const GAP = 8;
const FLASH_MS = 600;

/** Screen rectangle of each stone slot: a row centred at the bottom of the screen. */
export function stoneSlots(screenWidth: number, screenHeight: number): { kind: StoneKind; x: number; y: number; w: number; h: number }[] {
  const total = STONE_ORDER.length * SLOT + (STONE_ORDER.length - 1) * GAP;
  const x0 = Math.round((screenWidth - total) / 2);
  const y = screenHeight - SLOT - 12;
  return STONE_ORDER.map((kind, i) => ({ kind, x: x0 + i * (SLOT + GAP), y, w: SLOT, h: SLOT }));
}

/** The stone slot under a screen point, if any (for taps). */
export function stoneSlotAt(px: number, py: number, screenWidth: number, screenHeight: number): StoneKind | null {
  const hit = stoneSlots(screenWidth, screenHeight).find((s) => px >= s.x && px < s.x + s.w && py >= s.y && py < s.y + s.h);
  return hit ? hit.kind : null;
}

/** Bottom-centre bar: each power stone with its count, key, and a timer while active. */
export function drawStoneHud(ctx: CanvasRenderingContext2D, stones: PowerStones, now = performance.now()): void {
  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const s of stoneSlots(width, height)) {
    const info = STONE_INFO[s.kind];
    const count = stones.counts[s.kind];
    const left = stones.active[s.kind];
    ctx.fillStyle = 'rgba(20, 20, 28, 0.72)';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    const last = stones.lastChange;
    if (last && last.kind === s.kind && now - last.at < FLASH_MS) {
      ctx.fillStyle = `rgba(${info.glow}, ${0.5 * (1 - (now - last.at) / FLASH_MS)})`;
      ctx.fillRect(s.x, s.y, s.w, s.h);
    }
    ctx.strokeStyle = left > 0 ? info.color : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = left > 0 ? 2.5 : 1;
    ctx.strokeRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1);

    ctx.globalAlpha = count > 0 || left > 0 ? 1 : 0.35;
    drawStoneIcon(ctx, s.kind, s.x + s.w / 2, s.y + s.h / 2 - 3, 1.4, left > 0 ? 1 : 0.4);
    ctx.globalAlpha = 1;

    // Remaining time as a bar along the bottom of the slot.
    if (left > 0) {
      ctx.fillStyle = info.color;
      ctx.fillRect(s.x + 3, s.y + s.h - 6, (s.w - 6) * (left / info.duration), 3);
    }
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(info.key, s.x + 8, s.y + 9);
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(`×${count}`, s.x + s.w - 14, s.y + s.h - 14);
  }
  ctx.restore();
}
