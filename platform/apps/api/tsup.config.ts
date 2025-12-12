import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["cjs"],
  platform: "node",
  target: "node18",
  outDir: "dist",
  sourcemap: true,
  clean: true,
  splitting: false,
  minify: false,
  dts: false,
  tsconfig: "./tsconfig.json",
  skipNodeModulesBundle: true,
  shims: false
});
