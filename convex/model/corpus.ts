// Corpus read/write helpers shared by ingestion and the research/verification pipeline.
import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { normalizeCitation } from "../lib/citation";
import { similarity } from "../lib/text";

export async function contentHashExists(ctx: QueryCtx, hash: string): Promise<boolean> {
  const row = await ctx.db
    .query("corpusDocuments")
    .withIndex("by_content_hash", (q) => q.eq("contentHash", hash))
    .first();
  return row !== null;
}

export interface StoredChunk {
  ordinal: number;
  paraLabel?: string;
  text: string;
  textHash: string;
  embedding: number[];
}

/** Atomically upsert a corpus document, its chunks, and its citation-index rows (idempotent). */
export async function storeDocument(
  ctx: MutationCtx,
  doc: Omit<Doc<"corpusDocuments">, "_id" | "_creationTime">,
  chunks: StoredChunk[],
  embedder?: string,
): Promise<Id<"corpusDocuments">> {
  const existing = await ctx.db
    .query("corpusDocuments")
    .withIndex("by_source_docid", (q) =>
      q.eq("source", doc.source).eq("sourceDocId", doc.sourceDocId),
    )
    .unique();

  let documentId: Id<"corpusDocuments">;
  if (existing) {
    documentId = existing._id;
    await ctx.db.patch(documentId, doc);
    // clear old chunks + citation rows for a clean, idempotent replace
    for (const c of await ctx.db
      .query("corpusChunks")
      .withIndex("by_document", (q) => q.eq("documentId", documentId))
      .collect()) {
      await ctx.db.delete(c._id);
    }
    for (const cc of await ctx.db
      .query("corpusCitations")
      .withIndex("by_document", (q) => q.eq("documentId", documentId))
      .collect()) {
      await ctx.db.delete(cc._id);
    }
  } else {
    documentId = await ctx.db.insert("corpusDocuments", doc);
  }

  for (const c of chunks) {
    await ctx.db.insert("corpusChunks", {
      documentId,
      ordinal: c.ordinal,
      paraLabel: c.paraLabel,
      text: c.text,
      textHash: c.textHash,
      caseName: doc.caseName,
      sourceUrl: doc.sourceUrl,
      embedding: c.embedding,
      embedder,
    });
  }

  // corpusDocuments.citations holds RAW citation strings (for display); the citation INDEX holds
  // canonical keys (for O(1) verification). Normalize here so both raw + parallel forms resolve.
  const keys = new Set<string>();
  for (const c of doc.citations) {
    const k = normalizeCitation(c);
    if (k) keys.add(k);
  }
  const neutral = doc.neutralCitation ? normalizeCitation(doc.neutralCitation) : null;
  if (neutral) keys.add(neutral);
  for (const key of keys) {
    await ctx.db.insert("corpusCitations", { key, documentId });
  }
  return documentId;
}

export async function findDocByCitation(
  ctx: QueryCtx,
  normalized: string,
): Promise<Doc<"corpusDocuments"> | null> {
  const row = await ctx.db
    .query("corpusCitations")
    .withIndex("by_key", (q) => q.eq("key", normalized))
    .first();
  if (!row) return null;
  return ctx.db.get(row.documentId);
}

/** Full-text candidate search on caseName, then a Dice-similarity threshold. Scalable. */
export async function findDocByCaseName(
  ctx: QueryCtx,
  name: string,
  minRatio = 0.82,
): Promise<Doc<"corpusDocuments"> | null> {
  const candidates = await ctx.db
    .query("corpusDocuments")
    .withSearchIndex("search_case_name", (q) => q.search("caseName", name))
    .take(10);
  let best: Doc<"corpusDocuments"> | null = null;
  let bestRatio = minRatio;
  for (const c of candidates) {
    const r = similarity(name, c.caseName);
    if (r >= bestRatio) {
      best = c;
      bestRatio = r;
    }
  }
  return best;
}
