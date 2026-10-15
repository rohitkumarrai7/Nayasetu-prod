// Lawyer onboarding (L8) + verified advocate directory (C3) + booking (C4).
// Compliance (§11, BCI Rule 36):
//   - Only VERIFIED + LISTED profiles are shown to citizens; verification is admin-only.
//   - Neutral ordering: distance → verification → alphabetical. NO engagement/quality ranking.
//   - BCI-permissible particulars only; citizen-initiated contact; flat listing fee, no commission.
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { mutation, query, QueryCtx } from "./_generated/server";
import { courtRecords, resolveCity } from "./lib/districtCourts";
import {
  bucketOf,
  DEFAULT_RADIUS_KM,
  geohashNeighbors,
  haversineKm,
  isValidLatLng,
  LatLng,
  MAX_RADIUS_KM,
  roundKm,
} from "./lib/geo";
import { PRACTICE_AREAS } from "./lib/taxonomy";
import { audit, requireUser } from "./model/access";
import { loadCourts, resolveLocation } from "./model/geo";

// ── BCI enrolment number (format check only — real verification is manual, by an admin) ──
// Common shapes: D/1234/2015, MAH/1234/2010, KAR/123/2012, UP/12345/2019, MS/1234/A/2001.
const BCI_RE = /^[A-Z]{1,6}\/[A-Z]?\d{1,6}(\/[A-Z]{1,3})?\/(19|20)\d{2}$/;

export function normalizeEnrolment(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, "").replace(/[-\\]/g, "/").replace(/\/+/g, "/");
}

export function enrolmentProblem(raw: string): string | null {
  const n = normalizeEnrolment(raw);
  if (!BCI_RE.test(n)) return "Enrolment number should look like D/1234/2015 (State code / number / year).";
  const year = Number(n.slice(-4));
  if (year > new Date().getFullYear()) return "Enrolment year can't be in the future.";
  return null;
}

/** Office point for a profile: explicit coordinates, else its city via the gazetteer. */
export function profilePoint(p: Pick<Doc<"lawyerProfiles">, "officeLat" | "officeLng" | "city">): LatLng | null {
  if (isValidLatLng(p.officeLat, p.officeLng)) return { lat: p.officeLat!, lng: p.officeLng! };
  const place = p.city ? resolveCity(p.city) : null;
  return place ? { lat: place.lat, lng: place.lng } : null;
}

type VStatus = NonNullable<Doc<"lawyerProfiles">["verificationStatus"]>;

export function statusOf(p: Pick<Doc<"lawyerProfiles">, "verified" | "verificationStatus">): VStatus {
  return p.verified ? "verified" : (p.verificationStatus ?? "unsubmitted");
}

// ── onboarding ────────────────────────────────────────────────────────────────
export const myProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const p = await ctx.db
      .query("lawyerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!p) return null;
    const courts = await loadCourts(ctx);
    const byCode = new Map(courts.map((c) => [c.code, c]));
    const office = isValidLatLng(p.officeLat, p.officeLng) ? { lat: p.officeLat!, lng: p.officeLng! } : null;
    return {
      ...p,
      verificationStatus: statusOf(p),
      homeCourtDetails: (p.homeCourts ?? []).flatMap((code) => {
        const c = byCode.get(code);
        if (!c) return [];
        return [
          {
            code: c.code,
            name: c.name,
            district: c.district,
            state: c.state,
            distanceKm: office ? roundKm(haversineKm(office, c)) : null,
          },
        ];
      }),
    };
  },
});

export const upsertLawyerProfile = mutation({
  args: {
    displayName: v.string(),
    bciEnrolmentNo: v.optional(v.string()),
    enrolmentState: v.optional(v.string()),
    enrolmentYear: v.optional(v.number()),
    practiceAreas: v.array(v.string()),
    languages: v.array(v.string()),
    city: v.optional(v.string()),
    feeRange: v.optional(v.string()),
    listed: v.boolean(),
    officeLat: v.optional(v.number()),
    officeLng: v.optional(v.number()),
    radiusKm: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("lawyerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const displayName = args.displayName.trim().slice(0, 80);
    if (displayName.length < 3) throw new Error("Please enter your full name as enrolled.");
    const practiceAreas = [...new Set(args.practiceAreas.map((a) => a.trim()).filter(Boolean))].slice(0, 12);
    if (practiceAreas.length === 0) throw new Error("Pick at least one practice area.");
    const languages = [...new Set(args.languages.map((l) => l.trim()).filter(Boolean))].slice(0, 10);
    let enrolment: string | undefined;
    if (args.bciEnrolmentNo && args.bciEnrolmentNo.trim()) {
      const problem = enrolmentProblem(args.bciEnrolmentNo);
      if (problem) throw new Error(problem);
      enrolment = normalizeEnrolment(args.bciEnrolmentNo);
    }
    const radiusKm = Math.min(
      MAX_RADIUS_KM,
      Math.max(5, Math.round(args.radiusKm ?? existing?.radiusKm ?? DEFAULT_RADIUS_KM)),
    );

    // M2: office location → nearest-5 district courts ("home courts").
    const loc = await resolveLocation(ctx, { lat: args.officeLat, lng: args.officeLng, city: args.city });
    if (!loc && (args.city?.trim() || args.officeLat !== undefined)) {
      throw new Error("Couldn't place that office location. Pick a city from the list or use your current location.");
    }

    // Changing the enrolment number invalidates an earlier verification (back to the queue).
    const prevStatus: VStatus = existing ? statusOf(existing) : "unsubmitted";
    const enrolmentChanged = !!existing && (existing.bciEnrolmentNo ?? "") !== (enrolment ?? "");
    let verified = existing?.verified ?? false;
    let verificationStatus: VStatus = prevStatus;
    if (enrolmentChanged && prevStatus !== "unsubmitted") {
      verified = false;
      verificationStatus = "pending";
    }

    const fields = {
      userId,
      displayName,
      bciEnrolmentNo: enrolment,
      enrolmentState: args.enrolmentState?.trim() || undefined,
      enrolmentYear: args.enrolmentYear,
      practiceAreas,
      languages,
      city: loc?.label ?? (args.city?.trim() || undefined),
      feeRange: args.feeRange?.trim().slice(0, 60) || undefined,
      listed: args.listed,
      verified,
      verificationStatus,
      officeLat: loc?.lat ?? existing?.officeLat,
      officeLng: loc?.lng ?? existing?.officeLng,
      geoBucket: loc?.geoBucket ?? existing?.geoBucket,
      homeCourts: loc ? loc.homeCourts.map((c) => c.code) : existing?.homeCourts,
      radiusKm,
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      await audit(ctx, "lawyer.profile.update", `lawyerProfiles/${existing._id}`);
      return existing._id;
    }
    const id = await ctx.db.insert("lawyerProfiles", fields);
    await audit(ctx, "lawyer.profile.create", `lawyerProfiles/${id}`);
    return id;
  },
});

export const submitForVerification = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const p = await ctx.db
      .query("lawyerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!p) throw new Error("Complete your profile first.");
    if (p.verified) return { status: "verified" as const };
    if (!p.bciEnrolmentNo) throw new Error("Add your Bar Council enrolment number before submitting.");
    if (!p.enrolmentState) throw new Error("Add the State Bar Council you are enrolled with.");
    if (p.officeLat === undefined) throw new Error("Add your office location so we can match nearby clients.");
    await ctx.db.patch(p._id, { verificationStatus: "pending", submittedAt: Date.now(), verificationNote: undefined });
    await audit(ctx, "lawyer.verification.submit", `lawyerProfiles/${p._id}`);
    return { status: "pending" as const };
  },
});

// ── directory (citizen-facing) ──────────────────────────────────────────────────
export interface DirectoryEntry {
  _id: string;
  userId: string;
  displayName: string;
  bciEnrolmentNo?: string;
  practiceAreas: string[];
  languages: string[];
  city?: string;
  feeRange?: string;
  distanceKm: number | null;
  servesYourCourt: boolean;
  verified: true;
}

/**
 * Verified + listed advocates for a citizen (PRD §7):
 *   advocate.homeCourts ∋ citizen.nearestCourt  OR  distance ≤ advocate radius,
 * ranked neutrally: distance → (all verified) → alphabetical. Without a location: filters only.
 */
export async function directorySearch(
  ctx: QueryCtx,
  args: { practiceArea?: string; language?: string; city?: string; lat?: number; lng?: number },
): Promise<DirectoryEntry[]> {
  const where = await resolveLocation(ctx, { lat: args.lat, lng: args.lng, city: args.city }, 1);

  let profiles: Doc<"lawyerProfiles">[];
  if (where) {
    // Candidate pre-filter: geohash bucket + neighbours (O(candidates), PRD §7). Legacy rows
    // without a bucket are included and placed via their city.
    const seen = new Map<string, Doc<"lawyerProfiles">>();
    for (const b of [...geohashNeighbors(where.geoBucket), undefined]) {
      const rows = await ctx.db
        .query("lawyerProfiles")
        .withIndex("by_listed_verified_bucket", (q) => q.eq("listed", true).eq("verified", true).eq("geoBucket", b))
        .take(500);
      for (const r of rows) seen.set(r._id, r);
    }
    profiles = [...seen.values()];
  } else {
    profiles = await ctx.db
      .query("lawyerProfiles")
      .withIndex("by_listed_verified", (q) => q.eq("listed", true).eq("verified", true))
      .take(1000);
  }

  const area = args.practiceArea?.trim().toLowerCase();
  if (area) profiles = profiles.filter((p) => p.practiceAreas.some((a) => a.toLowerCase().includes(area)));
  const lang = args.language?.trim().toLowerCase();
  if (lang) profiles = profiles.filter((p) => p.languages.some((l) => l.toLowerCase() === lang));

  const out: DirectoryEntry[] = [];
  for (const p of profiles) {
    let distanceKm: number | null = null;
    let servesYourCourt = false;
    if (where) {
      const pt = profilePoint(p);
      if (pt) distanceKm = haversineKm(where, pt);
      servesYourCourt = (p.homeCourts ?? []).includes(where.nearestCourt.code);
      const inRadius = distanceKm !== null && distanceKm <= (p.radiusKm ?? DEFAULT_RADIUS_KM);
      if (!servesYourCourt && !inRadius) continue;
    } else if (args.city?.trim()) {
      if ((p.city ?? "").toLowerCase() !== args.city.trim().toLowerCase()) continue;
    }
    out.push({
      _id: p._id,
      userId: p.userId,
      displayName: p.displayName,
      bciEnrolmentNo: p.bciEnrolmentNo,
      practiceAreas: p.practiceAreas,
      languages: p.languages,
      city: p.city,
      feeRange: p.feeRange,
      distanceKm: distanceKm === null ? null : roundKm(distanceKm),
      servesYourCourt,
      verified: true,
    });
  }
  out.sort(
    (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || a.displayName.localeCompare(b.displayName),
  );
  return out;
}

export const searchDirectory = query({
  args: {
    practiceArea: v.optional(v.string()),
    language: v.optional(v.string()),
    city: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: async (ctx, args) => directorySearch(ctx, args),
});

export const practiceAreas = query({ args: {}, handler: async () => PRACTICE_AREAS });

// ── C4 booking — citizen self-selects; no routing, no fee-sharing ────────────────
export const requestBooking = mutation({
  args: {
    lawyerUserId: v.id("users"),
    slot: v.string(),
    intakePayload: v.any(),
  },
  handler: async (ctx, args) => {
    const citizenUserId = await requireUser(ctx);
    const profile = await ctx.db
      .query("lawyerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.lawyerUserId))
      .unique();
    if (!profile || !profile.listed || !profile.verified) {
      throw new Error("Lawyer is not available for booking");
    }
    const id = await ctx.db.insert("bookings", {
      citizenUserId,
      lawyerUserId: args.lawyerUserId,
      slot: args.slot.slice(0, 100),
      intakePayload: args.intakePayload,
      status: "requested",
    });
    await audit(ctx, "booking.request", `bookings/${id}`);
    return id;
  },
});

export const myBookingsAsLawyer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    return ctx.db
      .query("bookings")
      .withIndex("by_lawyer", (q) => q.eq("lawyerUserId", userId))
      .order("desc")
      .collect();
  },
});

export const respondToBooking = mutation({
  args: {
    bookingId: v.id("bookings"),
    status: v.union(v.literal("accepted"), v.literal("declined"), v.literal("completed")),
  },
  handler: async (ctx, { bookingId, status }) => {
    const userId = await requireUser(ctx);
    const b = await ctx.db.get(bookingId);
    if (!b || b.lawyerUserId !== userId) throw new Error("Booking not found");
    await ctx.db.patch(bookingId, { status });
    await audit(ctx, `booking.${status}`, `bookings/${bookingId}`);
  },
});

// ── demo data ───────────────────────────────────────────────────────────────────
// FICTIONAL sample advocates so the directory and geo-matching demonstrate fully before real
// lawyers self-register. Not real people; "(demo)" names. Real listings come only from
// self-registration + admin verification (never scraping — ToS, DPDP and BCI Rule 36).
const SAMPLE_LAWYERS = [
  { displayName: "Adv. A. Sample (demo)", bciEnrolmentNo: "D/0001/2020", enrolmentState: "Delhi", practiceAreas: ["Motor Vehicle", "Consumer Dispute"], languages: ["English", "Hindi"], court: "DL-THC", feeRange: "₹2,000–₹5,000" },
  { displayName: "Adv. E. Demo (demo)", bciEnrolmentNo: "D/0005/2016", enrolmentState: "Delhi", practiceAreas: ["Family / Matrimonial", "Criminal / Police"], languages: ["English", "Hindi", "Punjabi"], court: "DL-SKT", feeRange: "₹3,000–₹8,000" },
  { displayName: "Adv. F. Mock (demo)", bciEnrolmentNo: "P/0006/2017", enrolmentState: "Punjab & Haryana", practiceAreas: ["Property / Tenancy", "Cheque Bounce", "Cyber Fraud"], languages: ["English", "Hindi"], court: "HR-GGN", feeRange: "₹2,500–₹6,000" },
  { displayName: "Adv. G. Trial (demo)", bciEnrolmentNo: "UP/0007/2018", enrolmentState: "Uttar Pradesh", practiceAreas: ["Motor Vehicle", "Employment / Labour"], languages: ["English", "Hindi"], court: "UP-GBN", feeRange: "₹1,500–₹4,000" },
  { displayName: "Adv. B. Example (demo)", bciEnrolmentNo: "MAH/0002/2019", enrolmentState: "Maharashtra & Goa", practiceAreas: ["Consumer Dispute", "Cyber Fraud"], languages: ["English", "Marathi", "Hindi"], court: "MH-MUMS", feeRange: "₹1,500–₹4,000" },
  { displayName: "Adv. H. Pilot (demo)", bciEnrolmentNo: "MAH/0008/2015", enrolmentState: "Maharashtra & Goa", practiceAreas: ["Property / Tenancy", "Cheque Bounce"], languages: ["English", "Marathi"], court: "MH-PUN", feeRange: "₹2,000–₹5,000" },
  { displayName: "Adv. C. Placeholder (demo)", bciEnrolmentNo: "MS/0003/2021", enrolmentState: "Tamil Nadu & Puducherry", practiceAreas: ["Property / Tenancy", "Family / Matrimonial"], languages: ["English", "Tamil"], court: "TN-CHN", feeRange: "₹3,000–₹7,000" },
  { displayName: "Adv. D. Specimen (demo)", bciEnrolmentNo: "KAR/0004/2018", enrolmentState: "Karnataka", practiceAreas: ["Motor Vehicle", "Consumer Dispute", "Employment / Labour"], languages: ["English", "Kannada"], court: "KA-BLR", feeRange: "₹2,500–₹6,000" },
  { displayName: "Adv. I. Proto (demo)", bciEnrolmentNo: "TS/0009/2019", enrolmentState: "Telangana", practiceAreas: ["Cyber Fraud", "Criminal / Police"], languages: ["English", "Telugu", "Hindi"], court: "TG-HYD", feeRange: "₹2,000–₹5,000" },
  { displayName: "Adv. J. Draft (demo)", bciEnrolmentNo: "WB/0010/2014", enrolmentState: "West Bengal", practiceAreas: ["Consumer Dispute", "Property / Tenancy"], languages: ["English", "Bengali"], court: "WB-KOL", feeRange: "₹1,500–₹4,500" },
];

export const seedSampleLawyers = mutation({
  args: {},
  handler: async (ctx) => {
    const courts = await loadCourts(ctx);
    const all = courts.length ? courts : courtRecords();
    const existing = await ctx.db.query("lawyerProfiles").take(1000);
    const byName = new Map(existing.map((p) => [p.displayName, p]));
    let inserted = 0;
    for (const s of SAMPLE_LAWYERS) {
      const court = all.find((c) => c.code === s.court);
      if (!court) continue;
      // Offset slightly from the court so distances look realistic.
      const office = { lat: court.lat + 0.012, lng: court.lng + 0.01 };
      const homeCourts = all
        .map((c) => ({ c, d: haversineKm(office, c) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 5)
        .map((x) => x.c.code);
      const { court: _court, ...rest } = s;
      const geo = {
        city: court.district,
        officeLat: office.lat,
        officeLng: office.lng,
        geoBucket: bucketOf(office),
        homeCourts,
        radiusKm: DEFAULT_RADIUS_KM,
      };
      const prev = byName.get(s.displayName);
      if (prev) {
        // Back-fill geo on demo rows seeded before M2.
        if (prev.officeLat === undefined) await ctx.db.patch(prev._id, geo);
        continue;
      }
      const userId = await ctx.db.insert("users", { name: s.displayName });
      await ctx.db.insert("lawyerProfiles", {
        userId,
        ...rest,
        ...geo,
        listed: true,
        verified: true,
        verificationStatus: "verified",
        verifiedAt: Date.now(),
      });
      inserted++;
    }
    return { inserted };
  },
});
