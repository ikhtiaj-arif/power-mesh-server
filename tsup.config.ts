import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "es2023",
  platform: "node",
  sourcemap: true,
  clean: true,
  outDir: "dist",
  // Prisma stays external (generated client + engines). Bundle stripe so Render
  // cannot fail with ERR_MODULE_NOT_FOUND when node_modules install/cache drifts.
  external: [
    "@prisma/client",
    "@prisma/adapter-pg",
    ".prisma/client",
  ],
  noExternal: ["stripe"],
});
