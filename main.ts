// SOLARA — main.ts (fresh build from spec, round 8)
// The program entrypoint for the gta6-01 dossier: it hands in the game
// exactly as it sits in this repo. It copies game/ (the playable game,
// static files only) and screenshots/ (4 PNG screens, first by name is
// the cover) into /output, then writes /output/dossier.json with the
// kit's own buildDossier library — the scorer's byte-for-byte copy.
// The dossier is built FROM /output, after the final commit, so the
// text the judge reads always matches the game that is handed in.
//
// Local check (outside the grader): mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Gate caps (reference/gate.json): dossier text ≤ 163,840 bytes,
// ≤ 4 screenshots, each ≤ 256 KiB, game/ ≤ 993 files / 48 MiB.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log('SOLARA dossier written to ' + join(out, 'dossier.json'));
