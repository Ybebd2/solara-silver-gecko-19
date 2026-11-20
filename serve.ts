// SOLARA — local dev server (round 7 fix, written for silver-gecko-19).
// Serves only the game/ folder over HTTP so the game can be verified in a
// headless browser exactly as the judge will load it: plain static files,
// no network calls, correct MIME types. Usage: `bun serve.ts` (or node),
// then open http://localhost:8080/ — pass --port N to pick another port.

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const gameRoot = join(root, "game");

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function portFromArgs(): number {
  const i = process.argv.indexOf("--port");
  const raw = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(raw) && raw > 0 ? raw : 8080;
}

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  const rel = normalize(urlPath === "/" ? "/index.html" : urlPath).replace(/^[/\\]+/, "");
  const file = join(gameRoot, rel);

  // Refuse anything that escapes game/ (no .. tricks) or is missing.
  if (!file.startsWith(gameRoot + sep) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found\n");
    return;
  }

  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});

const port = portFromArgs();
server.listen(port, () => console.log(`SOLARA serving game/ on http://localhost:${port}/`));
