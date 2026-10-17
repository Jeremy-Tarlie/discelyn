import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", "**/node_modules/**", ".next", "**/dist/**"],
    // Imports Prisma + seed DB en parallèle peuvent dépasser 10s.
    hookTimeout: 30_000,
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
