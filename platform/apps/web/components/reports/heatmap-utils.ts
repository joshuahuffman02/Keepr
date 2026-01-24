"use client";

export type RawPoint = {
  id: string;
  latitude?: number | null;
  longitude?: number | null;
  value: number;
  label?: string;
};

export type ResolvedPoint = {
  id: string;
  latitude: number;
  longitude: number;
  value: number;
  label?: string;
};

/**
 * Resolve points to usable coordinates with a small jitter fallback around a center.
 */
export function resolvePoints(
  points: RawPoint[],
  center: { latitude: number; longitude: number },
  jitter = 0.0004,
): ResolvedPoint[] {
  return points
    .map((p, idx) => {
      const hasLat = p.latitude !== undefined && p.latitude !== null;
      const hasLng = p.longitude !== undefined && p.longitude !== null;

      // Drop points that explicitly provide non-finite coordinates
      if ((hasLat && !Number.isFinite(p.latitude)) || (hasLng && !Number.isFinite(p.longitude))) {
        return null;
      }

      // Apply jitter when coordinates are missing so we don't stack exactly on the center
      const lat = Number.isFinite(p.latitude)
        ? Number(p.latitude)
        : center.latitude + jitter * Math.sin(idx + 1);
      const lng = Number.isFinite(p.longitude)
        ? Number(p.longitude)
        : center.longitude + jitter * Math.cos(idx + 1);
      const label = typeof p.label === "string" ? p.label : undefined;
      const resolved: ResolvedPoint =
        label !== undefined
          ? { id: p.id, latitude: lat, longitude: lng, value: p.value, label }
          : { id: p.id, latitude: lat, longitude: lng, value: p.value };
      return resolved;
    })
    .filter((p): p is ResolvedPoint => p !== null);
}
