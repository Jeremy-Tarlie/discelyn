import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", "**/node_modules/**", ".next", "**/dist/**"],
    // Imports Prisma + seed DB en parallèle (Docker) peuvent dépasser 10s ;
    // le timeout doit aussi couvrir les import() dynamiques dans le corps du test.
    hookTimeout: 30_000,
    testTimeout: 15_000,
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
