// Advocate research copilot — the Side A chatbot (distinct from the citizen assistant in chat.ts).
//
//   citizen assistant (chat.ts)          advocate copilot (this file)
//   ───────────────────────────          ────────────────────────────
//   anonymous public, plain language     signed-in advocates, firm-scoped (tenant guard)
//   triage → rights → consent → lead     matter-aware legal research → brief → draft
//   "general" routing after PII redact   "privileged" routing only (never a training endpoint)
//   rules engine always answers          answers ONLY from retrieved corpus authorities
//
// Flow: `send` (mutation, authenticated) stores the question + a pending answer and schedules
// `generate` (internal action). `generate` appends live thinking steps to the pending message
// (the UI subscribes reactively), retrieves authorities (hybrid search), asks a no-training LLM to
// answer citing sources as [n], then runs the answer guard: every case name / citation the answer
// mentions must resolve to a retrieved source or the corpus — sentences relying on anything else
// are DROPPED before the answer is ever shown. Nothing unverified is streamed to the user.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { guardAnswer, mentionedAuthorities } from "./lib/answerGuard";
import { parseCitation } from "./lib/citation";
import { complete, hasLiveProvider } from "./lib/llm";
import { categoryLabel, getChecklist } from "./lib/taxonomy";
import { extractiveSummary } from "./lib/text";
import { audit, requireFirmMember, requireUser } from "./model/access";
import { findDocByCaseName, findDocByCitation } from "./model/corpus";
import { hybridRetrieve } from "./model/retrieval";

const MAX_SOURCES = 6;

const SYS = `You are NyayaSetu Copilot, a legal research assistant for Indian advocates.
Rules (strict):
- Case law: rely ONLY on the numbered SOURCES provided. Cite them inline as [1], [2]. Never name,
  cite or allude to any judgment that is not in SOURCES — not even famous ones. If SOURCES do not
  support a point, say the corpus has no verified authority for it.
- Statutes: you may explain the statutory framework from general knowledge (current law: BNS,
  BNSS and BSA replaced IPC, CrPC and the Evidence Act from 1 July 2024; mention the old section
  where it helps). Label such points "(statutory framework — verify the current text)".
- Never invent facts about the client's matter. If a fact is missing, list it under "Gaps".
- Be precise, practical and concise. You are assisting a professional; no disclaimers about
  consulting a lawyer.
Format (Markdown):
**Short answer** — 2-4 sentences.
**Analysis** — short paragraphs or bullets, each authority-backed point citing [n].
**Practical next steps** — bullets (forum, limitation, documents, notices).
**Gaps** — bullets of facts/evidence to confirm (omit if none).`;

// ── queries ──────────────────────────────────────────────────────────────────
export const threads = query({
  args: { matterId: v.optional(v.id("matters")) },
  handler: async (ctx, { matterId }) => {
    const userId = await requireUser(ctx);
    if (matterId) {
      const matter = await ctx.db.get(matterId);
      if (!matter) return [];
      await requireFirmMember(ctx, matter.firmId);
      return ctx.db
        .query("copilotThreads")
        .withIndex("by_matter", (q) => q.eq("matterId", matterId))
        .order("desc")
        .take(50);
    }
    const rows = await ctx.db
      .query("copilotThreads")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    return Promise.all(
      rows.map(async (t) => ({
        ...t,
        matterTitle: t.matterId ? ((await ctx.db.get(t.matterId))?.title ?? null) : null,
      })),
    );
  },
});

export const messages = query({
  args: { threadId: v.id("copilotThreads") },
  handler: async (ctx, { threadId }) => {
    const thread = await ctx.db.get(threadId);
    if (!thread) return null;
    await requireFirmMember(ctx, thread.firmId);
    const rows = await ctx.db
      .query("copilotMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .collect();
    return { thread, messages: rows };
  },
});

// ── send ─────────────────────────────────────────────────────────────────────
export const send = mutation({
  args: {
    threadId: v.optional(v.id("copilotThreads")),
    matterId: v.optional(v.id("matters")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const content = args.content.trim().slice(0, 4000);
    if (!content) throw new Error("Type a research question.");

    let thread: Doc<"copilotThreads"> | null = null;
    if (args.threadId) {
      thread = await ctx.db.get(args.threadId);
      if (!thread) throw new Error("Conversation not found.");
      await requireFirmMember(ctx, thread.firmId);
      if (thread.userId !== userId) throw new Error("Forbidden: this conversation belongs to a colleague.");
      const pending = await ctx.db
        .query("copilotMessages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread!._id))
        .filter((q) => q.eq(q.field("status"), "pending"))
        .first();
      if (pending) throw new Error("Still working on the previous question.");
    }

    let threadId: Id<"copilotThreads">;
    let firmId: Id<"firms">;
    if (thread) {
      threadId = thread._id;
      firmId = thread.firmId;
      await ctx.db.patch(threadId, { updatedAt: Date.now() });
    } else {
      let matterId: Id<"matters"> | undefined;
      if (args.matterId) {
        const matter = await ctx.db.get(args.matterId);
        if (!matter) throw new Error("Matter not found.");
        await requireFirmMember(ctx, matter.firmId);
        firmId = matter.firmId;
        matterId = matter._id;
      } else {
        const membership = await ctx.db
          .query("memberships")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .first();
        if (!membership) throw new Error("Create your workspace (firm) first.");
        firmId = membership.firmId;
      }
      threadId = await ctx.db.insert("copilotThreads", {
        firmId,
        userId,
        matterId,
        title: content.replace(/\s+/g, " ").slice(0, 80),
        updatedAt: Date.now(),
      });
    }

    await ctx.db.insert("copilotMessages", { threadId, firmId, role: "user", content, status: "done", steps: [] });
    const messageId = await ctx.db.insert("copilotMessages", {
      threadId,
      firmId,
      role: "assistant",
      content: "",
      status: "pending",
      steps: ["Reading your question"],
    });
    await ctx.scheduler.runAfter(0, internal.copilot.generate, { messageId });
    return { threadId, messageId };
  },
});

export const deleteThread = mutation({
  args: { threadId: v.id("copilotThreads") },
  handler: async (ctx, { threadId }) => {
    const userId = await requireUser(ctx);
    const t = await ctx.db.get(threadId);
    if (!t) return;
    await requireFirmMember(ctx, t.firmId);
    if (t.userId !== userId) throw new Error("Forbidden");
    for (const m of await ctx.db.query("copilotMessages").withIndex("by_thread", (q) => q.eq("threadId", threadId)).collect()) {
      await ctx.db.delete(m._id);
    }
    await ctx.db.delete(threadId);
  },
});

/** Save a copilot answer as a research brief on a matter, so it feeds the drafting engine. */
export const saveToMatter = mutation({
  args: { messageId: v.id("copilotMessages"), matterId: v.optional(v.id("matters")) },
  handler: async (ctx, { messageId, matterId }) => {
    const msg = await ctx.db.get(messageId);
    if (!msg || msg.role !== "assistant" || msg.status !== "done") throw new Error("Answer not ready.");
    await requireFirmMember(ctx, msg.firmId);
    const thread = await ctx.db.get(msg.threadId);
    const target = matterId ?? thread?.matterId;
    if (!target) throw new Error("Pick a matter to save this research to.");
    const matter = await ctx.db.get(target);
    if (!matter || matter.firmId !== msg.firmId) throw new Error("Matter not in your firm.");
    if (msg.briefId && !matterId) return { briefId: msg.briefId, matterId: target };

    // The question is the user message just before this answer.
    const rows = await ctx.db.query("copilotMessages").withIndex("by_thread", (q) => q.eq("threadId", msg.threadId)).collect();
    const idx = rows.findIndex((r) => r._id === messageId);
    const question = rows.slice(0, idx).reverse().find((r) => r.role === "user")?.content ?? thread?.title ?? "Research";

    const briefId = await ctx.db.insert("researchBriefs", {
      firmId: msg.firmId,
      matterId: target,
      modelUsed: msg.modelUsed ?? "copilot",
      sensitivity: "privileged",
      status: "generated",
      queryText: question,
      body: msg.content,
      fabricationRate: msg.fabricationRate ?? 0,
      droppedCount: msg.droppedCount ?? 0,
    });
    for (const s of msg.sources ?? []) {
      await ctx.db.insert("citations", {
        firmId: msg.firmId,
        briefId,
        caseName: s.caseName,
        citationString: s.citationString,
        sourceUrl: s.sourceUrl,
        corpusDocumentId: s.corpusDocumentId,
        verificationStatus: "verified",
        relevancePassage: s.passage,
        matchMethod: s.matchMethod,
      });
    }
    if (matter.status === "intake") await ctx.db.patch(target, { status: "research" });
    await ctx.db.patch(messageId, { briefId });
    await audit(ctx, "copilot.saveBrief", `researchBriefs/${briefId}`, msg.firmId, { matterId: target });
    return { briefId, matterId: target };
  },
});

// ── internals used by the generator ───────────────────────────────────────────
export const context = internalQuery({
  args: { messageId: v.id("copilotMessages") },
  handler: async (ctx, { messageId }) => {
    const msg = await ctx.db.get(messageId);
    if (!msg) return null;
    const thread = await ctx.db.get(msg.threadId);
    if (!thread) return null;
    const rows = await ctx.db.query("copilotMessages").withIndex("by_thread", (q) => q.eq("threadId", thread._id)).collect();
    const history = rows
      .filter((r) => r._id !== messageId && r.status === "done")
      .slice(-8)
      .map((r) => ({ role: r.role, content: r.content.slice(0, 1500) }));
    let matter = null;
    if (thread.matterId) {
      const m = await ctx.db.get(thread.matterId);
      if (m) {
        const sub = getChecklist(m.category, m.subcategory);
        matter = {
          title: m.title,
          category: categoryLabel(m.category),
          subcategory: sub?.label ?? m.subcategory,
          facts: m.summaryText.slice(0, 2500),
          researchSeed: sub?.researchSeed ?? "",
        };
      }
    }
    return { history, matter };
  },
});

export const progress = internalMutation({
  args: { messageId: v.id("copilotMessages"), step: v.string() },
  handler: async (ctx, { messageId, step }) => {
    const m = await ctx.db.get(messageId);
    if (!m || m.status !== "pending") return;
    await ctx.db.patch(messageId, { steps: [...m.steps, step] });
  },
});

export const finish = internalMutation({
  args: {
    messageId: v.id("copilotMessages"),
    status: v.union(v.literal("done"), v.literal("error")),
    content: v.string(),
    step: v.optional(v.string()),
    sources: v.optional(
      v.array(
        v.object({
          n: v.number(),
          caseName: v.string(),
          citationString: v.string(),
          sourceUrl: v.optional(v.string()),
          corpusDocumentId: v.optional(v.id("corpusDocuments")),
          passage: v.string(),
          matchMethod: v.string(),
        }),
      ),
    ),
    fabricationRate: v.optional(v.number()),
    droppedCount: v.optional(v.number()),
    removed: v.optional(v.array(v.string())),
    modelUsed: v.optional(v.string()),
  },
  handler: async (ctx, { messageId, step, ...rest }) => {
    const m = await ctx.db.get(messageId);
    if (!m) return;
    await ctx.db.patch(messageId, { ...rest, steps: step ? [...m.steps, step] : m.steps });
    await ctx.db.patch(m.threadId, { updatedAt: Date.now() });
  },
});

/** Resolve the authorities an LLM answer mentions against the corpus (for the answer guard). */
export const resolveMentions = internalQuery({
  args: { caseNames: v.array(v.string()), citationKeys: v.array(v.string()) },
  handler: async (ctx, { caseNames, citationKeys }) => {
    const names: string[] = [];
    for (const n of caseNames.slice(0, 20)) {
      const doc = await findDocByCaseName(ctx, n, 0.7);
      if (doc) names.push(n, doc.caseName);
    }
    const keys: string[] = [];
    for (const k of citationKeys.slice(0, 20)) {
      if (await findDocByCitation(ctx, k)) keys.push(k);
    }
    return { names, keys };
  },
});

// ── the generator ────────────────────────────────────────────────────────────
export const generate = internalAction({
  args: { messageId: v.id("copilotMessages") },
  handler: async (ctx, { messageId }) => {
    const step = (s: string) => ctx.runMutation(internal.copilot.progress, { messageId, step: s });
    try {
      const c = await ctx.runQuery(internal.copilot.context, { messageId });
      if (!c) return;
      const question = [...c.history].reverse().find((h) => h.role === "user")?.content ?? "";
      const priorUser = c.history.filter((h) => h.role === "user").slice(-2, -1)[0]?.content ?? "";

      // Retrieval query: the question, enriched with the matter's domain (and the previous
      // question for short follow-ups like "what about limitation?").
      const retrievalQuery = [
        question,
        question.length < 80 ? priorUser : "",
        c.matter ? `${c.matter.category} ${c.matter.subcategory} ${c.matter.researchSeed}` : "",
      ]
        .filter(Boolean)
        .join(" ")
        .slice(0, 1200);

      await step(c.matter ? `Loaded matter context: ${c.matter.title}` : "Searching across the full judgment corpus");
      const ret = await hybridRetrieve(ctx, retrievalQuery, 8);
      const authorities = ret.authorities.slice(0, MAX_SOURCES);
      await step(
        authorities.length
          ? `Retrieved ${authorities.length} authorit${authorities.length === 1 ? "y" : "ies"} (hybrid vector + full-text, ${ret.embedder} embeddings)`
          : "No authority in the corpus matched this question",
      );
      if (ret.droppedCount) await step(`Dropped ${ret.droppedCount} cross-citation(s) that don't resolve to the corpus`);

      const sources = authorities.map((a, i) => ({
        n: i + 1,
        caseName: a.caseName,
        citationString: a.citationString,
        sourceUrl: a.sourceUrl,
        corpusDocumentId: a.corpusDocumentId as Id<"corpusDocuments"> | undefined,
        passage: a.relevancePassage.slice(0, 1200),
        matchMethod: a.matchMethod,
      }));

      let answer = "";
      let modelUsed = "extractive";
      if (hasLiveProvider("privileged")) {
        await step("Drafting a grounded answer (privileged route — no-training model)");
        const srcBlock = sources.length
          ? sources
              .map((s) => `[${s.n}] ${s.caseName}${s.citationString ? ` — ${s.citationString}` : ""}\n${s.passage}`)
              .join("\n\n")
          : "(none — the corpus has no verified authority for this question)";
        const matterBlock = c.matter
          ? `MATTER: ${c.matter.title} (${c.matter.category} / ${c.matter.subcategory})\nFACTS: ${c.matter.facts || "(not recorded)"}\n\n`
          : "";
        const convo = c.history
          .slice(0, -1)
          .map((h) => `${h.role.toUpperCase()}: ${h.content}`)
          .join("\n");
        const prompt =
          `${matterBlock}${convo ? `EARLIER CONVERSATION:\n${convo}\n\n` : ""}SOURCES:\n${srcBlock}\n\n` +
          `QUESTION: ${question}`;
        try {
          const res = await complete("privileged", SYS, prompt, { timeoutMs: 40_000, maxTokens: 1400 });
          if (res.provider !== "echo" && res.text.trim().length > 40) {
            answer = res.text.trim();
            modelUsed = `${res.provider}:${res.model}`;
          }
        } catch (e) {
          console.warn(`[copilot] LLM failed, using extractive answer: ${String(e).slice(0, 200)}`);
        }
      }

      let removed: string[] = [];
      if (answer) {
        await step("Verifying every case name and citation in the answer against the corpus");
        const mentioned = mentionedAuthorities(answer);
        const resolved = await ctx.runQuery(internal.copilot.resolveMentions, {
          caseNames: mentioned.caseNames,
          citationKeys: mentioned.citations.map((x) => x.key),
        });
        const guarded = guardAnswer({
          answer,
          sourceCount: sources.length,
          sourceCaseNames: sources.map((s) => s.caseName),
          sourceCitationKeys: sources.flatMap((s) => {
            const p = parseCitation(s.citationString);
            return p ? [p.canonical] : [];
          }),
          corpusCaseNames: resolved.names,
          corpusCitationKeys: resolved.keys,
        });
        answer = guarded.text;
        removed = guarded.removed;
        await step(
          removed.length
            ? `Removed ${removed.length} unverified reference(s) before display`
            : guarded.checked
              ? `All ${guarded.checked} case/citation reference(s) verified against the corpus`
              : "Answer relies only on the retrieved sources",
        );
      }

      if (!answer) {
        // Offline / LLM-down path: an extractive, grounded answer — never invented.
        answer = sources.length
          ? `**Verified authorities from the corpus**\n\n` +
            sources
              .map((s) => `- **${s.caseName}**${s.citationString ? ` — ${s.citationString}` : ""} [${s.n}]: ${extractiveSummary(s.passage)}`)
              .join("\n") +
            `\n\n_Extractive summary (no generative model available) — read the passages before relying on them._`
          : "The corpus has no verified authority on this question yet. Rephrase with the legal issue (e.g. the Act and section), or ingest more judgments.";
      }

      const total = (ret.droppedCount ?? 0) + removed.length + sources.length;
      await ctx.runMutation(internal.copilot.finish, {
        messageId,
        status: "done",
        content: answer,
        step: "Answer ready",
        sources,
        modelUsed,
        removed,
        droppedCount: ret.droppedCount + removed.length,
        fabricationRate: total ? (ret.droppedCount + removed.length) / total : 0,
      });
    } catch (e) {
      console.error(`[copilot] generate failed: ${String(e).slice(0, 300)}`);
      await ctx.runMutation(internal.copilot.finish, {
        messageId,
        status: "error",
        content: "Something went wrong while researching. Please try again.",
      });
    }
  },
});
