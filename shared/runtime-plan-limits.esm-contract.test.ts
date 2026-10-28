import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * NodeNext émet CJS/ESM selon le package.json le plus proche du fichier source.
 * Sans `"type": "module"` ici, `shared/` sortait en CJS alors que bot-runtime
 * importe en ESM → crash runtime (`RUNTIME_PLAN_LIMITS` non exporté).
 */
type PackageJsonShape = {
  type?: string;
};

function readPackageType(dir: string): string | undefined {
  const raw = JSON.parse(
    readFileSync(join(dir, "package.json"), "utf8")
  ) as PackageJsonShape;
  return typeof raw.type === "string" ? raw.type : undefined;
}

describe("shared ESM contract", () => {
  it("déclare type module pour un emit ESM NodeNext", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    expect(readPackageType(dir)).toBe("module");
  });
});
