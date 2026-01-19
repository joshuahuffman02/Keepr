#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  createInitialState,
  defaultConfig,
  formatStatus,
  loadConfig,
  loadState,
  removeState,
  runIteration,
  saveState,
  writeDefaultConfig,
  resolveStatePath
} from "./core";

const args = process.argv.slice(2);
const command = args[0] ?? "status";
const jsonOutput = args.includes("--json");
const rootDir = process.cwd();

function printHelp(): void {
  console.log(
    [
      "Ralph loop CLI",
      "",
      "Usage:",
      "  ralph init",
      "  ralph run",
      "  ralph resume",
      "  ralph status [--json]",
      "  ralph reset",
      ""
    ].join("\n")
  );
}

function exitWithError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Ralph error: ${message}`);
  process.exit(1);
}

try {
  switch (command) {
    case "init": {
      const config = writeDefaultConfig(rootDir);
      const statePath = resolveStatePath(rootDir, config);
      if (!fs.existsSync(statePath)) {
        const state = createInitialState();
        saveState(rootDir, config, state);
        console.log(`Initialized Ralph state at ${path.relative(rootDir, statePath)}.`);
      } else {
        console.log(`Ralph state already exists at ${path.relative(rootDir, statePath)}.`);
      }
      break;
    }
    case "run": {
      const config = loadConfig(rootDir);
      const state = loadState(rootDir, config);
      const iteration = runIteration(rootDir, config, state);
      const nextState = saveState(rootDir, config, state);
      console.log(formatStatus(rootDir, config, nextState));
      process.exit(iteration.status === "passed" ? 0 : 1);
    }
    case "resume": {
      const config = loadConfig(rootDir);
      const state = loadState(rootDir, config);
      if (state.status === "complete") {
        console.log("Ralph loop already complete.");
        process.exit(0);
      }
      const iteration = runIteration(rootDir, config, state);
      const nextState = saveState(rootDir, config, state);
      console.log(formatStatus(rootDir, config, nextState));
      process.exit(iteration.status === "passed" ? 0 : 1);
    }
    case "status": {
      const config = loadConfig(rootDir);
      const state = loadState(rootDir, config);
      if (jsonOutput) {
        console.log(JSON.stringify({ config, state }, null, 2));
      } else {
        console.log(formatStatus(rootDir, config, state));
      }
      break;
    }
    case "reset": {
      let config;
      try {
        config = loadConfig(rootDir);
      } catch {
        config = defaultConfig();
      }
      removeState(rootDir, config);
      console.log(`Ralph state reset (${config.stateFile}).`);
      break;
    }
    case "help":
    case "-h":
    case "--help": {
      printHelp();
      break;
    }
    default: {
      printHelp();
      process.exit(1);
    }
  }
} catch (error) {
  exitWithError(error);
}
