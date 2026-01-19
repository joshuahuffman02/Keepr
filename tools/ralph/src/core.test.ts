import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  createInitialState,
  loadConfig,
  loadState,
  runIteration,
  saveState
} from "./core";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ralph-"));
}

test("loadConfig requires maxIterations and checks", () => {
  const rootDir = createTempRoot();
  const badConfig = {
    maxIterations: 0,
    checks: []
  };
  fs.writeFileSync(
    path.join(rootDir, "ralph.config.json"),
    JSON.stringify(badConfig, null, 2)
  );
  assert.throws(() => loadConfig(rootDir), /maxIterations/);
});

test("runIteration skips remaining checks after failure", () => {
  const rootDir = createTempRoot();
  const nodeCmd = `"${process.execPath}"`;
  const config = {
    maxIterations: 2,
    checks: [
      { name: "pass", command: `${nodeCmd} -e "process.exit(0)"` },
      { name: "fail", command: `${nodeCmd} -e "process.exit(1)"` },
      { name: "skip", command: `${nodeCmd} -e "process.exit(0)"` }
    ],
    taskFile: "TASK.md",
    phasesFile: "PHASES.md",
    stateFile: ".ralph/state.json",
    stopOnFailure: true
  };

  fs.writeFileSync(
    path.join(rootDir, "ralph.config.json"),
    JSON.stringify(config, null, 2)
  );

  const loaded = loadConfig(rootDir);
  const state = loadState(rootDir, loaded);
  const iteration = runIteration(rootDir, loaded, state, { stdio: "ignore" });

  assert.equal(iteration.status, "failed");
  assert.equal(iteration.checks[0].status, "passed");
  assert.equal(iteration.checks[1].status, "failed");
  assert.equal(iteration.checks[2].status, "skipped");
});

test("saveState writes to the configured state path", () => {
  const rootDir = createTempRoot();
  const nodeCmd = `"${process.execPath}"`;
  const config = {
    maxIterations: 1,
    checks: [{ name: "pass", command: `${nodeCmd} -e "process.exit(0)"` }],
    taskFile: "TASK.md",
    phasesFile: "PHASES.md",
    stateFile: "var/ralph/state.json",
    stopOnFailure: true
  };

  fs.writeFileSync(
    path.join(rootDir, "ralph.config.json"),
    JSON.stringify(config, null, 2)
  );

  const loaded = loadConfig(rootDir);
  const state = createInitialState(new Date("2025-01-01T00:00:00.000Z"));
  saveState(rootDir, loaded, state);

  assert.ok(fs.existsSync(path.join(rootDir, "var/ralph/state.json")));
});
