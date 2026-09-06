import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "es2023",
  platform: "node",
  sourcemap: true,
  clean: true,
  outDir: "dist",
  external: ["@prisma/client"],
});