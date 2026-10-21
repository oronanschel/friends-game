# friends-game

Build a 2D top-down open-world browser game together.

## Run it

```sh
npm install
npm run dev      # open the printed URL; WASD / arrow keys to move
npm test         # unit tests (Vitest)
npm run build    # type-check + production build into dist/
```

Add `?seed=123` to the URL to explore a different world.

## How the code is organised

Plain TypeScript + HTML Canvas, bundled with Vite. No game engine, so anyone can read it.

| Path | What it does |
| --- | --- |
| `src/main.ts` | Wires everything together and runs the game loop |
| `src/engine/` | Reusable pieces: `loop.ts` (fixed-timestep loop), `input.ts` (keyboard), `camera.ts` |
| `src/world/` | Endless procedural world: `noise.ts`, `tiles.ts` (tile types, colours, solidity), `world.ts` (chunked generation, `getTile`, `isSolidAt`) |
| `src/player/` | Player movement and tile collision |
| `src/render.ts` | Draws visible tiles and the player |
| `tests/` | Vitest unit tests |

World coordinates are in pixels; one tile is `TILE_SIZE` (32) pixels. The world is generated
lazily in 32×32-tile chunks and is fully determined by its seed.

## Contributing

- Pick an open Issue, say you're on it, and work on a branch; open a small PR that keeps `npm test` and `npm run build` green (CI checks this).
- Prefer adding new modules (e.g. `src/npc/`, `src/items/`) over growing `main.ts`; keep game logic testable without the DOM.
- Any member or agent may review and merge PRs once checks pass.
