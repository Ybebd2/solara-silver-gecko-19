// SOLARA — dossier entrypoint (round 7 fix, written for silver-gecko-19).
// Bundles the game for the make.fun judge: mirrors game/ and screenshots/
// into the output folder, then asks the vendored make.fun library to write
// dossier.json from what landed there. Run with `bun main.ts` (or node
// with a TS loader); MAKEFUN_OUTPUT_DIR overrides the default /output.

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const root = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const shotsDir = join(outDir, "screenshots");

mkdirSync(outDir, { recursive: true });
mkdirSync(shotsDir, { recursive: true });

// Ship the whole playable game, then the evidence screenshots beside it.
cpSync(join(root, "game"), join(outDir, "game"), { recursive: true });
const localShots = join(root, "screenshots");
if (existsSync(localShots)) {
  cpSync(localShots, shotsDir, { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, "dossier.json"), dossier);

console.log(`SOLARA dossier ready at ${join(outDir, "dossier.json")}`);
