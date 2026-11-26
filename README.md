# Sky Courier: Ridge Run

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/RianKuntul/flight-game-2611/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/RianKuntul/flight-game-2611/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A complete 3D flight game that runs offline in a desktop browser from its
own files. Fly the Kestrel, a small orange cargo plane, over a seeded valley:
thread the golden rings, mind your fuel, then bring her home to Runway 18.

## The game

- **Chase view** over recognisable terrain: patchwork fields, a lake, a
  town with houses and hangars, snow-capped ridges, drifting clouds.
- **Three sorties** with different goals: Ring Run, Canyon Slalom (crosswind),
  Storm Pass (strong gusts). Each ends in a landing on Runway 18.
- **Flight model**: pitch, roll, banked turns, throttle, stall, fuel burn,
  hard-landing damage, and a glide path that rewards a gentle touchdown.
- **HUD**: compass tape, airspeed and altitude tapes, throttle and fuel bars,
  artificial horizon, ring pointer, score and mission status.
- **Controls**: Arrows / WASD pitch and roll, Shift / Ctrl throttle,
  hold the mouse to steer, P pause, M mute, R restart, Enter to fly.
- **Sound**: procedural WebAudio engine hum, wind, ring chimes and landing
  fanfare — no audio files.
- **Screenshots**: staged by `game/src/shots.js` from the real game with the
  autopilot (`?shot=play|start|land`), listed in `shots.json`.

## Run

```sh
node serve.ts
```

Then open http://localhost:8080 and press Enter to fly.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored make.fun library.

## Layout

- `game/index.html` — the page and its canvas
- `game/src/config.js` — tuning constants
- `game/src/random.js` — seeded random numbers and value noise
- `game/src/terrain.js` — the valley heightfield, lake, town and airfield
- `game/src/plane.js` — the Kestrel's arcade flight model
- `game/src/world.js` — sorties, rings, scoring and screens
- `game/src/input.js` — keyboard and mouse
- `game/src/render.js` — chase camera and software 3D renderer
- `game/src/hud.js` — instruments, tapes, messages and screens
- `game/src/audio.js` — procedural WebAudio sound
- `game/src/autopilot.js` — the autopilot that flies the screenshots
- `game/src/shots.js` — staged screenshot scenes
- `game/src/main.js` — the game loop
- `main.ts` — the make.fun hand-in program
- `serve.ts` — a tiny static server for local play
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
