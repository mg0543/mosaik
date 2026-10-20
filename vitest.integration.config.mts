import { defineConfig } from "vitest/config";

// Tests d'intégration : nécessitent la base Supabase locale (`supabase start`).
export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
