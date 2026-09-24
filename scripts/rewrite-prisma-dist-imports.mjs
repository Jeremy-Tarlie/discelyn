/**
 * Après tsc : le client Prisma (prisma-client) émet encore des imports `*.ts`.
 * Node ne résout que les `*.js` dans dist — on réécrit les extensions.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const distGenerated = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "bot-runtime",
  "dist",
  "generated"
);

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }
    if (!name.endsWith(".js")) continue;
    const src = readFileSync(path, "utf8");
    const out = src
      .replaceAll('.ts"', '.js"')
      .replaceAll(".ts'", ".js'");
    if (out !== src) writeFileSync(path, out);
  }
}

walk(distGenerated);
