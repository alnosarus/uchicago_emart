import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
    // Don't run Prisma-dependent integration tests in unit runs — we mock Prisma
    setupFiles: [],
  },
});
