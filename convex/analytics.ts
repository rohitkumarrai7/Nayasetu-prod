// Firm analytics (L9) — tenant-scoped: matters by status, research quality, drafting, leads.
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireFirmMember } from "./model/access";

export const firmStats = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    const { userId } = await requireFirmMember(ctx, firmId);
    const matters = await ctx.db.query("matters").withIndex("by_firm", (q) => q.eq("firmId", firmId)).take(2000);
    const clients = await ctx.db.query("clients").withIndex("by_firm", (q) => q.eq("firmId", firmId)).take(5000);
    const briefs = await ctx.db.query("researchBriefs").withIndex("by_firm", (q) => q.eq("firmId", firmId)).take(2000);
    const drafts = await ctx.db.query("drafts").withIndex("by_firm", (q) => q.eq("firmId", firmId)).take(2000);
    const myLeadActions = await ctx.db.query("leadActions").withIndex("by_lawyer", (q) => q.eq("lawyerUserId", userId)).collect();
    const byStatus: Record<string, number> = { intake: 0, research: 0, drafting: 0, active: 0, closed: 0 };
    for (const m of matters) byStatus[m.status] = (byStatus[m.status] ?? 0) + 1;
    const weekAgo = Date.now() - 7 * 86_400_000;
    return {
      clients: clients.length,
      matters: matters.length,
      byStatus,
      fromLeads: matters.filter((m) => m.sourceLeadId).length,
      briefs: briefs.length,
      avgFabricationRate: briefs.length ? briefs.reduce((s, b) => s + b.fabricationRate, 0) / briefs.length : 0,
      briefsWithAuthorities: briefs.filter((b) => !b.body.includes("No authorities could be verified")).length,
      drafts: drafts.length,
      leadsAccepted: myLeadActions.filter((a) => a.action === "accepted").length,
      leadsAcceptedThisWeek: myLeadActions.filter((a) => a.action === "accepted" && a.createdAt >= weekAgo).length,
    };
  },
});
