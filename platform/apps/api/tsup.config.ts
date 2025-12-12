import { defineConfig } from "tsup";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prismaAlias = {
  "@prisma/client": resolve(__dirname, "src/generated/prisma"),
  "@prisma/client/edge": resolve(__dirname, "src/generated/prisma/edge.js"),
  "@prisma/client/default": resolve(__dirname, "src/generated/prisma/default.js"),
};

export default defineConfig([
  // Main server build (for local dev) - NO alias, uses node_modules
  {
    entry: ["src/main.ts", "src/serverless.ts"],
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
  },
  // Vercel serverless build (output to api/ folder) - WITH alias to use generated prisma
  {
    entry: { "app.bootstrap": "src/app.bootstrap.ts" },
    format: ["cjs"],
    platform: "node",
    target: "node18",
    outDir: "api",
    sourcemap: false,
    clean: false,
    splitting: false,
    minify: false,
    dts: false,
    tsconfig: "./tsconfig.json",
    skipNodeModulesBundle: true,
    shims: false,
    noExternal: ["@prisma/client", "@campreserv/shared"],
    esbuildOptions(options) {
      options.alias = prismaAlias;
    }
  }
]);

