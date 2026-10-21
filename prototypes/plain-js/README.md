# friends-game
Build a 2D top-down open-world browser game together.

## Run it

No build step. ES modules need to be served over HTTP:

```sh
npx serve .        # then open the printed URL
# or: python3 -m http.server 8000
```

Controls: WASD / arrow keys to move, Shift to run.

## Code layout

| File | What it does |
| --- | --- |
| `index.html` | Canvas + HUD, loads `src/main.js` |
| `src/main.js` | Game loop; exposes `game = { world, player, camera, entities }` (also `window.game`) |
| `src/input.js` | Keyboard state: `isDown(code)`, `axis()` |
| `src/world.js` | Procedural island tile map (`TILE_SIZE`, `TILES`, `World.tileAt`, `isSolidAt`) |
| `src/camera.js` | Follows the player, clamps to world edges |
| `src/player.js` | Player movement and tile collision |
| `src/entities/` | Put new things (NPCs, items, animals...) here |

### Adding something to the world

Make an object with `x`, `y` (world pixels), `update(dt, game)` and `draw(ctx, camera)`,
then push it into `game.entities`. Entities are drawn sorted by `y` for simple depth.
Use `camera.worldToScreen(x, y)` to get screen coordinates.

## Contributing

Open a GitHub Issue per feature, claim it, and keep PRs small so many of us can work in parallel.
