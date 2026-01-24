import { describe, expect, it } from "vitest";
import { resolvePoints } from "../heatmap-utils";

describe("resolvePoints", () => {
  const center = { latitude: 40, longitude: -100 };

  it("uses provided coordinates when available", () => {
    const result = resolvePoints([{ id: "a", latitude: 41, longitude: -101, value: 10 }], center);
    expect(result[0]).toMatchObject({ latitude: 41, longitude: -101, value: 10 });
  });

  it("jitter-falls back when coordinates are missing", () => {
    const result = resolvePoints(
      [
        { id: "a", value: 1 },
        { id: "b", value: 2 },
      ],
      center,
      0.001,
    );
    expect(result[0].latitude).not.toBeNaN();
    expect(result[0].longitude).not.toBeNaN();
    expect(result[0].latitude).not.toEqual(center.latitude); // jitter applied
  });

  it("filters out non-finite coordinates", () => {
    const result = resolvePoints(
      [{ id: "a", latitude: Number.NaN, longitude: Number.NaN, value: 1 }],
      center,
    );
    expect(result.length).toBe(0);
  });
});
