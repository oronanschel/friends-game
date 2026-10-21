/** Fixed-timestep update with variable-rate rendering. */
export function startLoop(update: (dt: number) => void, render: () => void, step = 1 / 60): () => void {
  let last = performance.now();
  let acc = 0;
  let running = true;
  const frame = (now: number) => {
    if (!running) return;
    // Clamp to avoid a huge catch-up after the tab was in the background.
    acc += Math.min((now - last) / 1000, 0.25);
    last = now;
    while (acc >= step) {
      update(step);
      acc -= step;
    }
    render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return () => {
    running = false;
  };
}
