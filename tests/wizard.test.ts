import { describe, expect, it } from 'vitest';
import type { Game } from '../src/game';
import { Health } from '../src/player/health';
import { Player } from '../src/player/player';
import { SPELL, Spell } from '../src/wizard/spell';
import { WIZARD, Wizard } from '../src/wizard/wizard';
import { TILE_SIZE, type World } from '../src/world/world';

/** Open ground everywhere, with an optional set of solid tiles. */
function fakeWorld(solid: (tx: number, ty: number) => boolean = () => false): World {
  return { seed: 1, isSolidAt: solid } as unknown as World;
}

function gameWith(px: number, py: number, world = fakeWorld()): Game {
  return { world, player: new Player(px, py), entities: [], health: new Health() } as unknown as Game;
}

/** A wizard that is already in place (his first update would otherwise blink him next to the player). */
function placedWizard(x: number, y: number, game: Game): Wizard {
  const w = new Wizard(x, y, 5);
  game.entities.push(w);
  w.cooldown = 0;
  // Force the "already placed" state by running one blink-free frame at close range.
  w.update(0, game);
  w.x = x;
  w.y = y;
  w.cooldown = 0;
  return w;
}

function run(game: Game, w: Wizard, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) {
    for (const e of [...game.entities]) e.update?.(1 / 60, game);
    game.entities = game.entities.filter((e) => !e.dead);
    void w;
  }
}

describe('Wizard', () => {
  it('appears next to the player on its first frame', () => {
    const game = gameWith(1000, 1000);
    const w = new Wizard(1000, 1000, 3);
    w.update(1 / 60, game);
    const d = Math.hypot(w.x - 1000, w.y - 1000);
    expect(d).toBeGreaterThan(WIZARD.blinkDistance - TILE_SIZE);
    expect(d).toBeLessThan(WIZARD.blinkDistance + TILE_SIZE);
    expect(w.puff).toBeGreaterThan(0);
  });

  it('follows the player when they walk away', () => {
    const game = gameWith(0, 0);
    const w = placedWizard(5 * TILE_SIZE, 0, game);
    w.cooldown = 1000; // no casting in this test
    game.player.x = 15 * TILE_SIZE;
    const before = Math.abs(game.player.x - w.x);
    run(game, w, 2);
    expect(Math.abs(game.player.x - w.x)).toBeLessThan(before);
  });

  it('backs off when the player gets too close', () => {
    const game = gameWith(0, 0);
    const w = placedWizard(1.5 * TILE_SIZE, 0, game);
    w.cooldown = 1000;
    run(game, w, 1);
    expect(Math.abs(game.player.x - w.x)).toBeGreaterThan(1.5 * TILE_SIZE);
  });

  it('is slower than the player walking, so you can always walk away', () => {
    expect(WIZARD.speed).toBeLessThan(new Player(0, 0).speed);
  });

  it('charges its staff for a moment, then throws a bolt at the player', () => {
    const game = gameWith(0, 0);
    const w = placedWizard(6 * TILE_SIZE, 0, game);
    w.update(1 / 60, game);
    expect(w.casting).toBeGreaterThan(0);
    expect(game.entities.some((e) => e instanceof Spell)).toBe(false);
    run(game, w, WIZARD.windup + 0.05);
    const bolts = game.entities.filter((e) => e instanceof Spell) as Spell[];
    expect(bolts).toHaveLength(1);
    // The bolt travels towards the player (to the left of the wizard).
    expect(bolts[0].vx).toBeLessThan(0);
    expect(w.cooldown).toBeGreaterThan(WIZARD.cooldown[0] - 0.1);
  });

  it('does not cast during the first few seconds after appearing', () => {
    const game = gameWith(0, 0);
    const w = new Wizard(0, 0, 9);
    run(game, w, 0); // no entities yet
    game.entities.push(w);
    run(game, w, WIZARD.grace - 1);
    expect(game.entities.some((e) => e instanceof Spell)).toBe(false);
  });

  it('throws a fan of three bolts on every third cast', () => {
    const game = gameWith(0, 0);
    const w = placedWizard(6 * TILE_SIZE, 0, game);
    w.casts = WIZARD.fanEvery - 1;
    w.update(1 / 60, game);
    run(game, w, WIZARD.windup + 0.05);
    expect(game.entities.filter((e) => e instanceof Spell)).toHaveLength(3);
  });

  it('stands down while the player is fainted', () => {
    const game = gameWith(0, 0);
    game.health!.fainted = 2;
    const w = placedWizard(6 * TILE_SIZE, 0, game);
    run(game, w, 3);
    expect(game.entities.some((e) => e instanceof Spell)).toBe(false);
  });

  it('blinks back next to the player when they get far away', () => {
    const game = gameWith(0, 0);
    const w = placedWizard(6 * TILE_SIZE, 0, game);
    game.player.x = 100 * TILE_SIZE;
    w.update(1 / 60, game);
    expect(Math.hypot(game.player.x - w.x, game.player.y - w.y)).toBeLessThan(WIZARD.blinkDistance + TILE_SIZE);
  });

  it('blinks out when he is stuck behind a wall for too long', () => {
    // A long wall of solid tiles between the wizard and the player.
    const game = gameWith(10 * TILE_SIZE, 0, fakeWorld((tx, ty) => tx === 3 && ty >= -40 && ty <= 40));
    const w = placedWizard(0, 0, game);
    w.cooldown = 1000;
    run(game, w, WIZARD.stuckTime + 1.5);
    expect(w.x).toBeGreaterThan(3.5 * TILE_SIZE); // got to the player's side by blinking
  });
});

describe('Spell', () => {
  it('flies in a straight line', () => {
    const game = gameWith(0, 5000);
    const s = new Spell(0, 0, SPELL.speed, 0);
    game.entities.push(s);
    s.update(1, game);
    expect(s.x).toBeCloseTo(SPELL.speed);
    expect(s.y).toBeCloseTo(0);
  });

  it('hurts the player on contact and disappears', () => {
    const game = gameWith(100, 0);
    const s = new Spell(0, 0, SPELL.speed, 0);
    run(game, new Wizard(0, 0), 0);
    for (let t = 0; t < 1 && !s.dead; t += 1 / 60) s.update(1 / 60, game);
    expect(s.dead).toBe(true);
    expect(game.health!.hearts).toBe(4);
  });

  it('passes through while the player is protected after a hit', () => {
    const game = gameWith(100, 0);
    game.health!.hurt();
    const s = new Spell(0, 0, SPELL.speed, 0);
    for (let t = 0; t < 0.6; t += 1 / 60) s.update(1 / 60, game);
    expect(s.dead).toBe(false);
    expect(game.health!.hearts).toBe(4);
  });

  it('fizzles against walls, trees and other solid things', () => {
    const game = gameWith(500, 0, fakeWorld((tx) => tx === 2));
    const s = new Spell(0, 0, SPELL.speed, 0);
    for (let t = 0; t < 1 && !s.dead; t += 1 / 60) s.update(1 / 60, game);
    expect(s.dead).toBe(true);
    expect(s.x).toBeLessThan(3 * TILE_SIZE);
    expect(game.health!.hearts).toBe(5);
  });

  it('fizzles out after a while', () => {
    const game = gameWith(0, 100000);
    const s = new Spell(0, 0, 0, -1);
    s.update(SPELL.life + 0.1, game);
    expect(s.dead).toBe(true);
  });
});
