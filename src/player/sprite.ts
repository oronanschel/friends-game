/** Facing directions shared by the player and sprites. */
export type Facing = 'up' | 'down' | 'left' | 'right';

/** Pixels walked per animation frame. */
const STRIDE = 7;

/** Walk-cycle frame (0-3) for the distance walked; frame 0 is standing. */
export function walkFrame(distance: number, moving: boolean): number {
  if (!moving) return 0;
  return Math.floor(distance / STRIDE) % 4;
}

/** Vertical leg offsets [left, right] in sprite pixels for a walk frame. */
export function legOffsets(frame: number): [number, number] {
  return ([[0, 0], [-1, 1], [0, 0], [1, -1]] as const)[frame % 4] as [number, number];
}

export interface HeroColours {
  skin: string;
  hair: string;
  tunic: string;
  trousers: string;
  boots: string;
}

export const HERO: HeroColours = {
  skin: '#f2c9a0',
  hair: '#5b3a1e',
  tunic: '#d9483b',
  trousers: '#3b4a7a',
  boots: '#3a2a1a',
};

/**
 * Draw a small pixel-art hero whose feet are at screen (x, footY).
 * `P` is the size of one sprite pixel in screen pixels.
 */
export function drawHero(
  ctx: CanvasRenderingContext2D,
  x: number,
  footY: number,
  facing: Facing,
  frame: number,
  colours: HeroColours = HERO,
  P = 2,
): void {
  // Sprite grid is 10 wide x 14 tall; (0,0) is top-left.
  const ox = Math.round(x - 5 * P);
  const oy = Math.round(footY - 14 * P);
  const px = (gx: number, gy: number, w: number, h: number, colour: string) => {
    ctx.fillStyle = colour;
    ctx.fillRect(ox + gx * P, oy + gy * P, w * P, h * P);
  };
  const [legL, legR] = legOffsets(frame);
  const bob = frame === 1 || frame === 3 ? 1 : 0;

  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, footY, 4 * P, 1.4 * P, 0, 0, Math.PI * 2);
  ctx.fill();

  const side = facing === 'left' || facing === 'right';
  // Legs and boots.
  if (side) {
    px(3, 10 + legL, 2, 3, colours.trousers);
    px(5, 10 + legR, 2, 3, colours.trousers);
    px(facing === 'left' ? 2 : 3, 13 + Math.min(0, legL), 3, 1, colours.boots);
    px(facing === 'left' ? 4 : 5, 13 + Math.min(0, legR), 3, 1, colours.boots);
  } else {
    px(3, 10 + legL, 2, 3, colours.trousers);
    px(5, 10 + legR, 2, 3, colours.trousers);
    px(3, 13 + Math.min(0, legL), 2, 1, colours.boots);
    px(5, 13 + Math.min(0, legR), 2, 1, colours.boots);
  }

  // Body (bobs while walking) with arms swinging opposite to legs.
  const by = bob;
  px(2, 6 + by, 6, 4, colours.tunic);
  px(2, 9 + by, 6, 1, '#00000033');
  if (side) {
    px(facing === 'left' ? 6 : 3, 6 + by + legL, 1, 3, colours.skin);
  } else {
    px(1, 6 + by + legR, 1, 3, colours.skin);
    px(8, 6 + by + legL, 1, 3, colours.skin);
  }

  // Head.
  px(2, 1 + by, 6, 5, colours.skin);
  px(2, 0 + by, 6, 2, colours.hair);
  switch (facing) {
    case 'down':
      px(2, 2 + by, 1, 1, colours.hair);
      px(7, 2 + by, 1, 1, colours.hair);
      px(3, 3 + by, 1, 1, '#222');
      px(6, 3 + by, 1, 1, '#222');
      px(4, 5 + by, 2, 1, '#c98a6a');
      break;
    case 'up':
      px(2, 1 + by, 6, 4, colours.hair);
      break;
    case 'left':
      px(5, 1 + by, 3, 3, colours.hair);
      px(3, 3 + by, 1, 1, '#222');
      break;
    case 'right':
      px(2, 1 + by, 3, 3, colours.hair);
      px(6, 3 + by, 1, 1, '#222');
      break;
  }
}
