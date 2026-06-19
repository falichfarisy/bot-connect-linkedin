import { COUNTRY_MAP, GEO_REGIONS, INDONESIA_GEO_ID } from "../config/geo.ts";

/**
 * Parse CLI argument --countries=ID,US,AU and resolve to LinkedIn Geo IDs.
 * Falls back to Indonesia only if no flag is provided.
 */
export function resolveTargetGeoIds(): string[] {
  const flag = process.argv.find((a) => a.startsWith("--countries="));
  if (!flag) return [INDONESIA_GEO_ID];

  const codes = flag
    .replace("--countries=", "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  const geoIds: string[] = [];

  for (const code of codes) {
    const geoId = COUNTRY_MAP[code];
    if (geoId) {
      geoIds.push(geoId);
    } else {
      console.warn(`  Unknown country code: ${code}. Skipping.`);
    }
  }

  if (geoIds.length === 0) {
    console.warn("  No valid country codes provided. Falling back to Indonesia.");
    return [INDONESIA_GEO_ID];
  }

  return geoIds;
}

export function logTargetedCountries(geoIds: string[]): void {
  const names = geoIds.map((id) => {
    const region = GEO_REGIONS.find((r) => r.geoId === id);
    return region ? region.name : id;
  });
  console.log(` Target: ${names.join(", ")} (${geoIds.length} countries)`);
}
