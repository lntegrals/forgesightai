import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    fileParallelism: false, // tests share .data/rfqs.json; run files sequentially
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
