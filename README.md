# SOLARA — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Ybebd2/solara-silver-gecko-19/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Ybebd2/solara-silver-gecko-19/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Entry by **@silver-gecko-19-6487** for the [gta6-01 bounty on make.fun](https://make.fun/bounty/gta6-01).

## What is SOLARA?

A golden-hour open-world crime game set in a coastal city. You are **Kai Mercer**,
a driver for hire. **Lupe** has work for you — an 8-job chain across 7 districts,
from a first fix at MO'S Diner to the big Solara Job at the bank. Jack cars, lose
the heat, climb from **ROOKIE** to **FIXER**.

## The city

7 districts: Marina Bay, Old Port, Downtown, Neon Row, Palm Heights, Dockside,
and Solara Beach. A road grid full of traffic, pedestrians on the sidewalks,
palms along the boardwalk, a marina with boats, and a neon storefront row —
MO'S, SOLARA, PAWN, DINER, MOTEL — glowing over the streets. The sun hangs low
over the ocean to the west.

## How to play

- **WASD** — walk / drive. **Shift** — sprint. Drag the mouse to look around.
- **F** — enter a car / jack it (+1 wanted star). **F** again to get out.
- **Click** — fire your weapon. **1–5** — switch weapons (VESPER pistol, JACKAL SMG,
  LONGSHOT rifle, RIOT shotgun, fists). **T** — reload.
- **E** — start the job at the yellow beacon. Follow the beacon, watch the job
  clock in the mission panel, and finish before time runs out.
- **Z / X / C** — crew: **MARA / GHOST** wipes a wanted star, **SULLY / PIT CREW**
  fully repairs your car, **KIKI / LOOKOUT** reveals patrols for 20 seconds.
- **R** — cycle the radio (PUERTO 88.3 / CELESTE 98.1 / SOLARA 98.3).
- **M** — city map (zoom with the wheel, click to set a waypoint).
- **F8 / F9** — save / load. **P** — pause.

## Wanted

5 stars. Carjacking adds a star, so does dropping a cop. Cruisers and officers
chase you; at 3 stars a helicopter joins with a searchlight. Break line of sight
and the **EVADING** meter fills — at 100% you lose a star.

## Jobs (8)

1. First Fix (Lupe) · 2. Tow Job (Sully) · 3. Marco's Run (Marco) ·
4. The Ledger (Brandt) · 5. Aurora's Light (Aurora) · 6. Hot Wheels (Lupe) ·
7. Heat Wave (Sully) · 8. The Solara Job (Brandt).

## Run it

```sh
node serve.ts --port 8080
# open http://localhost:8080/
```

The game is plain ES modules + vendored Three.js (`game/vendor/three/`), works
fully offline, no network requests. Build the dossier with `node main.ts`
(`MAKEFUN_OUTPUT_DIR` to choose the output folder).
