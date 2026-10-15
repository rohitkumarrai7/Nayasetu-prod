// Advocate client-lead feed (L7, PRD §7 "Swiggy for legal").
//
// An advocate sees consented leads where
//     lead.nearestCourt ∈ advocate.homeCourts   OR   distance(lead, office) ≤ advocate.radiusKm
// ranked distance (10 km bands) → recency → practice-area match.
// Candidate set = geohash bucket + neighbours ∪ home-court index lookups → Haversine → rank, so
// the feed is O(candidates), not O(all leads).
//
// Privacy (DPDP + what the citizen was promised): a lead shows only consented fields (summary,
// domain, area, chosen contact) — never the raw chat. Contact details are visible ONLY to
// BCI-verified advocates; everyone else sees the lead with the contact locked.
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, query, QueryCtx } from "./_generated/server";
import { DEFAULT_RADIUS_KM, geohashNeighbors, haversineKm, roundKm } from "./lib/geo";
import { categoryLabel, getChecklist, TAXONOMY } from "./lib/taxonomy";
import { audit, primaryFirm, requireUser } from "./model/access";
import { isPlatformAdmin } from "./model/admin";
import { profilePoint, statusOf } from "./marketplace";

const BAND_KM = 10;

async function consentedCandidates(
  ctx: QueryCtx,
  profile: Doc<"lawyerProfiles"> | null,
  everything: boolean,
): Promise<Doc<"chatSessions">[]> {
  const seen = new Map<string, Doc<"chatSessions">>();
  const add = (rows: Doc<"chatSessions">[]) => rows.forEach((r) => seen.set(r._id, r));
  if (everything || !profile?.geoBucket) {
    add(
      await ctx.db
        .query("chatSessions")
        .withIndex("by_consent", (q) => q.eq("consentToShare", true))
        .order("desc")
        .take(500),
    );
    return [...seen.values()];
  }
  for (const b of geohashNeighbors(profile.geoBucket)) {
    add(
      await ctx.db
        .query("chatSessions")
        .withIndex("by_consent_bucket", (q) => q.eq("consentToShare", true).eq("geoBucket", b))
        .take(300),
    );
  }
  for (const court of profile.homeCourts ?? []) {
    add(
      await ctx.db
        .query("chatSessions")
        .withIndex("by_consent_court", (q) => q.eq("consentToShare", true).eq("nearestCourt", court))
        .take(300),
    );
  }
  // Leads whose location is unknown: offered only when the practice area matches (below).
  add(
    await ctx.db
      .query("chatSessions")
      .withIndex("by_consent_bucket", (q) => q.eq("consentToShare", true).eq("geoBucket", undefined))
      .take(100),
  );
  return [...seen.values()];
}

export const feed = query({
  args: {
    onlyMyPracticeAreas: v.optional(v.boolean()),
    includeDismissed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const admin = await isPlatformAdmin(ctx);
    const profile = await ctx.db
      .query("lawyerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile && !admin) {
      return { state: "needs_profile" as const, verified: false, radiusKm: null, homeCourtCount: 0, leads: [] };
    }
    const verified = admin || (profile?.verified ?? false);
    const office = profile ? profilePoint(profile) : null;
    const radiusKm = profile?.radiusKm ?? DEFAULT_RADIUS_KM;
    const homeCourts = new Set(profile?.homeCourts ?? []);
    const myAreas = new Set((profile?.practiceAreas ?? []).map((a) => a.toLowerCase()));

    const myActions = new Map<string, Doc<"leadActions">>();
    for (const a of await ctx.db
      .query("leadActions")
      .withIndex("by_lawyer", (q) => q.eq("lawyerUserId", userId))
      .collect()) {
      myActions.set(a.sessionId, a);
    }

    const candidates = await consentedCandidates(ctx, profile, admin && !office);
    const leads = [];
    for (const s of candidates) {
      if (!s.consentToShare || s.withdrawnAt) continue;
      const label = categoryLabel(s.category);
      const areaMatch = myAreas.has(label.toLowerCase());
      let distanceKm: number | null = null;
      if (office && s.clientLat !== undefined && s.clientLng !== undefined) {
        distanceKm = haversineKm(office, { lat: s.clientLat, lng: s.clientLng });
      }
      const inHomeCourt = !!s.nearestCourt && homeCourts.has(s.nearestCourt);
      const inRadius = distanceKm !== null && distanceKm <= radiusKm;
      const unlocated = s.clientLat === undefined;
      if (!admin || office) {
        if (unlocated ? !areaMatch : !inHomeCourt && !inRadius) continue;
      }
      if (args.onlyMyPracticeAreas && !areaMatch) continue;
      const mine = myActions.get(s._id);
      if (mine?.action === "dismissed" && !args.includeDismissed) continue;
      leads.push({
        _id: s._id as Id<"chatSessions">,
        category: s.category ?? "other",
        categoryLabel: label,
        summary: s.summary ?? "",
        act: s.act ?? "",
        location: s.location ?? "",
        nearestCourtName: s.nearestCourtName ?? "",
        consentedAt: s.consentedAt ?? s.createdAt,
        distanceKm: distanceKm === null ? null : roundKm(distanceKm),
        inHomeCourt,
        practiceAreaMatch: areaMatch,
        // Contact unlocked only for verified advocates (what the citizen consented to).
        contactName: verified ? (s.contactName ?? "") : "",
        contactPhone: verified ? (s.contactPhone ?? "") : "",
        contactLocked: !verified,
        myAction: mine?.action ?? null,
        matterId: mine?.matterId ?? null,
      });
    }
    leads.sort((a, b) => {
      const ba = a.distanceKm === null ? Infinity : Math.floor(a.distanceKm / BAND_KM);
      const bb = b.distanceKm === null ? Infinity : Math.floor(b.distanceKm / BAND_KM);
      if (ba !== bb) return ba - bb;
      const da = Math.floor(a.consentedAt / 86_400_000);
      const db = Math.floor(b.consentedAt / 86_400_000);
      if (da !== db) return db - da;
      return Number(b.practiceAreaMatch) - Number(a.practiceAreaMatch) || b.consentedAt - a.consentedAt;
    });
    return {
      state: (profile && profile.officeLat === undefined && !admin ? "needs_location" : "ok") as
        | "ok"
        | "needs_location",
      verified,
      verificationStatus: profile ? statusOf(profile) : "verified",
      radiusKm,
      homeCourtCount: homeCourts.size,
      leads: leads.slice(0, 200),
    };
  },
});

/** Accept a lead: becomes a client + matter in the advocate's firm (L7 → CRM). Idempotent. */
export const accept = mutation({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await requireUser(ctx);
    const admin = await isPlatformAdmin(ctx);
    const profile = await ctx.db
      .query("lawyerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!admin && !profile?.verified) {
      throw new Error("Only BCI-verified advocates can accept leads. Submit your profile for verification first.");
    }
    const firmId = await primaryFirm(ctx);
    if (!firmId) throw new Error("Create your workspace (firm) first.");
    const s = await ctx.db.get(sessionId);
    if (!s || !s.consentToShare || s.withdrawnAt) throw new Error("This lead is no longer available.");
    // The citizen consented to share with advocates in THEIR jurisdiction — enforce the same
    // eligibility rule as the feed, so a lead id obtained elsewhere can't be claimed.
    if (!admin && profile) {
      const office = profilePoint(profile);
      const located = s.clientLat !== undefined && s.clientLng !== undefined;
      const inHomeCourt = !!s.nearestCourt && (profile.homeCourts ?? []).includes(s.nearestCourt);
      const inRadius =
        located && !!office &&
        haversineKm(office, { lat: s.clientLat!, lng: s.clientLng! }) <= (profile.radiusKm ?? DEFAULT_RADIUS_KM);
      const areaMatch = profile.practiceAreas.some((a) => a.toLowerCase() === categoryLabel(s.category).toLowerCase());
      if (located ? !inHomeCourt && !inRadius : !areaMatch) {
        throw new Error("This lead is outside your jurisdiction / practice areas.");
      }
    }

    const prev = await ctx.db
      .query("leadActions")
      .withIndex("by_lawyer_session", (q) => q.eq("lawyerUserId", userId).eq("sessionId", sessionId))
      .unique();
    if (prev?.action === "accepted" && prev.matterId) return { matterId: prev.matterId };

    const contact = s.contactPhone ?? "";
    const isEmail = contact.includes("@");
    const clientId = await ctx.db.insert("clients", {
      firmId,
      name: s.contactName || "Citizen lead",
      email: isEmail ? contact : undefined,
      phone: isEmail ? undefined : contact || undefined,
      city: s.location,
      notes: `From NyayaSetu citizen lead (${categoryLabel(s.category)}). Consented ${new Date(
        s.consentedAt ?? s.createdAt,
      ).toISOString().slice(0, 10)}.`,
      createdBy: userId,
    });
    const cat = TAXONOMY.find((c) => c.key === s.category) ?? TAXONOMY[0];
    const sub = s.subcategory && getChecklist(cat.key, s.subcategory) ? s.subcategory : cat.subcategories[0].key;
    const matterId = await ctx.db.insert("matters", {
      firmId,
      clientId,
      title: `${cat.label} — ${s.location || "lead"}`,
      category: cat.key,
      subcategory: sub,
      summaryText: s.summary ?? "",
      status: "intake",
      createdBy: userId,
      sourceLeadId: sessionId,
    });
    if (prev) await ctx.db.patch(prev._id, { action: "accepted", matterId, firmId, createdAt: Date.now() });
    else
      await ctx.db.insert("leadActions", {
        sessionId,
        lawyerUserId: userId,
        firmId,
        action: "accepted",
        matterId,
        createdAt: Date.now(),
      });
    await audit(ctx, "lead.accept", `chatSessions/${sessionId}`, firmId, { matterId });
    return { matterId };
  },
});

export const dismiss = mutation({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await requireUser(ctx);
    const prev = await ctx.db
      .query("leadActions")
      .withIndex("by_lawyer_session", (q) => q.eq("lawyerUserId", userId).eq("sessionId", sessionId))
      .unique();
    if (prev?.action === "accepted") throw new Error("You already accepted this lead.");
    if (prev) return;
    await ctx.db.insert("leadActions", { sessionId, lawyerUserId: userId, action: "dismissed", createdAt: Date.now() });
  },
});
