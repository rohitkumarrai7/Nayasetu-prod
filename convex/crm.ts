import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { MutationCtx, mutation, query, QueryCtx } from "./_generated/server";
import { audit, requireFirmMember } from "./model/access";

// ── Clients ──────────────────────────────────────────────────────────────────
export const createClient = mutation({
  args: {
    firmId: v.id("firms"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    city: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireFirmMember(ctx, args.firmId);
    const id = await ctx.db.insert("clients", {
      firmId: args.firmId,
      name: args.name,
      email: args.email,
      phone: args.phone,
      city: args.city,
      notes: args.notes,
      createdBy: userId,
    });
    await audit(ctx, "client.create", `clients/${id}`, args.firmId);
    return id;
  },
});

export const listClients = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireFirmMember(ctx, firmId);
    return ctx.db
      .query("clients")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .order("desc")
      .collect();
  },
});

// ── Matters ──────────────────────────────────────────────────────────────────
export const createMatter = mutation({
  args: {
    firmId: v.id("firms"),
    clientId: v.id("clients"),
    title: v.string(),
    category: v.string(),
    subcategory: v.string(),
    summaryText: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireFirmMember(ctx, args.firmId);
    const client = await ctx.db.get(args.clientId);
    if (!client || client.firmId !== args.firmId) throw new Error("Client not in firm");
    const id = await ctx.db.insert("matters", {
      firmId: args.firmId,
      clientId: args.clientId,
      title: args.title,
      category: args.category,
      subcategory: args.subcategory,
      summaryText: args.summaryText,
      status: "intake",
      createdBy: userId,
    });
    await audit(ctx, "matter.create", `matters/${id}`, args.firmId);
    return id;
  },
});

export const listMatters = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    await requireFirmMember(ctx, firmId);
    const matters = await ctx.db
      .query("matters")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .order("desc")
      .collect();
    // join client names for display
    return Promise.all(
      matters.map(async (m) => ({
        ...m,
        clientName: (await ctx.db.get(m.clientId))?.name ?? "—",
      })),
    );
  },
});

export const getMatter = query({
  args: { matterId: v.id("matters") },
  handler: async (ctx, { matterId }) => {
    const matter = await loadMatterScoped(ctx, matterId);
    const client = await ctx.db.get(matter.clientId);
    const briefs = await ctx.db
      .query("researchBriefs")
      .withIndex("by_matter", (q) => q.eq("matterId", matterId))
      .order("desc")
      .collect();
    const drafts = await ctx.db
      .query("drafts")
      .withIndex("by_matter", (q) => q.eq("matterId", matterId))
      .order("desc")
      .collect();
    const briefsWithCitations = await Promise.all(
      briefs.map(async (b) => ({
        ...b,
        citations: await ctx.db
          .query("citations")
          .withIndex("by_brief", (q) => q.eq("briefId", b._id))
          .collect(),
      })),
    );
    return { matter, client, briefs: briefsWithCitations, drafts };
  },
});

export const updateMatterStatus = mutation({
  args: {
    matterId: v.id("matters"),
    status: v.union(
      v.literal("intake"),
      v.literal("research"),
      v.literal("drafting"),
      v.literal("active"),
      v.literal("closed"),
    ),
  },
  handler: async (ctx, { matterId, status }) => {
    const matter = await loadMatterScoped(ctx, matterId);
    await ctx.db.patch(matterId, { status });
    await audit(ctx, "matter.status", `matters/${matterId}`, matter.firmId, { status });
  },
});

export const updateMatter = mutation({
  args: { matterId: v.id("matters"), title: v.optional(v.string()), summaryText: v.optional(v.string()) },
  handler: async (ctx, { matterId, title, summaryText }) => {
    const matter = await loadMatterScoped(ctx, matterId);
    const patch: { title?: string; summaryText?: string } = {};
    if (title !== undefined && title.trim()) patch.title = title.trim().slice(0, 200);
    if (summaryText !== undefined) patch.summaryText = summaryText.slice(0, 20_000);
    await ctx.db.patch(matterId, patch);
    await audit(ctx, "matter.update", `matters/${matterId}`, matter.firmId);
  },
});

export const toggleChecklistItem = mutation({
  args: { matterId: v.id("matters"), item: v.string(), done: v.boolean() },
  handler: async (ctx, { matterId, item, done }) => {
    const matter = await loadMatterScoped(ctx, matterId);
    const set = new Set(matter.checklistDone ?? []);
    if (done) set.add(item);
    else set.delete(item);
    await ctx.db.patch(matterId, { checklistDone: [...set] });
  },
});

export const updateClient = mutation({
  args: {
    clientId: v.id("clients"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    city: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { clientId, ...rest }) => {
    const client = await ctx.db.get(clientId);
    if (!client) throw new Error("Client not found");
    await requireFirmMember(ctx, client.firmId);
    const patch = Object.fromEntries(Object.entries(rest).filter(([, val]) => val !== undefined));
    if (typeof patch.name === "string" && !patch.name.trim()) throw new Error("Client name can't be empty.");
    await ctx.db.patch(clientId, patch);
    await audit(ctx, "client.update", `clients/${clientId}`, client.firmId);
  },
});

/** Load a matter and assert the caller belongs to its firm. Shared guard. */
export async function loadMatterScoped(ctx: QueryCtx | MutationCtx, matterId: Id<"matters">) {
  const matter = await ctx.db.get(matterId);
  if (!matter) throw new Error("Matter not found");
  await requireFirmMember(ctx, matter.firmId);
  return matter;
}
