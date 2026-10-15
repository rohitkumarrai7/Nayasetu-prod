// Scalable, FREE bulk ingestion (the "bring all the cases in" rethink).
//
// Indian Kanoon's API is paid per-call, so it is NOT how we populate the corpus at scale. Instead
// we ingest FREE bulk public-record corpora, published as sharded NDJSON/JSONL files:
//   • eCourts / OpenJustice High Court + Supreme Court judgment dumps (public records)
//   • Hugging Face Indian-judgment datasets exported to NDJSON (check each dataset's license)
// IK's paid API stays an optional on-demand top-up for freshness, not the bulk path.
//
// A "dataset" here is a list of shard URLs. This action ingests one bounded batch per invocation
// and self-schedules the next (shardIndex/offset), so it is resumable, idempotent (upsert by
// source+sourceDocId, dedup by contentHash), and stays within Convex function limits at any scale.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { isPlatformAdmin } from "./model/admin";

const mapping = v.object({
  id: v.optional(v.string()),
  caseName: v.optional(v.string()),
  text: v.optional(v.string()),
  citations: v.optional(v.string()),
  court: v.optional(v.string()),
  url: v.optional(v.string()),
});

const DEFAULTS = {
  id: ["id", "doc_id", "case_id", "cnr", "tid"],
  caseName: ["case_name", "title", "name", "case_title"],
  text: ["text", "judgment", "judgement", "full_text", "content", "case_text", "body"],
  citations: ["citation", "citations", "cited_as", "neutral_citation"],
  court: ["court", "high_court", "docsource", "bench_court"],
  url: ["url", "source_url", "link"],
};

function pick(row: Record<string, unknown>, keys: string[], override?: string): string {
  const lower: Record<string, unknown> = {};
  for (const k of Object.keys(row)) lower[k.toLowerCase()] = row[k];
  const candidates = override ? [override, ...keys] : keys;
  for (const k of candidates) {
    const val = lower[k.toLowerCase()];
    if (val != null && String(val).trim()) return String(val).trim();
  }
  return "";
}

export const progressUpsert = internalMutation({
  args: { source: v.string(), status: v.string(), cursor: v.optional(v.string()), stats: v.any() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ingestRuns")
      .withIndex("by_source", (q) => q.eq("source", args.source))
      .order("desc")
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status as any,
        cursor: args.cursor,
        stats: args.stats,
      });
      return existing._id;
    }
    return ctx.db.insert("ingestRuns", {
      source: args.source,
      status: args.status as any,
      cursor: args.cursor,
      stats: args.stats,
    });
  },
});

export const getProgress = internalQuery({
  args: { source: v.string() },
  handler: async (ctx, { source }) => {
    return ctx.db
      .query("ingestRuns")
      .withIndex("by_source", (q) => q.eq("source", source))
      .order("desc")
      .first();
  },
});

const bulkArgs = {
    source: v.string(),
    shardUrls: v.array(v.string()),
    shardIndex: v.optional(v.number()),
    offset: v.optional(v.number()),
    batchSize: v.optional(v.number()),
    maxTotal: v.optional(v.number()),
    mapping: v.optional(mapping),
    totalIngested: v.optional(v.number()),
};

export const checkAdmin = internalQuery({ args: {}, handler: async (ctx) => isPlatformAdmin(ctx) });

/** Public entry point — platform admins only (fetches arbitrary URLs and writes the shared corpus). */
export const ingestBulk = action({
  args: bulkArgs,
  handler: async (ctx, args): Promise<{ done: boolean; source: string; totalIngested: number }> => {
    if (!(await ctx.runQuery(internal.ingestBulk.checkAdmin, {}))) {
      throw new Error("Forbidden: bulk ingestion is for platform admins (ADMIN_EMAILS)");
    }
    return ctx.runAction(internal.ingestBulk.ingestBatch, args);
  },
});

/** One bounded batch; self-schedules the next (resumable, idempotent). */
export const ingestBatch = internalAction({
  args: bulkArgs,
  handler: async (ctx, args): Promise<{ done: boolean; source: string; totalIngested: number }> => {

    const shardIndex = args.shardIndex ?? 0;
    const offset = args.offset ?? 0;
    const batchSize = args.batchSize ?? 100;
    const maxTotal = args.maxTotal ?? Number.MAX_SAFE_INTEGER;
    let totalIngested = args.totalIngested ?? 0;

    if (shardIndex >= args.shardUrls.length || totalIngested >= maxTotal) {
      await ctx.runMutation(internal.ingestBulk.progressUpsert, {
        source: args.source,
        status: "completed",
        cursor: `${shardIndex}:${offset}`,
        stats: { totalIngested },
      });
      return { done: true, source: args.source, totalIngested };
    }

    await ctx.runMutation(internal.ingestBulk.progressUpsert, {
      source: args.source,
      status: "running",
      cursor: `${shardIndex}:${offset}`,
      stats: { totalIngested },
    });

    // Fetch + parse one shard (NDJSON / JSONL). Lines are objects.
    const res = await fetch(args.shardUrls[shardIndex]);
    if (!res.ok) throw new Error(`shard fetch failed ${res.status}: ${args.shardUrls[shardIndex]}`);
    const body = await res.text();
    const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);

    const slice = lines.slice(offset, offset + batchSize);
    const records = [];
    for (let i = 0; i < slice.length; i++) {
      let row: Record<string, unknown>;
      try {
        row = JSON.parse(slice[i]);
      } catch {
        continue;
      }
      const text = pick(row, DEFAULTS.text, args.mapping?.text);
      if (!text) continue;
      const citations = pick(row, DEFAULTS.citations, args.mapping?.citations)
        .replace(/;/g, ",")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      records.push({
        source: args.source,
        sourceDocId: pick(row, DEFAULTS.id, args.mapping?.id) || `${shardIndex}:${offset + i}`,
        caseName: pick(row, DEFAULTS.caseName, args.mapping?.caseName) || `Judgment ${offset + i}`,
        rawText: text,
        citations,
        court: pick(row, DEFAULTS.court, args.mapping?.court) || undefined,
        sourceUrl: pick(row, DEFAULTS.url, args.mapping?.url) || undefined,
      });
    }

    if (records.length > 0) {
      const stats = await ctx.runAction(internal.ingest.ingestRecords, { records });
      totalIngested += stats.ingested;
    }

    // Compute the next cursor and self-schedule (resumable continuation).
    let nextShard = shardIndex;
    let nextOffset = offset + batchSize;
    if (nextOffset >= lines.length) {
      nextShard = shardIndex + 1;
      nextOffset = 0;
    }
    const more = nextShard < args.shardUrls.length && totalIngested < maxTotal;
    if (more) {
      await ctx.scheduler.runAfter(0, internal.ingestBulk.ingestBatch, {
        ...args,
        shardIndex: nextShard,
        offset: nextOffset,
        totalIngested,
      });
      return { done: false, source: args.source, totalIngested };
    }

    await ctx.runMutation(internal.ingestBulk.progressUpsert, {
      source: args.source,
      status: "completed",
      cursor: `${nextShard}:${nextOffset}`,
      stats: { totalIngested },
    });
    return { done: true, source: args.source, totalIngested };
  },
});
