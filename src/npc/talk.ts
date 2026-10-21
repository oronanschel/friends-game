import type { Camera } from '../engine/camera';
import type { Game } from '../game';
import { TILE_SIZE } from '../world/world';
import { Dialogue } from './dialogue';
import { Npc } from './npc';
import { VILLAGERS } from './villagers';

/** How close the player must be to talk to an NPC. */
export const TALK_RANGE = 1.6 * TILE_SIZE;

/** Place the villagers around the spawn tile, each on the nearest walkable tile to their home. */
export function spawnVillagers(game: Game, spawnTx: number, spawnTy: number): Npc[] {
  return VILLAGERS.map((def, i) => {
    const t = game.world.findWalkableNear(spawnTx + def.home.dx, spawnTy + def.home.dy, 20);
    const npc = new Npc((t.tx + 0.5) * TILE_SIZE, (t.ty + 0.5) * TILE_SIZE, def, game.world.seed + i * 7919);
    game.entities.push(npc);
    return npc;
  });
}

/** The NPC within talking range closest to the player, if any. */
export function nearestNpc(game: Game, range = TALK_RANGE): Npc | null {
  let best: Npc | null = null;
  let bestDist = range;
  for (const e of game.entities) {
    if (!(e instanceof Npc)) continue;
    const d = Math.hypot(e.x - game.player.x, e.y - game.player.y);
    if (d <= bestDist) {
      best = e;
      bestDist = d;
    }
  }
  return best;
}

type Rect = { x: number; y: number; w: number; h: number };
const inside = (r: Rect | null, x: number, y: number) =>
  !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/**
 * Lets the player talk to nearby NPCs: E / Space / Enter (or a tap on the prompt or box)
 * starts and advances a conversation, Esc ends it.
 */
export class TalkController {
  readonly dialogue = new Dialogue();
  /** NPC currently in talking range (or being talked to). */
  target: Npc | null = null;
  private pending: ('confirm' | 'cancel')[] = [];
  /** Where the prompt / dialogue box was last drawn, for taps. */
  private promptRect: Rect | null = null;
  private boxRect: Rect | null = null;

  constructor(target: Window = window, canvas?: HTMLCanvasElement) {
    target.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') this.pending.push('confirm');
      else if (e.code === 'Escape') this.pending.push('cancel');
    });
    canvas?.addEventListener('pointerdown', (e) => {
      if (inside(this.boxRect, e.offsetX, e.offsetY) || inside(this.promptRect, e.offsetX, e.offsetY)) {
        this.pending.push('confirm');
      }
    });
  }

  /** True while a conversation is open (the player should not walk). */
  get busy(): boolean {
    return this.dialogue.open;
  }

  /** Queue an action directly (used by tests and other controls). */
  press(action: 'confirm' | 'cancel'): void {
    this.pending.push(action);
  }

  update(game: Game): void {
    if (!this.dialogue.open) {
      if (this.target) this.target.talking = false;
      this.target = nearestNpc(game);
    } else if (this.target && Math.hypot(this.target.x - game.player.x, this.target.y - game.player.y) > TALK_RANGE * 2) {
      this.end();
    }
    for (const action of this.pending.splice(0)) {
      if (action === 'cancel') {
        this.end();
      } else if (this.dialogue.open) {
        this.dialogue.advance(game.inventory);
        if (!this.dialogue.open) this.end();
      } else if (this.target) {
        this.target.talking = true;
        this.dialogue.start(this.target.def);
      }
    }
  }

  private end(): void {
    this.dialogue.close();
    if (this.target) this.target.talking = false;
  }

  /** Draw the "talk" prompt above the nearby NPC and the dialogue box. Screen space. */
  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    this.promptRect = null;
    this.boxRect = null;
    const page = this.dialogue.page;
    if (!page && this.target) {
      const p = camera.toScreen(this.target.x, this.target.y);
      const text = `E: talk to ${this.target.def.name}`;
      ctx.font = 'bold 13px monospace';
      const w = Math.round(ctx.measureText(text).width + 14);
      const r = { x: Math.round(p.x - w / 2), y: Math.round(p.y - 50), w, h: 20 };
      ctx.fillStyle = 'rgba(20, 20, 28, 0.8)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, r.x + 7, r.y + r.h / 2 + 1);
      ctx.textBaseline = 'alphabetic';
      this.promptRect = r;
      return;
    }
    if (!page || !this.dialogue.def) return;

    const w = Math.min(560, camera.width - 20);
    const lines = wrap(ctx, page.text, w - 28, '15px monospace');
    const h = 46 + lines.length * 20;
    const r = { x: Math.round((camera.width - w) / 2), y: Math.round(camera.height - h - 120), w, h };
    ctx.fillStyle = 'rgba(20, 20, 28, 0.9)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = this.dialogue.def.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    ctx.fillStyle = this.dialogue.def.color;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(this.dialogue.def.name, r.x + 14, r.y + 22);
    ctx.fillStyle = '#fff';
    ctx.font = '15px monospace';
    lines.forEach((line, i) => ctx.fillText(line, r.x + 14, r.y + 44 + i * 20));
    if (!page.trade) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '12px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('E ▸', r.x + r.w - 12, r.y + r.h - 10);
      ctx.textAlign = 'left';
    }
    this.boxRect = r;
  }
}

/** Split text into lines that fit `maxWidth`. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: string): string[] {
  ctx.font = font;
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
