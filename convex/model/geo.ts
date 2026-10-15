// Server-side geo helpers shared by the citizen chat, lead feed, directory and onboarding.
import { QueryCtx } from "../_generated/server";
import { courtRecords, findPlace, resolveCity } from "../lib/districtCourts";
import {
  bucketOf,
  CourtPoint,
  DEFAULT_HOME_COURTS,
  haversineKm,
  isValidLatLng,
  LatLng,
  nearestCourts,
} from "../lib/geo";

/**
 * District courts: the imported table when it has rows (authoritative), else the built-in seed.
 * ~700 rows max, so loading them is cheap and keeps every geo query a single pass.
 */
export async function loadCourts(ctx: QueryCtx): Promise<CourtPoint[]> {
  const rows = await ctx.db.query("districtCourts").take(5000);
  if (rows.length > 0) {
    return rows.map((r) => ({
      code: r.code,
      name: r.name,
      district: r.district,
      state: r.state,
      lat: r.lat,
      lng: r.lng,
    }));
  }
  return courtRecords().map(({ aliases: _a, ...c }) => c);
}

export interface ResolvedLocation extends LatLng {
  label: string;
  geoBucket: string;
  nearestCourt: CourtPoint & { distanceKm: number };
  homeCourts: (CourtPoint & { distanceKm: number })[];
}

/** Resolve coordinates, a typed city, or free text to a point + its nearest district courts. */
export async function resolveLocation(
  ctx: QueryCtx,
  input: { lat?: number; lng?: number; city?: string; text?: string },
  n = DEFAULT_HOME_COURTS,
): Promise<ResolvedLocation | null> {
  let point: LatLng | null = null;
  let label = "";
  if (isValidLatLng(input.lat, input.lng)) {
    point = { lat: input.lat as number, lng: input.lng as number };
  } else {
    const place = (input.city && resolveCity(input.city)) || (input.text && findPlace(input.text)) || null;
    if (place) {
      point = { lat: place.lat, lng: place.lng };
      label = place.label;
    }
  }
  if (!point) return null;
  const courts = await loadCourts(ctx);
  const homeCourts = nearestCourts(point, courts, n);
  if (homeCourts.length === 0) return null;
  // A GPS point far outside India (or a bad fix) shouldn't be matched to Indian courts.
  if (homeCourts[0].distanceKm > 400) return null;
  return {
    ...point,
    label: label || homeCourts[0].district,
    geoBucket: bucketOf(point),
    nearestCourt: homeCourts[0],
    homeCourts,
  };
}

export { haversineKm };
