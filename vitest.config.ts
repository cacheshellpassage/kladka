import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/voxel-core", "packages/viewer", "packages/content"],
  },
});
