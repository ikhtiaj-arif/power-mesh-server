import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "es2023",
  platform: "node",
  sourcemap: true,
  clean: true,
  outDir: "dist",
  // Prisma stays external (generated client + engines). Keep stripe external
  // so it resolves from node_modules at runtime.
  external: [
    "@prisma/client",
    "@prisma/adapter-pg",
    ".prisma/client",
    "stripe",
  ],
});
