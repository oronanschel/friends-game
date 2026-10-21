# friends-game

Build a 2D top-down open-world browser game together.

## Run it

```sh
npm install
npm run dev      # open the printed URL; WASD / arrow keys to move, Shift to run, E talks to villagers, Q eats a berry, M toggles the minimap, V mutes sound
                 # on phones: drag on the left half to move, RUN / MAP buttons on the right
npm test         # unit tests (Vitest)
npm run build    # type-check + production build into dist/
```

The game auto-saves (world, position and any registered feature state) to your browser and
continues where you left off. Add `?seed=123` to the URL to open a specific world, or `?new` for a fresh random one.

## Plain-JS prototype

`prototypes/plain-js/` holds the earlier no-build scaffold from PR #1, kept for reference and ideas. With `npm run dev` running, open `/prototypes/plain-js/` to try it.

## How the code is organised

Plain TypeScript + HTML Canvas, bundled with Vite. No game engine, so anyone can read it.

| Path | What it does |
| --- | --- |
| `src/main.ts` | Wires everything together and runs the game loop |
| `src/game.ts` | Shared `Game` state and the `Entity` interface for NPCs, items, ... |
| `src/engine/` | Reusable pieces: `loop.ts` (fixed-timestep loop), `input.ts` (keyboard), `camera.ts` |
| `src/world/` | Endless procedural world: `noise.ts`, `tiles.ts` (tile types, colours, solidity), `decor.ts` (trees, pines, bushes, flowers), `world.ts` (chunked generation, `getTile`, `getDecor`, `isSolidAt`) |
| `src/player/` | Player movement and tile collision; `health.ts` (5 hearts, lions hurt, Q eats a berry to heal, faint → wake at spawn) |
| `src/save/` | Auto-save to localStorage; features persist state with `game.saves.register(key, { save, load }, game.resume)` |
| `src/audio/` | Procedural WebAudio: footsteps, ambient tune, effects via `game.sound?.play('roar')` |
| `src/ui/` | Overlays such as the minimap |
| `src/items/` | Collectible coins, berries, mushrooms and gems, placed per chunk from the seed; `game.inventory` holds counts and is saved |
| `src/npc/` | Villagers near the start: `villagers.ts` (names, lines, trades), `npc.ts` (strolling entity), `dialogue.ts` (conversation and trade logic), `talk.ts` (E to talk, dialogue box) |
| `src/animals/` | Wildlife: lions that roam grassland, chase you when close and rest after a pounce (outrun them with Shift) |
| `src/render.ts` | Draws visible tiles and the player |
| `tests/` | Vitest unit tests |

World coordinates are in pixels; one tile is `TILE_SIZE` (32) pixels. The world is generated
lazily in 32×32-tile chunks and is fully determined by its seed.

## Adding things to the world

Implement `Entity` from `src/game.ts` (`x`, `y`, optional `update(dt, game)` and
`draw(ctx, camera)`, set `dead = true` to remove) and push it onto `game.entities`.
Entities are drawn in y order with the player. `window.game` is available in the browser console.

## Contributing

- Pick an open Issue, say you're on it, and work on a branch; open a small PR that keeps `npm test` and `npm run build` green (CI checks this).
- Prefer adding new modules (e.g. `src/npc/`, `src/items/`) over growing `main.ts`; keep game logic testable without the DOM.
- Any member or agent may review and merge PRs once checks pass.
