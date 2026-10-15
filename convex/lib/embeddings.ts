// Embeddings: Gemini when GEMINI_API_KEY is set, else a deterministic hashing embedder so the
// vector index is populated and retrieval is meaningful without any API key (dev/CI).
import { EMBEDDING_DIM } from "./constants";

const TOKEN = /[a-z0-9]+/g;

// Deterministic bag-of-hashed-tokens, L2-normalized. Identical text -> identical vector.
export function fakeEmbed(text: string, dim = EMBEDDING_DIM): number[] {
  const v = new Array(dim).fill(0);
  const lower = text.toLowerCase();
  let m: RegExpExecArray | null;
  while ((m = TOKEN.exec(lower)) !== null) {
    const tok = m[0];
    let h = 2166136261;
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % dim;
    const sign = (h & 1) === 0 ? 1 : -1;
    v[idx] += sign;
  }
  let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

function l2normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export type Embedder = "gemini" | "hash";

/** Minimum cosine score for a vector hit to count as relevant, per embedder. */
export const MIN_VECTOR_SCORE: Record<Embedder, number> = { gemini: 0.55, hash: 0.08 };

const GEMINI_BATCH = 100; // batchEmbedContents accepts at most 100 requests per call

async function geminiEmbedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  // gemini-embedding-001 defaults to 3072 dims; we request outputDimensionality=EMBEDDING_DIM
  // (768) to match the vector index, and L2-normalize (reduced dims aren't auto-normalized) so
  // cosine similarity is correct.
  const model = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents`;
  const body = {
    requests: texts.map((t) => ({
      model: `models/${model}`,
      content: { parts: [{ text: t.slice(0, 8000) }] },
      outputDimensionality: EMBEDDING_DIM,
    })),
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`gemini embed failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { embeddings: { values: number[] }[] };
    const out = data.embeddings.map((e) => l2normalize(e.values));
    if (out.length !== texts.length || out.some((v) => v.length !== EMBEDDING_DIM)) {
      throw new Error("gemini embed: unexpected shape");
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Embed texts with ONE embedder for the whole batch (never a mix), and report which one was used.
 * Vectors from different embedders live in different spaces, so callers store/filter by
 * `embedder` to keep retrieval meaningful even when the Gemini key is missing or failing.
 */
export async function embedWithInfo(texts: string[]): Promise<{ vectors: number[][]; embedder: Embedder }> {
  const key = process.env.GEMINI_API_KEY || process.env.GEMINI_PAID_API_KEY;
  if (key && texts.length > 0) {
    try {
      const vectors: number[][] = [];
      for (let i = 0; i < texts.length; i += GEMINI_BATCH) {
        vectors.push(...(await geminiEmbedBatch(texts.slice(i, i + GEMINI_BATCH), key)));
      }
      return { vectors, embedder: "gemini" };
    } catch (e) {
      console.warn(`[embeddings] gemini failed, using deterministic embedder: ${String(e).slice(0, 200)}`);
    }
  }
  return { vectors: texts.map((t) => fakeEmbed(t)), embedder: "hash" };
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  return (await embedWithInfo(texts)).vectors;
}

export async function embedOne(text: string): Promise<number[]> {
  return (await embedTexts([text]))[0];
}
