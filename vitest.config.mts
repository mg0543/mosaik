import { defineConfig } from "vitest/config";

// Tests unitaires : rapides, sans base de données.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "src/**/*.integration.test.ts"],
  },
});
