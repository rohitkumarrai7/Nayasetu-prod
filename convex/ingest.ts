import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { chunkText } from "./lib/chunk";
import { cleanJudgmentText, contentHash, isLowQuality } from "./lib/clean";
import { embedWithInfo } from "./lib/embeddings";
import { contentHashExists, storeDocument, StoredChunk } from "./model/corpus";

const rawJudgment = v.object({
  source: v.string(),
  sourceDocId: v.string(),
  caseName: v.string(),
  rawText: v.string(),
  citations: v.optional(v.array(v.string())),
  paraLabels: v.optional(v.array(v.string())),
  court: v.optional(v.string()),
  neutralCitation: v.optional(v.string()),
  decisionDate: v.optional(v.string()),
  bench: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
  docType: v.optional(v.string()), // "judgment" (default) | "statute"
});

export const hashExists = internalQuery({
  args: { hash: v.string() },
  handler: async (ctx, { hash }) => contentHashExists(ctx, hash),
});

export const storeJudgment = internalMutation({
  args: {
    doc: v.object({
      source: v.string(),
      sourceDocId: v.string(),
      court: v.optional(v.string()),
      caseName: v.string(),
      neutralCitation: v.optional(v.string()),
      citations: v.array(v.string()),
      decisionDate: v.optional(v.string()),
      bench: v.optional(v.string()),
      docType: v.string(),
      sourceUrl: v.optional(v.string()),
      contentHash: v.string(),
      cleanText: v.string(),
    }),
    chunks: v.array(
      v.object({
        ordinal: v.number(),
        paraLabel: v.optional(v.string()),
        text: v.string(),
        textHash: v.string(),
        embedding: v.array(v.float64()),
      }),
    ),
    embedder: v.optional(v.string()),
  },
  handler: async (ctx, { doc, chunks, embedder }) => {
    return storeDocument(ctx, doc, chunks as StoredChunk[], embedder);
  },
});

/**
 * INTERNAL: corpus writes are never exposed to clients (corpus poisoning). Entry points are
 * seed.loadDemoCorpus and ingestBulk.ingestBulk (platform admin).
 *
 * Ingest judgments: clean(denoise) -> quality gate -> dedup -> chunk -> embed -> store.
 * Idempotent (upsert by source+sourceDocId, dedup by contentHash) and resumable (call in
 * bounded batches). Runs as an action because embedding may call an external API.
 */
export const ingestRecords = internalAction({
  args: { records: v.array(rawJudgment) },
  handler: async (ctx, { records }) => {
    const stats = {
      seen: 0,
      ingested: 0,
      skippedLowQuality: 0,
      skippedDuplicate: 0,
      chunks: 0,
    };
    const seen = new Set<string>();

    for (const rec of records) {
      stats.seen++;
      const cleaned = cleanJudgmentText(rec.rawText);
      if (isLowQuality(cleaned)) {
        stats.skippedLowQuality++;
        continue;
      }
      const chash = contentHash(cleaned);
      if (seen.has(chash) || (await ctx.runQuery(internal.ingest.hashExists, { hash: chash }))) {
        stats.skippedDuplicate++;
        continue;
      }
      seen.add(chash);

      const rawChunks = chunkText(cleaned, { labels: rec.paraLabels });
      if (rawChunks.length === 0) {
        stats.skippedLowQuality++;
        continue;
      }
      const { vectors, embedder } = await embedWithInfo(rawChunks.map((c) => c.text));
      const chunks = rawChunks.map((c, i) => ({
        ordinal: c.ordinal,
        paraLabel: c.paraLabel,
        text: c.text,
        textHash: c.textHash,
        embedding: vectors[i],
      }));

      // Keep RAW citation strings for display; storeDocument builds the normalized index keys.
      const rawCites = [...new Set((rec.citations ?? []).map((c) => c.trim()).filter(Boolean))];

      await ctx.runMutation(internal.ingest.storeJudgment, {
        doc: {
          source: rec.source,
          sourceDocId: rec.sourceDocId,
          court: rec.court,
          caseName: rec.caseName,
          neutralCitation: rec.neutralCitation,
          citations: rawCites,
          decisionDate: rec.decisionDate,
          bench: rec.bench,
          docType: rec.docType ?? "judgment",
          sourceUrl: rec.sourceUrl,
          contentHash: chash,
          cleanText: cleaned,
        },
        chunks,
        embedder,
      });
      stats.ingested++;
      stats.chunks += chunks.length;
    }
    return stats;
  },
});
