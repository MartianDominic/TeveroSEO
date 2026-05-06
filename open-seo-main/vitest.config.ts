import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["**/node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "src/server/features/onpage-mastery/**/*.ts",
        "src/server/lib/audit/checks/tier1/T1-7*.ts",
        "src/server/lib/audit/checks/tier1/T1-8*.ts",
        "src/server/lib/audit/checks/tier5/**/*.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/index.ts",
        "**/types.ts",
      ],
      thresholds: {
        // Phase 92 coverage requirements (80% target)
        "src/server/features/onpage-mastery/services/": {
          statements: 80,
          branches: 70,
          functions: 80,
          lines: 80,
        },
        "src/server/features/onpage-mastery/utils/": {
          statements: 80,
          branches: 70,
          functions: 80,
          lines: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/db": path.resolve(__dirname, "./src/db"),
      "@/server": path.resolve(__dirname, "./src/server"),
    },
  },
});
