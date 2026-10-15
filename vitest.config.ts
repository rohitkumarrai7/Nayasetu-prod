import { defineConfig } from "vitest/config";

// convex-test runs functions in-process on the edge-runtime VM (no deployment needed).
export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    include: ["convex/**/*.test.ts", "convex/**/*.spec.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
