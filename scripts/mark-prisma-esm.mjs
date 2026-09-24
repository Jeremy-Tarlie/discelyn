/**
 * Prisma `prisma-client` génère du .ts sous generated/prisma.
 * tsc (NodeNext) émet du CJS si le package.json le plus proche n'a pas
 * "type":"module" — incompatible avec bot-runtime (ESM named imports).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "generated", "prisma");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "package.json"), `${JSON.stringify({ type: "module" })}\n`);
