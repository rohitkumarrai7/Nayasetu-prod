// Platform admin (PRD §5): BCI verification queue (L8), trust & marketplace metrics (L9/§15),
// corpus re-indexing. Guarded by ADMIN_EMAILS on the Convex deployment.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { embedWithInfo } from "./lib/embeddings";
import { categoryLabel } from "./lib/taxonomy";
import { audit } from "./model/access";
import { isPlatformAdmin, requirePlatformAdmin } from "./model/admin";
import { loadCourts } from "./model/geo";
import { statusOf } from "./marketplace";

export const amIAdmin = query({ args: {}, handler: async (ctx) => isPlatformAdmin(ctx) });

export const verificationQueue = query({
  args: { status: v.optional(v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected"), v.literal("unsubmitted"))) },
  handler: async (ctx, { status }) => {
    await requirePlatformAdmin(ctx);
    const want = status ?? "pending";
    const rows =
      want === "verified"
        ? await ctx.db.query("lawyerProfiles").withIndex("by_listed_verified", (q) => q.eq("listed", true).eq("verified", true)).take(500)
        : await ctx.db.query("lawyerProfiles").withIndex("by_verification", (q) => q.eq("verificationStatus", want)).take(500);
    const courts = new Map((await loadCourts(ctx)).map((c) => [c.code, c.name]));
    const out = [];
    for (const p of rows) {
      const user = await ctx.db.get(p.userId);
      out.push({
        _id: p._id,
        displayName: p.displayName,
        email: (user as { email?: string } | null)?.email ?? null,
        bciEnrolmentNo: p.bciEnrolmentNo ?? null,
        enrolmentState: p.enrolmentState ?? null,
        enrolmentYear: p.enrolmentYear ?? null,
        practiceAreas: p.practiceAreas,
        city: p.city ?? null,
        homeCourts: (p.homeCourts ?? []).map((c) => courts.get(c) ?? c),
        status: statusOf(p),
        submittedAt: p.submittedAt ?? null,
        verificationNote: p.verificationNote ?? null,
      });
    }
    return out.sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0));
  },
});

export const decideVerification = mutation({
  args: {
    profileId: v.id("lawyerProfiles"),
    decision: v.union(v.literal("verified"), v.literal("rejected")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { profileId, decision, note }) => {
    await requirePlatformAdmin(ctx);
    const p = await ctx.db.get(profileId);
    if (!p) throw new Error("Profile not found");
    if (decision === "rejected" && !note?.trim()) throw new Error("Give a reason so the advocate can fix it.");
    await ctx.db.patch(profileId, {
      verified: decision === "verified",
      verificationStatus: decision,
      verificationNote: note?.trim().slice(0, 500) || undefined,
      verifiedAt: decision === "verified" ? Date.now() : undefined,
    });
    await audit(ctx, `lawyer.verification.${decision}`, `lawyerProfiles/${profileId}`, undefined, { note: note ?? null });
  },
});

/** Trust + marketplace metrics (PRD §15). */
export const metrics = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx);
    const briefs = await ctx.db.query("researchBriefs").order("desc").take(1000);
    const sessions = await ctx.db.query("chatSessions").order("desc").take(2000);
    const actions = await ctx.db.query("leadActions").take(5000);
    const profiles = await ctx.db.query("lawyerProfiles").take(2000);
    const courts = new Map((await loadCourts(ctx)).map((c) => [c.code, c]));

    const routed = sessions.filter((s) => s.category && s.category !== "other");
    const consented = sessions.filter((s) => s.consentToShare && !s.withdrawnAt);
    const accepted = new Set(actions.filter((a) => a.action === "accepted").map((a) => a.sessionId));
    const avgFab = briefs.length ? briefs.reduce((s, b) => s + b.fabricationRate, 0) / briefs.length : 0;

    const perDistrict = new Map<string, number>();
    for (const p of profiles.filter((p) => p.verified && p.listed)) {
      const c = p.homeCourts?.[0] ? courts.get(p.homeCourts[0]) : undefined;
      const key = c ? `${c.district}, ${c.state}` : p.city ?? "Unknown";
      perDistrict.set(key, (perDistrict.get(key) ?? 0) + 1);
    }
    const byDomain = new Map<string, number>();
    for (const s of routed) byDomain.set(categoryLabel(s.category), (byDomain.get(categoryLabel(s.category)) ?? 0) + 1);

    return {
      trust: {
        briefs: briefs.length,
        avgFabricationRate: avgFab,
        briefsWithDroppedCitations: briefs.filter((b) => b.droppedCount > 0).length,
      },
      citizen: {
        sessions: sessions.length,
        routedSessions: routed.length,
        consentedLeads: consented.length,
        optInRate: routed.length ? consented.length / routed.length : 0,
        leadsWithLocation: consented.filter((s) => s.clientLat !== undefined).length,
        byDomain: [...byDomain.entries()].sort((a, b) => b[1] - a[1]).map(([domain, count]) => ({ domain, count })),
      },
      marketplace: {
        advocates: profiles.length,
        verifiedListed: profiles.filter((p) => p.verified && p.listed).length,
        pendingVerification: profiles.filter((p) => p.verificationStatus === "pending").length,
        leadsAccepted: accepted.size,
        leadToMatterRate: consented.length ? accepted.size / consented.length : 0,
        verifiedPerDistrict: [...perDistrict.entries()].sort((a, b) => b[1] - a[1]).map(([district, count]) => ({ district, count })),
      },
    };
  },
});

// ── Corpus re-index (after adding/changing GEMINI_API_KEY, or for legacy chunks) ──
export const chunkPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()), numItems: v.number() },
  handler: async (ctx, { cursor, numItems }) => {
    const page = await ctx.db.query("corpusChunks").paginate({ cursor, numItems });
    return { ids: page.page.map((c) => c._id), texts: page.page.map((c) => c.text), cursor: page.continueCursor, isDone: page.isDone };
  },
});

export const writeEmbeddings = internalMutation({
  args: { rows: v.array(v.object({ id: v.id("corpusChunks"), embedding: v.array(v.float64()) })), embedder: v.string() },
  handler: async (ctx, { rows, embedder }) => {
    for (const r of rows) await ctx.db.patch(r.id, { embedding: r.embedding, embedder });
  },
});

export const checkAdmin = internalQuery({ args: {}, handler: async (ctx) => isPlatformAdmin(ctx) });

export const reindexCorpus = action({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor }): Promise<{ reindexed: number; embedder: string; done: boolean; cursor: string | null }> => {
    if (!(await ctx.runQuery(internal.admin.checkAdmin, {}))) throw new Error("Forbidden: platform admin only");
    let cur: string | null = cursor ?? null;
    let total = 0;
    let embedder = "hash";
    for (let i = 0; i < 10; i++) {
      const page: { ids: any[]; texts: string[]; cursor: string; isDone: boolean } = await ctx.runQuery(internal.admin.chunkPage, { cursor: cur, numItems: 50 });
      if (page.ids.length) {
        const res = await embedWithInfo(page.texts);
        embedder = res.embedder;
        await ctx.runMutation(internal.admin.writeEmbeddings, {
          rows: page.ids.map((id, j) => ({ id, embedding: res.vectors[j] })),
          embedder: res.embedder,
        });
        total += page.ids.length;
      }
      cur = page.cursor;
      if (page.isDone) return { reindexed: total, embedder, done: true, cursor: null };
    }
    return { reindexed: total, embedder, done: false, cursor: cur };
  },
});
