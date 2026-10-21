import type { Camera } from './engine/camera';
import type { Input } from './engine/input';
import type { Inventory } from './items/items';
import type { Player } from './player/player';
import type { SaveData, SaveManager } from './save/save';
import type { World } from './world/world';

/**
 * Anything in the world besides the player: NPCs, items, animals, ...
 * Push it onto `game.entities` and the loop updates and draws it
 * (drawn in y order, so things lower on screen appear in front).
 */
export interface Entity {
  x: number;
  y: number;
  update?(dt: number, game: Game): void;
  draw?(ctx: CanvasRenderingContext2D, camera: Camera): void;
  /** Set to true to have the entity removed at the end of the frame. */
  dead?: boolean;
}

/** Shared game state passed to entities and features. */
export interface Game {
  world: World;
  player: Player;
  camera: Camera;
  input: Input;
  entities: Entity[];
  /** What the player carries: `game.inventory.counts.coin`, `game.inventory.take(kind, n)`. */
  inventory: Inventory;
  /** Register feature state to persist: `game.saves.register('inventory', { save, load }, game.resume)`. */
  saves: SaveManager;
  /** The save this session continued from, if any. */
  resume: SaveData | null;
}

/** Advance every entity and drop the ones marked dead. */
export function updateEntities(game: Game, dt: number): void {
  for (const e of game.entities) e.update?.(dt, game);
  game.entities = game.entities.filter((e) => !e.dead);
}
