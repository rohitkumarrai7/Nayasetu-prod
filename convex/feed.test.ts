import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts", "!./http.ts", "!./auth.ts"]);

describe("legal updates feed", () => {
  test("seed + feed + practiceAreas + kind filter all work", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.mutation(api.updates.seedDemoUpdates, {});
    expect(seeded.inserted).toBeGreaterThan(0);

    const all = await t.query(api.updates.feed, {});
    expect(all.length).toBeGreaterThan(0);

    const judgments = await t.query(api.updates.feed, { kind: "judgment" });
    expect(judgments.every((i: any) => i.kind === "judgment")).toBe(true);

    const areas = await t.query(api.updates.practiceAreas, {});
    expect(Array.isArray(areas)).toBe(true);
    expect(areas.length).toBeGreaterThan(0);

    const filtered = await t.query(api.updates.feed, { practiceArea: areas[0] });
    expect(filtered.every((i: any) => i.practiceAreas.includes(areas[0]))).toBe(true);
  });

  test("feed is empty (not error) before seeding", async () => {
    const t = convexTest(schema, modules);
    const all = await t.query(api.updates.feed, {});
    expect(all).toEqual([]);
    const areas = await t.query(api.updates.practiceAreas, {});
    expect(areas).toEqual([]);
  });
});

describe("advocate directory", () => {
  test("seed sample lawyers + search + city filter", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.mutation(api.marketplace.seedSampleLawyers, {});
    expect(seeded.inserted).toBeGreaterThan(0);

    const all = await t.query(api.marketplace.searchDirectory, {});
    expect(all.length).toBeGreaterThan(0);
    // only permissible particulars are exposed (no verified/listed internal flags leaking as UI needs)
    expect(all[0]).toHaveProperty("displayName");

    // geo: a Delhi search returns advocates within their radius of Delhi (incl. Noida/Gurugram),
    // nearest first, and nobody from Mumbai/Chennai.
    const delhi = await t.query(api.marketplace.searchDirectory, { city: "Delhi" });
    expect(delhi.length).toBeGreaterThan(1);
    expect(delhi.every((p: any) => p.distanceKm !== null && p.distanceKm <= 100)).toBe(true);
    const ds = delhi.map((p: any) => p.distanceKm);
    expect([...ds].sort((a, b) => a - b)).toEqual(ds);
    expect(delhi.some((p: any) => /Mumbai|Chennai/.test(p.city ?? ""))).toBe(false);

    const byArea = await t.query(api.marketplace.searchDirectory, { practiceArea: "Motor Vehicle" });
    expect(byArea.every((p: any) => p.practiceAreas.includes("Motor Vehicle"))).toBe(true);
  });

  test("empty directory returns [] (not error)", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.marketplace.searchDirectory, {})).toEqual([]);
  });
});
