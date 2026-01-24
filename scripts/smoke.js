const fs = require("fs");
const path = require("path");

const root = process.cwd();

const requiredFiles = [
  "ralph.config.json",
  "TASK.md",
  "PHASES.md",
  "tools/ralph/package.json",
  "tools/ralph/src/cli.ts",
  "tools/ralph/src/core.ts",
  "docs/phase-1-pricing-payments.md",
  "docs/phase-2-operations.md",
  "docs/phase-3-analytics.md",
  "docs/phase-4-automation.md",
  "docs/phase-5-finalization-ux.md",
];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length > 0) {
  console.error("Smoke check failed. Missing files:");
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

const configPath = path.join(root, "ralph.config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
if (!config.maxIterations || !Array.isArray(config.checks)) {
  console.error("Smoke check failed. ralph.config.json is missing required fields.");
  process.exit(1);
}

console.log("Smoke check passed.");
