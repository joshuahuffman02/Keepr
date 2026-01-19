import * as fs from "node:fs";
import * as path from "node:path";

type OpenApiSpec = {
  openapi?: string;
  paths?: Record<string, Record<string, unknown>>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isOpenApiSpec = (value: unknown): value is OpenApiSpec => {
  if (!isRecord(value)) return false;
  if ("openapi" in value && value.openapi !== undefined && typeof value.openapi !== "string") {
    return false;
  }
  if ("paths" in value && value.paths !== undefined && !isRecord(value.paths)) {
    return false;
  }
  return true;
};

const loadSpec = (): OpenApiSpec => {
  const specPath = path.resolve(__dirname, "..", "..", "openapi.json");
  const raw = fs.readFileSync(specPath, "utf8");
  const parsed = JSON.parse(raw);
  return isOpenApiSpec(parsed) ? parsed : {};
};

describe("openapi contract", () => {
  it("includes core platform endpoints", () => {
    const spec = loadSpec();
    expect(spec.openapi?.startsWith("3.")).toBe(true);

    const paths = spec.paths ?? {};
    expect(paths["/health"]).toBeDefined();
    expect(paths["/ready"]).toBeDefined();
    expect(paths["/flags"]).toBeDefined();
    expect(paths["/flags/{key}"]).toBeDefined();

    expect(paths["/flags"]?.get).toBeDefined();
    expect(paths["/flags/{key}"]?.get).toBeDefined();

    expect(paths["/auth/login"]?.post).toBeDefined();
    expect(paths["/auth/me"]?.get).toBeDefined();
    expect(paths["/campgrounds"]?.get).toBeDefined();
    expect(paths["/reservations"]?.post).toBeDefined();
  });
});
