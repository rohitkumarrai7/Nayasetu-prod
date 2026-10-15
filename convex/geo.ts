// Public geo endpoints (PRD §7) + district-court reference data management.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { courtRecords, knownCities } from "./lib/districtCourts";
import { bucketOf, isValidLatLng } from "./lib/geo";
import { requirePlatformAdmin } from "./model/admin";
import { loadCourts, resolveLocation } from "./model/geo";

export const cities = query({ args: {}, handler: async () => knownCities() });

export const courts = query({
  args: { state: v.optional(v.string()) },
  handler: async (ctx, { state }) => {
    const all = await loadCourts(ctx);
    return (state ? all.filter((c) => c.state === state) : all).sort(
      (a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name),
    );
  },
});

/** Preview where a point / city lands: label + nearest N courts with distances. */
export const resolve = query({
  args: { lat: v.optional(v.number()), lng: v.optional(v.number()), city: v.optional(v.string()), n: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const r = await resolveLocation(ctx, args, Math.min(10, args.n ?? 5));
    if (!r) return null;
    return {
      label: r.label,
      lat: r.lat,
      lng: r.lng,
      courts: r.homeCourts.map((c) => ({
        code: c.code,
        name: c.name,
        district: c.district,
        state: c.state,
        distanceKm: Math.round(c.distanceKm * 10) / 10,
      })),
    };
  },
});

const courtInput = v.object({
  code: v.string(),
  name: v.string(),
  district: v.string(),
  state: v.string(),
  lat: v.number(),
  lng: v.number(),
});

/** Admin: import/refresh the authoritative court list (e.g. from the eCourts directory). Upserts by code. */
export const importDistrictCourts = mutation({
  args: { courts: v.array(courtInput), seedBuiltIns: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const rows = [...args.courts];
    if (args.seedBuiltIns) {
      for (const c of courtRecords()) rows.push({ code: c.code, name: c.name, district: c.district, state: c.state, lat: c.lat, lng: c.lng });
    }
    let inserted = 0;
    let updated = 0;
    for (const c of rows.slice(0, 2000)) {
      if (!isValidLatLng(c.lat, c.lng)) continue;
      const doc = { ...c, geoBucket: bucketOf(c) };
      const prev = await ctx.db.query("districtCourts").withIndex("by_code", (q) => q.eq("code", c.code)).unique();
      if (prev) {
        await ctx.db.patch(prev._id, doc);
        updated++;
      } else {
        await ctx.db.insert("districtCourts", doc);
        inserted++;
      }
    }
    return { inserted, updated, total: (await ctx.db.query("districtCourts").take(5000)).length };
  },
});
