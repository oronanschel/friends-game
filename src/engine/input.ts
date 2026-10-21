/** Tracks which keys are currently held down. */
export class Input {
  private down = new Set<string>();
  /** Analog direction from on-screen controls, each axis in [-1, 1]. */
  virtualAxis = { x: 0, y: 0 };
  /** Run button held on on-screen controls. */
  virtualRun = false;

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => this.down.add(e.code));
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => this.down.clear());
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** Whether a run key (Shift) is held. */
  running(): boolean {
    return this.virtualRun || this.isDown('ShiftLeft') || this.isDown('ShiftRight');
  }

  /** Movement direction from WASD / arrow keys, or the on-screen joystick when no key is held. */
  axis(): { x: number; y: number } {
    const x =
      (this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0) -
      (this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0);
    const y =
      (this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0) -
      (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0);
    if (x === 0 && y === 0) return { ...this.virtualAxis };
    return { x, y };
  }
}
