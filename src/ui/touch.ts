import type { Input } from '../engine/input';

/** Joystick vector for a drag of (dx, dy) pixels: length clamped to 1, with a small dead zone. */
export function joystickVector(dx: number, dy: number, radius: number, deadZone = 0.15): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  if (len < radius * deadZone) return { x: 0, y: 0 };
  const scale = Math.min(len, radius) / len / radius;
  return { x: dx * scale, y: dy * scale };
}

interface Button {
  label: string;
  /** Centre relative to the bottom-right corner of the screen. */
  dx: number;
  dy: number;
  r: number;
  pressed: boolean;
  /** Called on press; return nothing. */
  onDown?: () => void;
  onUp?: () => void;
}

/**
 * On-screen controls for phones and tablets: drag anywhere on the left half
 * for a floating joystick; buttons on the right to run and toggle the map.
 * Only shown after the first touch, so desktop players never see it.
 */
export class TouchControls {
  active = false;
  private readonly radius = 56;
  private stick: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  private buttons: Button[];
  private buttonTouches = new Map<number, Button>();

  constructor(
    private canvas: HTMLCanvasElement,
    private input: Input,
    actions: { toggleMap: () => void },
  ) {
    this.buttons = [
      {
        label: 'RUN',
        dx: 70,
        dy: 80,
        r: 38,
        pressed: false,
        onDown: () => (input.virtualRun = true),
        onUp: () => (input.virtualRun = false),
      },
      { label: 'MAP', dx: 150, dy: 60, r: 28, pressed: false, onDown: actions.toggleMap },
    ];
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', (e) => this.up(e));
  }

  private buttonAt(x: number, y: number): Button | undefined {
    const w = this.canvas.width;
    const h = this.canvas.height;
    return this.buttons.find((b) => Math.hypot(x - (w - b.dx), y - (h - b.dy)) <= b.r + 8);
  }

  private down(e: PointerEvent): void {
    if (e.pointerType !== 'touch') return;
    this.active = true;
    e.preventDefault();
    const button = this.buttonAt(e.clientX, e.clientY);
    if (button) {
      button.pressed = true;
      button.onDown?.();
      this.buttonTouches.set(e.pointerId, button);
      return;
    }
    if (!this.stick && e.clientX < this.canvas.width / 2) {
      this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
    }
  }

  private move(e: PointerEvent): void {
    if (!this.stick || e.pointerId !== this.stick.id) return;
    e.preventDefault();
    this.stick.x = e.clientX;
    this.stick.y = e.clientY;
    this.input.virtualAxis = joystickVector(e.clientX - this.stick.ox, e.clientY - this.stick.oy, this.radius);
  }

  private up(e: PointerEvent): void {
    const button = this.buttonTouches.get(e.pointerId);
    if (button) {
      button.pressed = false;
      button.onUp?.();
      this.buttonTouches.delete(e.pointerId);
    }
    if (this.stick && e.pointerId === this.stick.id) {
      this.stick = null;
      this.input.virtualAxis = { x: 0, y: 0 };
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.save();
    if (this.stick) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.stick.ox, this.stick.oy, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const v = this.input.virtualAxis;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(this.stick.ox + v.x * this.radius, this.stick.oy + v.y * this.radius, 24, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const b of this.buttons) {
      const x = w - b.dx;
      const y = h - b.dy;
      ctx.fillStyle = b.pressed ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.2)';
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(x, y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillText(b.label, x, y);
    }
    ctx.restore();
  }
}
