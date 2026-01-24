import { promises as fs } from "fs";
import path from "path";

const root = process.cwd();
const buildDir = path.join(root, ".next");

const config = {
  maxTotalJs: Number(process.env.MAX_TOTAL_JS_BYTES ?? 800_000), // 0.8 MB
  maxRouteJs: Number(process.env.MAX_ROUTE_JS_BYTES ?? 250_000), // 250 KB per route
};

async function getSize(filePath) {
  const stat = await fs.stat(filePath);
  return stat.size;
}

async function sumSizes(files) {
  const sizes = await Promise.all(files.map(getSize));
  return sizes.reduce((a, b) => a + b, 0);
}

async function getBuildManifest() {
  const manifestPath = path.join(buildDir, "build-manifest.json");
  const raw = await fs.readFile(manifestPath, "utf8");
  return JSON.parse(raw);
}

async function checkBudgets() {
  const manifest = await getBuildManifest();

  const chunkPath = (chunk) => path.join(buildDir, chunk.startsWith("/") ? chunk.slice(1) : chunk);

  const allChunks = new Set(Object.values(manifest.pages).flat());
  const chunkFiles = [...allChunks].map(chunkPath);
  const totalJsBytes = await sumSizes(chunkFiles);

  console.log(
    `Checking bundle budgets (total <= ${config.maxTotalJs} bytes, route <= ${config.maxRouteJs} bytes)...`,
  );

  const failures = [];
  if (totalJsBytes > config.maxTotalJs) {
    failures.push(`Total JS ${totalJsBytes} bytes exceeds budget ${config.maxTotalJs}`);
  }

  // Framework routes to exclude from per-route budget (shared chunks, not real pages)
  const frameworkRoutes = ["/_app", "/_error", "/_document"];

  for (const [route, chunks] of Object.entries(manifest.pages)) {
    // Skip framework routes - they contain shared chunks used across all pages
    if (frameworkRoutes.includes(route)) {
      continue;
    }
    const routeSize = await sumSizes(chunks.map(chunkPath));
    if (routeSize > config.maxRouteJs) {
      failures.push(
        `Route ${route} JS ${routeSize} bytes exceeds per-route budget ${config.maxRouteJs}`,
      );
    }
  }

  if (failures.length > 0) {
    console.error("❌ Performance budget violations:");
    failures.forEach((f) => console.error(`- ${f}`));
    process.exit(1);
  }

  console.log("✅ Performance budgets passed.");
  console.log(`Total JS: ${totalJsBytes} bytes (budget ${config.maxTotalJs})`);
}

checkBudgets().catch((err) => {
  console.error("Failed to run performance budgets:", err);
  process.exit(1);
});
