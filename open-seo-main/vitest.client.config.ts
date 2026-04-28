import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [tsConfigPaths(), react()],
  test: {
    environment: "jsdom",
    include: ["src/client/**/*.test.ts", "src/client/**/*.test.tsx"],
    restoreMocks: true,
    clearMocks: true,
    globals: true,
  },
});
