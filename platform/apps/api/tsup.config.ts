import { defineConfig } from "tsup";

export default defineConfig([
  // Main server build (for local dev)
  {
    entry: ["src/main.ts", "src/serverless.ts"],
    format: ["cjs"],
    platform: "node",
    target: "node20",
    outDir: "dist",
    sourcemap: true,
    clean: true,
    splitting: false,
    minify: false,
    dts: false,
    tsconfig: "./tsconfig.json",
    skipNodeModulesBundle: true,
    shims: false,
    external: ["@campreserv/shared"]
  },
  // Vercel serverless build (output to api/ folder)
  {
    entry: { "index": "src/serverless.ts" },
    format: ["cjs"],
    platform: "node",
    target: "node20",
    outDir: "../../../api",
    sourcemap: false,
    clean: false,
    splitting: false,
    minify: false,
    dts: false,
    tsconfig: "./tsconfig.json",
    skipNodeModulesBundle: true,
    shims: false,
    external: ["@campreserv/shared"]
  }
]);
