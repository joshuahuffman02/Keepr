import { spawnSync, type StdioOptions } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type CheckDefinition = {
  name: string;
  command: string;
};

export type RalphConfig = {
  maxIterations: number;
  checks: CheckDefinition[];
  taskFile: string;
  phasesFile: string;
  stateFile: string;
  stopOnFailure: boolean;
};

export type CheckStatus = "passed" | "failed" | "skipped";
export type LoopStatus = "idle" | "failed" | "complete";

export type CheckResult = {
  name: string;
  command: string;
  status: CheckStatus;
  exitCode: number | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
};

export type RalphIteration = {
  index: number;
  startedAt: string;
  finishedAt: string;
  status: "passed" | "failed";
  checks: CheckResult[];
};

export type RalphState = {
  status: LoopStatus;
  iterations: RalphIteration[];
  createdAt: string;
  updatedAt: string;
};

export type RunOptions = {
  stdio?: StdioOptions;
};

const DEFAULT_STATE_FILE = ".ralph/state.json";

export function defaultConfig(): RalphConfig {
  return {
    maxIterations: 10,
    checks: [
      { name: "lint", command: "pnpm lint" },
      { name: "typecheck", command: "pnpm typecheck" },
      { name: "test", command: "pnpm test" },
      { name: "smoke", command: "pnpm smoke" }
    ],
    taskFile: "TASK.md",
    phasesFile: "PHASES.md",
    stateFile: DEFAULT_STATE_FILE,
    stopOnFailure: true
  };
}

export function loadConfig(rootDir: string, configFile = "ralph.config.json"): RalphConfig {
  const configPath = path.resolve(rootDir, configFile);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing config at ${configPath}`);
  }
  const raw = parseJsonFile(configPath);
  return normalizeConfig(raw);
}

export function writeDefaultConfig(
  rootDir: string,
  configFile = "ralph.config.json"
): RalphConfig {
  const configPath = path.resolve(rootDir, configFile);
  if (!fs.existsSync(configPath)) {
    const config = defaultConfig();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return config;
  }
  return loadConfig(rootDir, configFile);
}

export function resolveStatePath(rootDir: string, config: RalphConfig): string {
  return path.resolve(rootDir, config.stateFile);
}

export function createInitialState(now = new Date()): RalphState {
  const stamp = now.toISOString();
  return {
    status: "idle",
    iterations: [],
    createdAt: stamp,
    updatedAt: stamp
  };
}

export function loadState(rootDir: string, config: RalphConfig): RalphState {
  const statePath = resolveStatePath(rootDir, config);
  if (!fs.existsSync(statePath)) {
    return createInitialState();
  }
  const raw = parseJsonFile(statePath);
  return normalizeState(raw);
}

export function saveState(rootDir: string, config: RalphConfig, state: RalphState): RalphState {
  const statePath = resolveStatePath(rootDir, config);
  ensureDir(path.dirname(statePath));
  const updated = {
    ...state,
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(statePath, JSON.stringify(updated, null, 2));
  return updated;
}

export function runIteration(
  rootDir: string,
  config: RalphConfig,
  state: RalphState,
  options: RunOptions = {}
): RalphIteration {
  if (state.status === "complete") {
    throw new Error("Ralph loop is already complete.");
  }
  if (state.iterations.length >= config.maxIterations) {
    throw new Error(`Max iterations reached (${config.maxIterations}).`);
  }

  const startedAt = new Date();
  const checks: CheckResult[] = [];
  let shouldSkip = false;

  for (const check of config.checks) {
    if (shouldSkip) {
      const stamp = new Date().toISOString();
      checks.push({
        name: check.name,
        command: check.command,
        status: "skipped",
        exitCode: null,
        startedAt: stamp,
        finishedAt: stamp,
        durationMs: 0
      });
      continue;
    }

    const checkStart = new Date();
    const result = spawnSync(check.command, {
      cwd: rootDir,
      shell: true,
      stdio: options.stdio ?? "inherit",
      env: process.env
    });
    const checkEnd = new Date();
    const exitCode = typeof result.status === "number" ? result.status : 1;
    const status: CheckStatus = exitCode === 0 ? "passed" : "failed";
    checks.push({
      name: check.name,
      command: check.command,
      status,
      exitCode,
      startedAt: checkStart.toISOString(),
      finishedAt: checkEnd.toISOString(),
      durationMs: checkEnd.getTime() - checkStart.getTime()
    });

    if (status === "failed" && config.stopOnFailure) {
      shouldSkip = true;
    }
  }

  const finishedAt = new Date();
  const iterationStatus = checks.every((check) => check.status === "passed")
    ? "passed"
    : "failed";
  const iteration: RalphIteration = {
    index: state.iterations.length + 1,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    status: iterationStatus,
    checks
  };

  state.iterations.push(iteration);
  state.status = iterationStatus === "passed" ? "complete" : "failed";
  state.updatedAt = finishedAt.toISOString();

  return iteration;
}

export function formatStatus(rootDir: string, config: RalphConfig, state: RalphState): string {
  const taskPath = path.resolve(rootDir, config.taskFile);
  const phasesPath = path.resolve(rootDir, config.phasesFile);
  const last = state.iterations[state.iterations.length - 1];
  const lines: string[] = [];

  lines.push("Ralph loop status");
  lines.push(`Task: ${config.taskFile} (${fs.existsSync(taskPath) ? "ok" : "missing"})`);
  lines.push(`Phases: ${config.phasesFile} (${fs.existsSync(phasesPath) ? "ok" : "missing"})`);
  lines.push(
    `Iterations: ${state.iterations.length}/${config.maxIterations} (${state.status})`
  );

  if (!last) {
    lines.push("No iterations recorded.");
    return lines.join("\n");
  }

  lines.push(`Last iteration: ${last.index} (${last.status})`);
  for (const check of last.checks) {
    lines.push(`- ${check.name}: ${check.status}`);
  }

  return lines.join("\n");
}

export function removeState(rootDir: string, config: RalphConfig): void {
  const statePath = resolveStatePath(rootDir, config);
  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
  }
}

function normalizeConfig(raw: unknown): RalphConfig {
  const data = isRecord(raw) ? raw : {};
  const maxIterations = Number(data.maxIterations);
  if (!Number.isInteger(maxIterations) || maxIterations <= 0) {
    throw new Error("Config maxIterations must be a positive integer.");
  }

  if (!Array.isArray(data.checks) || data.checks.length === 0) {
    throw new Error("Config checks must be a non-empty array.");
  }

  const checks = data.checks.map((check, index) => {
    if (!isRecord(check)) {
      throw new Error(`Check at index ${index} must be an object.`);
    }
    if (typeof check.name !== "string" || check.name.trim() === "") {
      throw new Error(`Check at index ${index} is missing a name.`);
    }
    if (typeof check.command !== "string" || check.command.trim() === "") {
      throw new Error(`Check at index ${index} is missing a command.`);
    }
    return { name: check.name, command: check.command };
  });

  return {
    maxIterations,
    checks,
    taskFile: typeof data.taskFile === "string" ? data.taskFile : "TASK.md",
    phasesFile: typeof data.phasesFile === "string" ? data.phasesFile : "PHASES.md",
    stateFile: typeof data.stateFile === "string" ? data.stateFile : DEFAULT_STATE_FILE,
    stopOnFailure: typeof data.stopOnFailure === "boolean" ? data.stopOnFailure : true
  };
}

function normalizeState(raw: unknown): RalphState {
  const data = isRecord(raw) ? raw : {};
  const status: LoopStatus =
    data.status === "complete" || data.status === "failed" ? data.status : "idle";
  const createdAt =
    typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString();
  const updatedAt = typeof data.updatedAt === "string" ? data.updatedAt : createdAt;
  const iterations: RalphIteration[] = [];

  if (Array.isArray(data.iterations)) {
    for (const entry of data.iterations) {
      const iteration = normalizeIteration(entry);
      if (iteration) {
        iterations.push(iteration);
      }
    }
  }

  return {
    status,
    iterations,
    createdAt,
    updatedAt
  };
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function parseJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeIteration(value: unknown): RalphIteration | null {
  if (!isRecord(value)) {
    return null;
  }

  const index = typeof value.index === "number" && Number.isInteger(value.index) ? value.index : null;
  const startedAt = typeof value.startedAt === "string" ? value.startedAt : null;
  const finishedAt = typeof value.finishedAt === "string" ? value.finishedAt : null;
  const status = value.status === "passed" || value.status === "failed" ? value.status : null;
  const checks: CheckResult[] = [];

  if (Array.isArray(value.checks)) {
    for (const entry of value.checks) {
      const check = normalizeCheckResult(entry);
      if (check) {
        checks.push(check);
      }
    }
  }

  if (index === null || startedAt === null || finishedAt === null || status === null) {
    return null;
  }

  return {
    index,
    startedAt,
    finishedAt,
    status,
    checks
  };
}

function normalizeCheckResult(value: unknown): CheckResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = typeof value.name === "string" ? value.name : null;
  const command = typeof value.command === "string" ? value.command : null;
  const status =
    value.status === "passed" || value.status === "failed" || value.status === "skipped"
      ? value.status
      : null;
  const exitCode =
    typeof value.exitCode === "number" || value.exitCode === null ? value.exitCode : null;
  const startedAt = typeof value.startedAt === "string" ? value.startedAt : null;
  const finishedAt = typeof value.finishedAt === "string" ? value.finishedAt : null;
  const durationMs = typeof value.durationMs === "number" ? value.durationMs : null;

  if (
    name === null ||
    command === null ||
    status === null ||
    startedAt === null ||
    finishedAt === null ||
    durationMs === null
  ) {
    return null;
  }

  return {
    name,
    command,
    status,
    exitCode,
    startedAt,
    finishedAt,
    durationMs
  };
}
