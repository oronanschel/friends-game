/** A camera centred on a world position; converts world to screen coordinates. */
export class Camera {
  x = 0;
  y = 0;

  constructor(public width: number, public height: number) {}

  /** Smoothly follow a target. `t` in [0, 1] is how far to move this frame. */
  follow(tx: number, ty: number, t = 1): void {
    this.x += (tx - this.x) * t;
    this.y += (ty - this.y) * t;
  }

  /** World-space left edge of the view. */
  get left(): number {
    return this.x - this.width / 2;
  }

  /** World-space top edge of the view. */
  get top(): number {
    return this.y - this.height / 2;
  }

  toScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: wx - this.left, y: wy - this.top };
  }
}
