export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  // Center on a target, easing toward it for smooth motion.
  follow(target, dt) {
    const t = 1 - Math.exp(-10 * dt);
    this.x += (target.x - this.width / 2 - this.x) * t;
    this.y += (target.y - this.height / 2 - this.y) * t;
  }

  snapTo(target) {
    this.x = target.x - this.width / 2;
    this.y = target.y - this.height / 2;
  }
}
