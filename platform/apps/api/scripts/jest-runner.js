#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

const args = process.argv.slice(2);
const envValue = process.env.JEST_RUN_IN_BAND;
const normalizedRunInBand = envValue ? envValue.toLowerCase() : "";
const runInBand =
  normalizedRunInBand === "" || normalizedRunInBand === "true" || normalizedRunInBand === "1";
const maxWorkersEnv = process.env.JEST_MAX_WORKERS;
const hasMaxWorkersArg = args.some(
  (arg) => arg === "--maxWorkers" || arg.startsWith("--maxWorkers=")
);

if (runInBand) {
  args.unshift("--runInBand");
} else if (!hasMaxWorkersArg) {
  const fallbackMaxWorkers = maxWorkersEnv && maxWorkersEnv !== "" ? maxWorkersEnv : "4";
  args.unshift(`--maxWorkers=${fallbackMaxWorkers}`);
}

const result = spawnSync("jest", args, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(typeof result.status === "number" ? result.status : 1);
