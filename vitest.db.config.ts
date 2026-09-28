import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Database tests (`*.db.test.ts`): run against the local Supabase stack, never
 * production. `npm run db:local:reset` builds it; `npm run test:db` runs
 * these. The default config (vitest.config.ts) leaves them out, because CI's
 * unit job has no database of its own.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "vitest.server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.db.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
