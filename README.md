# The Department of Extremely Good Luck

A full-window, watch-only Swedish good-luck garden. Twelve autonomous helpers bring digital offerings to Cthulhu, Hastur and Yog-Sothoth. No bunnies are harmed. Speech, progress and celebrations happen on the canvas.

## Run

Node.js 20 or newer; no dependencies or build step.

```sh
npm run dev
npm run check
```

Open http://127.0.0.1:4178. Press S to open or close appearance settings; keys 1–4 select Pixels, ASCII, Mix and Dither. Dither is the default. Objects, trees/shrubs and moonlight have separate pattern choices and strength sliders. Zero gives continuous shading; 100% gives patterned shading. The optional shape highlight shows exactly where each material is active. Appearance changes preserve the simulation.

The chosen defaults are **Checker 60%** for objects, **Grain 80%** for trees/shrubs, and **Bayer 50%** for moonlight. ASCII has live character-size (4–16 pixels) and contrast (50–200%) sliders, usable by pointer, touch or keyboard.

## Rebuilt Midnight Glow artwork

Every prop, tree, shrub, character and terrain tile is independently generated. The chosen B concept was used only as a visual reference. No scene pictures, concept cutouts, rectangular forest patches or baked light cones are shipped. Exact prompts are recorded in `artwork-buildings.json`, `artwork-nature.json` and `artwork-characters.json`.

- `scene-assets.js` prepares complete sprites using alpha thresholding, nearest-neighbor sampling and shared animation registration. Its material masks follow the same alpha as the artwork. Opaque outlines and highlights explicitly occlude materials behind them.
- `scene-layout.js` lays out a single continuous world for the current aspect ratio. The phone arrangement keeps every destination on screen without scrolling.
- `scene.js` draws the terrain, paths, independent scenery and animated cast. All props and actors share foot-depth ordering; bunnies remain between their separately rendered front/back fence rails while hopping.
- `material-shader.js` uses the explicit material map for restrained shadow dithering. A mathematical moonlight cone is generated and dithered by the GPU at runtime. It cannot spill behind the moon or outside its cone. There is no whole-scene color quantization.
- `scene-screen.js` draws readable speech, wooden-board progress, confetti and the collapsed appearance controls at display resolution.

Without WebGL, the original pixel scene remains available, without shader effects. The source artwork and renderer keep strong navy outlines, warm building accents, clear pink hearts, Swedish flags and distinct silhouettes.

## A living world

Helpers use utility decisions based on energy, preferences, recent choices, supply, crowding, social opportunities and exam skills needing encouragement. They navigate around solid scenery, reserve ritual positions, collect bits/vowels/cinnamon buns, rest, encourage friends and visit the bunnies. Every visit receives a fresh random seed. No language-model API or key is used.

Completed progress triggers a 24-second celebration: helpers and gods dance using generated pose frames, bunnies binky, the moon laughs and confetti falls. Then the next autonomous round begins. Bunnies explore, sniff, munch, groom and nap. The moon changes its gaze, expression and blinks.

The flag cloth waves while its pole stays fixed. Static sprites use integer pixel placement and unchanged resize notifications are ignored. Helpers keep their movement budget across grid waypoints, with a 120 Hz simulation and display-paced drawing. All intended bench rest spots are inside the walkable garden. Bunnies reserve clear routes or wait; they never push resting neighbours. Paths form narrow winding trails with separate junctions. The board labels its four courage bars in Swedish: Läsa, Lyssna, Skriva and Tala.

Scenery clearings are rebuilt from the current layout's solid footprints and actual sprite dimensions on every resize. Background trees are moved as complete sprites behind the reserved ground; foreground plants that would cover a building, shrine or sign move behind it, and bottom-edge foliage moves below the board. No tree pixels are erased or clipped into rectangular holes. Portrait scaling respects both available width and height so short phones and tablets keep enough vertical room. The portrait BITS sign uses the existing main trail without a duplicate road spur.

Speech has separate god/helper queues. Each visible bubble retains its 10–17-second reading window and one-second fade-out; new speech cannot interrupt it. Wooden signs and pedestal engravings identify destinations without floating labels.

Semantic controls support keyboard and screen-reader use. Progress summaries are announced periodically. Reduced-motion preferences stop decorative movement and update the scene as one-second snapshots. Hidden tabs pause.

## Validation

`npm run check` checks active module syntax and exercises autonomous choices, repeated celebrations, collision/navigation across four aspect ratios, state preservation on rotation, protected dialogue, wildlife variation, fence depth and shader input limits.

The dev-only http://127.0.0.1:4178/__qa__/index.html harness tests actual WebGL output and real generated alpha assets, stationary bench pixels at 64 animation times, flag-pole stability, and actual ASCII control output. It is not included in the deployed `dist` directory. Browser inspection covers desktop/phone composition, animations and separate material controls.

## Deploy on Vercel

Import `yolomachine/DOEGL` into Vercel with the repository root as the Root Directory. The checked-in `vercel.json` selects the Other framework preset, skips dependency installation, runs `npm run check`, and publishes `dist/`.

The complete site and its artwork are tracked in `dist/`; no compilation, environment variables, API keys or external runtime services are required. Only `dist/` is served, so development tools, tests and artwork provenance stay outside the published site.

This repository starts from the finished garden, including Swedish progress labels, responsive scenery clearings, the higher moon and keyboard-only appearance settings. The site has no analytics.
