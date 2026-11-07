import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { name: "voxel-core", include: ["test/**/*.test.ts"], environment: "node" },
});
