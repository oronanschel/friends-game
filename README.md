# friends-game
Build a 2D top-down open-world browser game together.

## Run
No build step. Serve the folder and open it in a browser:

```
npx serve .
```

Then open the printed URL. Move with WASD or the arrow keys.

## Code layout
- `src/main.js` – game loop, wires everything together
- `src/config.js` – shared constants (tile size, speeds)
- `src/input.js` – keyboard state and movement axis
- `src/world.js` – infinite chunked tile world + generation (`World.generateTile`)
- `src/player.js` – player movement and tile collision
- `src/camera.js` – camera that follows the player
- `src/render.js` – world and HUD drawing
