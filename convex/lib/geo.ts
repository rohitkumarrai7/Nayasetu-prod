// Geo primitives for the "Swiggy for legal" marketplace (PRD §7).
// Pure functions — no Convex dependency — so they are unit-testable in isolation.

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in km (Haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

// ── Geohash (base32) ─────────────────────────────────────────────────────────
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export function geohashEncode(lat: number, lng: number, precision = 6): string {
  let latMin = -90,
    latMax = 90,
    lngMin = -180,
    lngMax = 180;
  let hash = "";
  let bit = 0;
  let ch = 0;
  let even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        ch = (ch << 1) | 1;
        lngMin = mid;
      } else {
        ch = ch << 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch = (ch << 1) | 1;
        latMin = mid;
      } else {
        ch = ch << 1;
        latMax = mid;
      }
    }
    even = !even;
    if (++bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

export function geohashDecode(hash: string): LatLng & { latErr: number; lngErr: number } {
  let latMin = -90,
    latMax = 90,
    lngMin = -180,
    lngMax = 180;
  let even = true;
  for (const c of hash) {
    const idx = BASE32.indexOf(c);
    if (idx < 0) throw new Error(`invalid geohash char: ${c}`);
    for (let b = 4; b >= 0; b--) {
      const bitOn = (idx >> b) & 1;
      if (even) {
        const mid = (lngMin + lngMax) / 2;
        if (bitOn) lngMin = mid;
        else lngMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (bitOn) latMin = mid;
        else latMax = mid;
      }
      even = !even;
    }
  }
  return {
    lat: (latMin + latMax) / 2,
    lng: (lngMin + lngMax) / 2,
    latErr: (latMax - latMin) / 2,
    lngErr: (lngMax - lngMin) / 2,
  };
}

/** The cell itself plus its 8 neighbours — the candidate buckets for a radius query. */
export function geohashNeighbors(hash: string): string[] {
  const { lat, lng, latErr, lngErr } = geohashDecode(hash);
  const out = new Set<string>();
  for (const dy of [-1, 0, 1]) {
    for (const dx of [-1, 0, 1]) {
      let nLat = lat + dy * latErr * 2;
      let nLng = lng + dx * lngErr * 2;
      if (nLat > 90 || nLat < -90) continue;
      if (nLng > 180) nLng -= 360;
      if (nLng < -180) nLng += 360;
      out.add(geohashEncode(nLat, nLng, hash.length));
    }
  }
  return [...out];
}

/**
 * Precision used for candidate buckets. A precision-3 cell is ~156 × 156 km at the equator
 * (narrower in longitude further north), so cell + 8 neighbours always covers a ≤ 100 km radius
 * anywhere in India. Candidates are then filtered exactly with Haversine.
 */
export const BUCKET_PRECISION = 3;

export function bucketOf(p: LatLng): string {
  return geohashEncode(p.lat, p.lng, BUCKET_PRECISION);
}

// ── Courts ───────────────────────────────────────────────────────────────────
export interface CourtPoint extends LatLng {
  code: string;
  name: string;
  district: string;
  state: string;
}

/** The N nearest courts to a point, with distance. O(courts) — the table is ~700 rows. */
export function nearestCourts<T extends CourtPoint>(
  p: LatLng,
  courts: T[],
  n = 5,
): (T & { distanceKm: number })[] {
  return courts
    .map((c) => ({ ...c, distanceKm: haversineKm(p, c) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, n);
}

export const DEFAULT_HOME_COURTS = 5;
export const DEFAULT_RADIUS_KM = 40;
export const MAX_RADIUS_KM = 100;

export function roundKm(km: number): number {
  return km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
}
