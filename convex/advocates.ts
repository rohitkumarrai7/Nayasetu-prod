// Citizen "find advocates near me" (C3). Verified directory first (geo-matched, PRD §7); optional
// live listings from a configurable Apify actor are appended and clearly labelled UNVERIFIED, so
// the "only verified advocates" promise holds for everything we vouch for.
//
// Config (Convex env, optional):
//   APIFY_TOKEN   - your Apify API token
//   APIFY_ACTOR   - actor id (e.g. a business-directory scraper you have the right to use)
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalQuery } from "./_generated/server";
import { directorySearch } from "./marketplace";

export interface Advocate {
  name: string;
  phone?: string;
  address?: string;
  city?: string;
  url?: string;
  source: "directory" | "apify";
  verified: boolean;
  distanceKm?: number | null;
  practiceAreas?: string[];
  languages?: string[];
  feeRange?: string;
  bciEnrolmentNo?: string;
  servesYourCourt?: boolean;
}

export const directoryNear = internalQuery({
  args: {
    practiceArea: v.optional(v.string()),
    city: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Advocate[]> => {
    const rows = await directorySearch(ctx, args);
    return rows.map((p) => ({
      name: p.displayName,
      city: p.city,
      source: "directory" as const,
      verified: true,
      distanceKm: p.distanceKm,
      practiceAreas: p.practiceAreas,
      languages: p.languages,
      feeRange: p.feeRange,
      bciEnrolmentNo: p.bciEnrolmentNo,
      servesYourCourt: p.servesYourCourt,
    }));
  },
});

async function runApify(query: string, city: string): Promise<Advocate[]> {
  const token = process.env.APIFY_TOKEN;
  const actor = process.env.APIFY_ACTOR;
  if (!token || !actor) return [];
  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        searchStringsArray: [query],
        locationQuery: city || "India",
        maxCrawledPlacesPerSearch: 12,
        language: "en",
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`apify ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const items = (await res.json()) as any[];
    return (Array.isArray(items) ? items : []).map((it) => ({
      name: String(it.title || it.name || "Advocate"),
      phone: it.phone || it.phoneUnformatted || undefined,
      address: it.address || it.street || undefined,
      city: it.city || city || undefined,
      url: it.url || it.website || it.googleMapsUrl || undefined,
      source: "apify" as const,
      verified: false,
    }));
  } finally {
    clearTimeout(timer);
  }
}

export const findAdvocates = action({
  args: {
    practiceArea: v.optional(v.string()),
    city: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ source: string; advocates: Advocate[] }> => {
    const verified: Advocate[] = await ctx.runQuery(internal.advocates.directoryNear, args);
    let live: Advocate[] = [];
    if (process.env.APIFY_TOKEN && process.env.APIFY_ACTOR && (args.city || verified.length < 3)) {
      try {
        live = await runApify(`${args.practiceArea ?? ""} lawyer advocate ${args.city ?? ""}`.trim(), args.city ?? "");
      } catch (e) {
        console.warn(`[advocates] apify failed: ${String(e).slice(0, 200)}`);
      }
    }
    return {
      source: live.length ? (verified.length ? "directory+apify" : "apify") : "directory",
      advocates: [...verified, ...live],
    };
  },
});
