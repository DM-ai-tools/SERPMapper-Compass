/**
 * Service radius options — align UI with `radius_km` used for suburb queries.
 * "Categorize by radius" via label + numeric cap (km).
 */
export type RadiusBandId =
  | "0-5"
  | "6-10"
  | "11-15"
  | "16-20"
  | "21-25"
  | "26-30";

export interface RadiusOption {
  id: RadiusBandId;
  label: string;
  /** Used for getSuburbsInRadius — upper bound of the selected band */
  radiusKm: number;
  short: string;
}

export const RADIUS_OPTIONS: readonly RadiusOption[] = [
  { id: "0-5", label: "0–5 km (hyper-local)", radiusKm: 5, short: "0-5" },
  { id: "6-10", label: "6–10 km (inner area)", radiusKm: 10, short: "6-10" },
  { id: "11-15", label: "11–15 km (metro ring)", radiusKm: 15, short: "11-15" },
  { id: "16-20", label: "16–20 km (greater metro)", radiusKm: 20, short: "16-20" },
  { id: "21-25", label: "21–25 km (wide area)", radiusKm: 25, short: "21-25" },
  { id: "26-30", label: "26–30 km (outer)", radiusKm: 30, short: "26-30" },
] as const;

export const DEFAULT_RADIUS_ID: RadiusBandId = "16-20";

export function getRadiusOptionById(id: string | null | undefined): RadiusOption {
  const found = RADIUS_OPTIONS.find((o) => o.id === (id as RadiusBandId));
  return found ?? RADIUS_OPTIONS.find((o) => o.id === DEFAULT_RADIUS_ID)!;
}
