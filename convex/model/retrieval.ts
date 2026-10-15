// Hybrid retrieval over the grounded corpus (PRD §9), shared by one-shot research briefs and the
// advocate copilot chat. Vector search (same embedder as the query) + full-text, fused with
// Reciprocal Rank Fusion, then inline cross-citations in the retrieved passages are verified
// against the corpus (unresolved → dropped → fabricationRate), then an IDF re-rank keeps only
// authorities with distinctive overlap with the query.
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { ActionCtx } from "../_generated/server";
import { extractAllCitations } from "../lib/citation";
import { embedWithInfo, Embedder, MIN_VECTOR_SCORE } from "../lib/embeddings";

const RRF_K = 60;
const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "from", "under", "was", "were", "are", "has", "have", "not",
  "what", "when", "which", "who", "whether", "can", "case", "law", "act", "court", "claim", "issue", "client",
  "does", "how", "any", "there", "should", "would", "could", "about", "into", "they", "them", "their",
]);

export interface Authority {
  caseName: string;
  citationString: string;
  sourceUrl?: string;
  corpusDocumentId?: string;
  relevancePassage: string;
  matchMethod: string;
}

export interface Retrieval {
  authorities: Authority[];
  embedder: Embedder;
  fabricationRate: number;
  droppedCount: number;
}

export async function hybridRetrieve(ctx: ActionCtx, query: string, topK = 6): Promise<Retrieval> {
  const { vectors, embedder } = await embedWithInfo([query]);
  const vhits = await ctx.vectorSearch("corpusChunks", "by_embedding", {
    vector: vectors[0],
    limit: topK * 2,
    filter: (q) => q.eq("embedder", embedder),
  });
  const vranked = vhits.filter((h) => h._score >= MIN_VECTOR_SCORE[embedder]).map((h) => h._id as string);
  const lranked: string[] = await ctx.runQuery(internal.research.lexicalChunks, { query, limit: topK * 2 });
  const fused = new Map<string, number>();
  vranked.forEach((id, r) => fused.set(id, (fused.get(id) ?? 0) + 1 / (RRF_K + r + 1)));
  lranked.forEach((id, r) => fused.set(id, (fused.get(id) ?? 0) + 1 / (RRF_K + r + 1)));
  // Precision over recall: chunks found by BOTH signals are strong; single-signal chunks only
  // fill up to MIN_SINGLE so a weak lexical overlap ("compensation") can't pad the result.
  const vset = new Set(vranked);
  const lset = new Set(lranked);
  const MIN_SINGLE = 3;
  const ordered = [...fused.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const both = ordered.filter((id) => vset.has(id) && lset.has(id));
  const single = ordered.filter((id) => !(vset.has(id) && lset.has(id)));
  const ids = [...both, ...single.slice(0, Math.max(0, MIN_SINGLE - both.length))]
    .slice(0, topK)
    .map((id) => id as Id<"corpusChunks">);
  const { authorities: retrieved, passages } = await ctx.runQuery(internal.research.retrievedAuthorities, { ids });

  // Inline cross-citations in retrieved text are candidate authorities; verify them.
  const inlineCandidates: { caseName: string; citationString: string; relevancePassage: string }[] = [];
  for (const p of passages) {
    for (const pc of extractAllCitations(p)) {
      inlineCandidates.push({ caseName: "", citationString: pc.raw, relevancePassage: p.slice(0, 400) });
    }
  }
  const vres = await ctx.runQuery(internal.verify.verifyCitations, { candidates: inlineCandidates });

  const merged = new Map<string, Authority>();
  for (const a of retrieved) {
    merged.set(a.documentId, {
      caseName: a.caseName,
      citationString: a.citation,
      sourceUrl: a.sourceUrl ?? undefined,
      corpusDocumentId: a.documentId,
      relevancePassage: a.passage,
      matchMethod: "retrieval",
    });
  }
  for (const v of vres.verified) {
    if (!merged.has(v.corpusDocumentId)) {
      merged.set(v.corpusDocumentId, {
        caseName: v.caseName,
        citationString: v.citationString,
        sourceUrl: v.sourceUrl ?? undefined,
        corpusDocumentId: v.corpusDocumentId,
        relevancePassage: v.relevancePassage,
        matchMethod: v.matchMethod,
      });
    }
  }

  // Re-rank: IDF-weighted coverage of the query's terms in each candidate. Terms present in every
  // candidate carry ~no weight, so a candidate survives only on distinctive overlap. Keeps those
  // within 45% of the best.
  const qTerms = [...new Set((query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((t) => !STOP.has(t)))];
  const cands = [...merged.values()];
  const has = cands.map((a) => {
    const text = `${a.caseName} ${a.relevancePassage}`.toLowerCase();
    return new Set(qTerms.filter((t) => text.includes(t.length > 5 ? t.slice(0, t.length - 2) : t)));
  });
  const idf = new Map(qTerms.map((t) => [t, Math.log(1 + cands.length / (1 + has.filter((h) => h.has(t)).length))]));
  const scored = cands.map((a, i) => ({ a, score: [...has[i]].reduce((s, t) => s + (idf.get(t) ?? 0), 0) }));
  const best = Math.max(0, ...scored.map((x) => x.score));
  const kept = best > 0 ? scored.filter((x) => x.score >= best * 0.45).sort((x, y) => y.score - x.score).map((x) => x.a) : [];

  return { authorities: kept, embedder, fabricationRate: vres.fabricationRate, droppedCount: vres.droppedCount };
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}
