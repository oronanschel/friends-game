import type { Camera } from '../engine/camera';
import type { Player } from './player';
import { walkFrame } from './sprite';

/** Palette for the dwarf warrior. */
const C = {
  skin: '#e0a574',
  skinShade: '#c4885a',
  beard: '#d9701c',
  beardLight: '#f0953a',
  tunic: '#7a4a22',
  tunicDark: '#5a3516',
  belt: '#3a2412',
  gold: '#e0b84a',
  boot: '#3f2a18',
  helmet: '#8b6a3a',
  helmetRim: '#b08a4a',
  horn: '#efe6cf',
  steel: '#cfd8dc',
  steelDark: '#90a4ae',
  wood: '#6b4423',
  eye: '#1c1a18',
};

/** How much bigger than the collision box the dwarf is drawn. */
const SCALE = 1.2;

type Ctx = CanvasRenderingContext2D;

function rect(ctx: Ctx, color: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function poly(ctx: Ctx, color: string, pts: [number, number][]): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
}

/** A double-bladed battle axe head with its top at (x, y), blades pointing out sideways. */
function axeHead(ctx: Ctx, x: number, y: number, dir: 1 | -1 | 0): void {
  const blade = (s: number) =>
    poly(ctx, C.steel, [
      [x + s * 1, y],
      [x + s * 8, y - 3],
      [x + s * 8, y + 7],
      [x + s * 1, y + 4],
    ]);
  if (dir === 0) {
    blade(1);
    blade(-1);
  } else blade(dir);
  rect(ctx, C.steelDark, x - 1, y - 1, 2, 7);
}

/** Front view: facing the camera, axe over the right shoulder. */
function front(ctx: Ctx, swing: number): void {
  // Boots.
  rect(ctx, C.boot, -7, 5 + Math.max(0, swing), 5, 6 - Math.max(0, swing));
  rect(ctx, C.boot, 2, 5 + Math.max(0, -swing), 5, 6 - Math.max(0, -swing));
  // Axe behind the body.
  rect(ctx, C.wood, 12, -17, 2, 27);
  axeHead(ctx, 13, -19, 1);
  // Tunic and belt.
  rect(ctx, C.tunic, -9, -4, 18, 10);
  rect(ctx, C.tunicDark, -9, 4, 18, 2);
  rect(ctx, C.belt, -9, 1, 18, 2);
  rect(ctx, C.gold, -2, 1, 4, 2);
  // Bare, muscular arms with gold bracers.
  rect(ctx, C.skin, -13, -4, 5, 9);
  rect(ctx, C.skin, 8, -4, 5, 9);
  rect(ctx, C.skinShade, -13, 1, 5, 1);
  rect(ctx, C.skinShade, 8, 1, 5, 1);
  rect(ctx, C.gold, -13, 3, 5, 2);
  rect(ctx, C.gold, 8, 3, 5, 2);
  // Head, then the big beard over the lower face.
  rect(ctx, C.skin, -6, -14, 12, 10);
  poly(ctx, C.beard, [
    [-8, -9],
    [8, -9],
    [7, 0],
    [3, 6],
    [-3, 6],
    [-7, 0],
  ]);
  rect(ctx, C.beardLight, -5, -8, 10, 2); // moustache
  rect(ctx, C.beardLight, -2, 0, 1, 4);
  rect(ctx, C.beardLight, 2, -2, 1, 4);
  // Eyes and brows.
  rect(ctx, C.eye, -4, -11, 2, 2);
  rect(ctx, C.eye, 2, -11, 2, 2);
  rect(ctx, C.eye, -5, -13, 4, 1);
  rect(ctx, C.eye, 1, -13, 4, 1);
  helmet(ctx);
}

/** Back view: helmet and axe across the back. */
function back(ctx: Ctx, swing: number): void {
  rect(ctx, C.boot, -7, 5 + Math.max(0, swing), 5, 6 - Math.max(0, swing));
  rect(ctx, C.boot, 2, 5 + Math.max(0, -swing), 5, 6 - Math.max(0, -swing));
  rect(ctx, C.tunic, -9, -4, 18, 10);
  rect(ctx, C.tunicDark, -9, 4, 18, 2);
  rect(ctx, C.belt, -9, 1, 18, 2);
  rect(ctx, C.skin, -13, -4, 5, 9);
  rect(ctx, C.skin, 8, -4, 5, 9);
  rect(ctx, C.gold, -13, 3, 5, 2);
  rect(ctx, C.gold, 8, 3, 5, 2);
  // Axe strapped diagonally across the back.
  ctx.strokeStyle = C.wood;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-9, 6);
  ctx.lineTo(10, -16);
  ctx.stroke();
  axeHead(ctx, 10, -19, 1);
  // Head is all helmet from behind, with beard tufts showing at the sides.
  rect(ctx, C.skin, -6, -14, 12, 10);
  rect(ctx, C.beard, -8, -9, 3, 9);
  rect(ctx, C.beard, 5, -9, 3, 9);
  helmet(ctx);
  rect(ctx, C.helmet, -7, -12, 14, 8);
  rect(ctx, C.helmetRim, -7, -6, 14, 2);
}

/** Side view facing right (mirrored for left). */
function side(ctx: Ctx, swing: number): void {
  // Legs stride forward and back.
  rect(ctx, C.boot, -4 + swing, 5, 5, 6);
  rect(ctx, C.boot, 0 - swing, 5, 5, 6);
  rect(ctx, C.tunic, -6, -4, 13, 10);
  rect(ctx, C.tunicDark, -6, 4, 13, 2);
  rect(ctx, C.belt, -6, 1, 13, 2);
  rect(ctx, C.gold, 2, 1, 3, 2);
  // Back arm, then head and beard, then the front arm holding the axe.
  rect(ctx, C.skinShade, -8, -3, 4, 8);
  rect(ctx, C.skin, -4, -14, 11, 10);
  poly(ctx, C.beard, [
    [-1, -9],
    [8, -9],
    [8, 0],
    [4, 6],
    [-1, 4],
    [-4, -2],
  ]);
  rect(ctx, C.beardLight, 3, -8, 5, 2);
  rect(ctx, C.eye, 3, -11, 2, 2);
  rect(ctx, C.eye, 2, -13, 4, 1);
  // Axe held out in front, handle angled up.
  ctx.strokeStyle = C.wood;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(7, 4);
  ctx.lineTo(13, -14);
  ctx.stroke();
  axeHead(ctx, 13, -17, 1);
  rect(ctx, C.skin, 3, -4, 5, 9);
  rect(ctx, C.skinShade, 3, 1, 5, 1);
  rect(ctx, C.gold, 3, 3, 5, 2);
  // Helmet: one horn showing in profile.
  rect(ctx, C.helmet, -5, -17, 12, 5);
  rect(ctx, C.helmet, -5, -14, 3, 6);
  rect(ctx, C.helmetRim, -5, -13, 13, 2);
  poly(ctx, C.horn, [
    [-3, -16],
    [-8, -23],
    [-6, -24],
    [0, -17],
  ]);
}

/** Horned bronze helmet (front and back views). */
function helmet(ctx: Ctx): void {
  ctx.fillStyle = C.helmet;
  ctx.beginPath();
  ctx.arc(0, -13, 8, Math.PI, Math.PI * 2);
  ctx.fill();
  rect(ctx, C.helmetRim, -8, -14, 16, 3);
  rect(ctx, C.gold, -1, -20, 2, 5); // crest ridge
  poly(ctx, C.horn, [
    [-7, -15],
    [-14, -23],
    [-11, -24],
    [-5, -18],
  ]);
  poly(ctx, C.horn, [
    [7, -15],
    [14, -23],
    [11, -24],
    [5, -18],
  ]);
}

/**
 * Draw the player as a stocky dwarf warrior: horned helmet, big orange beard,
 * bare arms and a battle axe. Walks with a little stride, faces the way they move.
 */
export function drawDwarf(ctx: CanvasRenderingContext2D, camera: Camera, player: Player): void {
  const p = camera.toScreen(player.x, player.y);
  // Same walk cycle as the rest of the game: frame 0 is standing, 1 and 3 are the strides.
  const frame = walkFrame(player.walked, player.moving);
  const swing = [0, 3, 0, -3][frame];
  const bob = frame === 1 || frame === 3 ? -1.5 : 0;

  // Shadow stays on the ground.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + player.size / 2 + 1, player.size * 0.62, player.size * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(Math.round(p.x), Math.round(p.y + bob));
  const flip = player.facing === 'left' ? -1 : 1;
  ctx.scale(flip * SCALE, SCALE);
  switch (player.facing) {
    case 'up':
      back(ctx, swing);
      break;
    case 'down':
      front(ctx, swing);
      break;
    default:
      side(ctx, swing);
  }
  ctx.restore();
}
