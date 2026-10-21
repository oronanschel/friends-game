import { FAINT_TIME, type Health, MAX_HEARTS } from '../player/health';

/** Hearts sit just above the inventory panel in the bottom-left corner. */
const HEARTS_BOTTOM = 152;

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, full: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.bezierCurveTo(-8, -2, -5, -9, 0, -5);
  ctx.bezierCurveTo(5, -9, 8, -2, 0, 4);
  ctx.closePath();
  ctx.fillStyle = full ? '#e53935' : 'rgba(40,40,40,0.6)';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#000';
  ctx.stroke();
  if (full) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(-4, -5, 2, 2);
  }
  ctx.restore();
}

/** Hearts row above the inventory, a red flash when hit, and the faint screen. */
export function drawHealthHud(ctx: CanvasRenderingContext2D, health: Health, width: number, height: number): void {
  // Red edge flash right after a hit.
  if (health.sinceHit < 0.35) {
    const a = 0.45 * (1 - health.sinceHit / 0.35);
    const g = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, Math.max(width, height) * 0.7);
    g.addColorStop(0, 'rgba(200,0,0,0)');
    g.addColorStop(1, `rgba(200,0,0,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  // Hearts blink while invulnerable.
  const blink = health.invulnerable > 0 && Math.floor(health.invulnerable * 10) % 2 === 0;
  for (let i = 0; i < MAX_HEARTS; i++) {
    const full = i < health.hearts;
    if (blink && i === health.hearts) continue;
    drawHeart(ctx, 24 + i * 26, height - HEARTS_BOTTOM, 1.6, full);
  }

  if (!health.awake) {
    const fade = Math.min(1, (FAINT_TIME - health.fainted) / 0.5);
    ctx.fillStyle = `rgba(0,0,0,${0.75 * fade})`;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('You fainted…', width / 2, height / 2 - 6);
    ctx.font = '15px monospace';
    ctx.fillText('waking up back at camp', width / 2, height / 2 + 22);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
}
