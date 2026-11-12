# LOST SIGNAL: 10 DAYS

A 2D pixel-art survival game for the browser. Crash on Kepler-186f, repair the transmitter, send an SOS and survive ten days until rescue.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

`node scripts/build-standalone.mjs` produces a single self-contained `dist-standalone/index.html` (works offline except for the Google pixel fonts, which fall back to monospace).

## Controls

A/D move · W/Space jump · Shift sprint · E interact (hold to repair) · Left mouse mine/attack/place/use · Right mouse place/use · 1–9 or wheel hotbar · I/Tab inventory & crafting · Esc pause.

## Structure

```
src/
  App.tsx, main.tsx, index.css    React shell + Tailwind theme
  ui/                             Main menu, settings, pause, inventory/crafting, cutscene views
  game/
    Game.ts                       Main loop: actions, survival, spawning, cutscenes, saving, rendering order
    world.ts                      Seeded tile world: terrain, caves, ores, trees, structures
    tiles.ts, items.ts            Tile and item definitions, recipes, inventory
    physics.ts                    AABB vs tile collision with ledge step-up
    player.ts, robot.ts, creatures.ts
    story.ts                      The ten days: objectives, dialogue, waypoints
    hud.ts, font.ts               Canvas HUD and an original 5x7 bitmap font
    render.ts                     Sky, parallax, tiles, objects, flood-fill lighting
    audio.ts                      Procedural Web Audio music + sound effects
    IntroScene.ts, EndingScene.ts, MenuScene.ts, planet.ts
    art/                          All pixel art, generated in code (no image files)
    save.ts, settings.ts          LocalStorage persistence
```

## Notes

- Engine: the spec asked for Phaser 3, but this build environment couldn't install packages, so the game runs on a small custom canvas engine written in TypeScript (fixed-step-ish loop, tile physics, lighting). Gameplay code is split into modules so it could be ported to Phaser scenes later.
- One in-game day ≈ 5 minutes (Day 1 runs at half speed until the SOS is sent; Day 9's night is extra long).
- A day only advances at dawn once its objectives are done; you can sleep through the night in a lit, enclosed shelter (press E at your light source).
- `window.__lostSignal` exposes the running game for debugging in the browser console.
