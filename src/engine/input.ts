/** Tracks which keys are currently held down. */
export class Input {
  private down = new Set<string>();

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => this.down.add(e.code));
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => this.down.clear());
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** Movement direction from WASD / arrow keys, each axis in {-1, 0, 1}. */
  axis(): { x: number; y: number } {
    const x =
      (this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0) -
      (this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0);
    const y =
      (this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0) -
      (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0);
    return { x, y };
  }
}
