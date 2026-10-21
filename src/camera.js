// Camera that follows a target and stays inside the world bounds.
export class Camera {
  constructor(w, h) {
    this.x = 0;
    this.y = 0;
    this.w = w;
    this.h = h;
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
  }

  follow(target, worldPxW, worldPxH) {
    this.x = Math.round(target.x - this.w / 2);
    this.y = Math.round(target.y - this.h / 2);
    this.x = Math.max(0, Math.min(this.x, worldPxW - this.w));
    this.y = Math.max(0, Math.min(this.y, worldPxH - this.h));
  }

  worldToScreen(x, y) {
    return { x: x - this.x, y: y - this.y };
  }
}
