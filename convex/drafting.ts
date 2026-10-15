import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, mutation } from "./_generated/server";
import { buildDraft } from "./lib/draftTemplates";
import { complete } from "./lib/llm";
import { categoryLabel } from "./lib/taxonomy";
import { requireFirmMember } from "./model/access";

const DRAFT_SYS =
  "You are an Indian advocate drafting a legal document. Use ONLY the facts and the verified " +
  "authorities provided. Insert citations exactly as given; never invent a citation or a holding. " +
  "Where the brief lacks support for a point, leave a clearly marked [TO CONFIRM] gap rather than " +
  "fabricating. Output clean, professional prose suitable for filing/editing.";

export const briefBundle = internalQuery({
  args: { briefId: v.id("researchBriefs") },
  handler: async (ctx, { briefId }) => {
    const brief = await ctx.db.get(briefId);
    if (!brief) throw new Error("Brief not found");
    await requireFirmMember(ctx, brief.firmId);
    const authorities = await ctx.db
      .query("citations")
      .withIndex("by_brief", (q) => q.eq("briefId", briefId))
      .collect();
    const matter = await ctx.db.get(brief.matterId);
    const client = matter ? await ctx.db.get(matter.clientId) : null;
    return { brief, authorities, clientName: client?.name ?? "", category: matter?.category ?? "" };
  },
});

export const saveDraft = internalMutation({
  args: {
    firmId: v.id("firms"),
    matterId: v.id("matters"),
    briefId: v.optional(v.id("researchBriefs")),
    docType: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await requireFirmMember(ctx, args.firmId);
    const id = await ctx.db.insert("drafts", {
      firmId: args.firmId,
      matterId: args.matterId,
      briefId: args.briefId,
      docType: args.docType,
      content: args.content,
      status: "draft",
    });
    await ctx.db.patch(args.matterId, { status: "drafting" });
    return id;
  },
});

export const generateDraft = action({
  args: {
    briefId: v.id("researchBriefs"),
    docType: v.string(),
    facts: v.string(),
    sensitivity: v.optional(v.union(v.literal("privileged"), v.literal("general"))),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ draftId: Id<"drafts">; content: string; modelUsed: string }> => {
    const sensitivity = args.sensitivity ?? "privileged";
    const { brief, authorities, clientName, category } = await ctx.runQuery(internal.drafting.briefBundle, {
      briefId: args.briefId,
    });

    const ctxLines = [`ISSUE: ${brief.queryText}`, "", "VERIFIED AUTHORITIES:"];
    if (authorities.length === 0) {
      ctxLines.push("(none verified — draft on facts only, mark legal points [TO CONFIRM])");
    }
    for (const a of authorities) {
      const cite = a.citationString ? ` (${a.citationString})` : "";
      ctxLines.push(`- ${a.caseName}${cite}: ${a.relevancePassage.slice(0, 200)}`);
    }

    const instruction = `Draft a ${args.docType.replace(/_/g, " ")}.`;
    const prompt =
      `${instruction}\n\nFACTS:\n${args.facts}\n\nCONTEXT:\n${ctxLines.join("\n")}\n\n` +
      "Produce the full document text.";
    let content = "";
    let modelUsed = "template";
    try {
      const res = await complete(sensitivity, DRAFT_SYS, prompt, { timeoutMs: 45_000, maxTokens: 2500 });
      if (res.provider !== "echo" && res.text.trim().length > 200) {
        content = res.text.trim();
        modelUsed = `${res.provider}:${res.model}`;
      }
    } catch (e) {
      console.warn(`[drafting] LLM failed, using template: ${String(e).slice(0, 200)}`);
    }
    if (!content) {
      content = buildDraft({
        docType: args.docType,
        issue: brief.queryText,
        facts: args.facts,
        clientName,
        categoryLabel: categoryLabel(category),
        authorities: authorities.map((a) => ({
          caseName: a.caseName,
          citationString: a.citationString,
          relevancePassage: a.relevancePassage,
        })),
      });
    }

    const draftId = await ctx.runMutation(internal.drafting.saveDraft, {
      firmId: brief.firmId,
      matterId: brief.matterId,
      briefId: args.briefId,
      docType: args.docType,
      content,
    });
    return { draftId, content, modelUsed };
  },
});

export const updateDraft = mutation({
  args: { draftId: v.id("drafts"), content: v.string(), status: v.optional(v.string()) },
  handler: async (ctx, { draftId, content, status }) => {
    const d = await ctx.db.get(draftId);
    if (!d) throw new Error("Draft not found");
    await requireFirmMember(ctx, d.firmId);
    await ctx.db.patch(draftId, { content: content.slice(0, 200_000), status: status ?? d.status });
  },
});
