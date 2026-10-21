import { describe, expect, it } from 'vitest';
import { type Entity, type Game, updateEntities } from '../src/game';

describe('updateEntities', () => {
  it('updates entities and removes dead ones', () => {
    const ticks: number[] = [];
    const alive: Entity = { x: 0, y: 0, update: (dt) => ticks.push(dt) };
    const dying: Entity = {
      x: 0,
      y: 0,
      update() {
        this.dead = true;
      },
    };
    const game = { entities: [alive, dying] } as unknown as Game;
    updateEntities(game, 0.5);
    expect(ticks).toEqual([0.5]);
    expect(game.entities).toEqual([alive]);
  });
});
