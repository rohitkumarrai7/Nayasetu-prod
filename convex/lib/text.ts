// Small text utilities: fuzzy similarity (for case-name matching), keyword extraction,
// and a cheap passage-grounding check used by the citation verifier.

// Sørensen–Dice coefficient over character bigrams. Range [0,1]; stable and cheap.
export function similarity(a: string, b: string): number {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const bigrams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      m.set(bg, (m.get(bg) ?? 0) + 1);
    }
    return m;
  };
  const ma = bigrams(x);
  const mb = bigrams(y);
  let overlap = 0;
  let total = 0;
  for (const c of ma.values()) total += c;
  for (const [bg, c] of mb) {
    total += c;
    const av = ma.get(bg) ?? 0;
    overlap += Math.min(av, c);
  }
  return (2 * overlap) / total;
}

const STOP = new Set([
  "the", "a", "an", "of", "to", "in", "on", "for", "and", "or", "is", "are", "was", "were",
  "with", "his", "her", "he", "she", "it", "that", "this", "by", "as", "at",
]);

export function keywords(text: string, k = 8): string[] {
  const counts = new Map<string, number>();
  for (const w of text.toLowerCase().match(/[a-z]{3,}/g) ?? []) {
    if (!STOP.has(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([w]) => w);
}

// True if the passage's salient words occur in the source document (cheap grounding check).
export function passageSupported(passage: string, docText: string, minRatio = 0.6): boolean {
  if (!passage) return true;
  const docLower = docText.toLowerCase();
  const words = passage.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
  if (words.length === 0) return true;
  const hits = words.filter((w) => docLower.includes(w)).length;
  return hits / words.length >= minRatio;
}

/** First sentences of a passage, up to ~maxChars — a grounded, no-LLM summary. */
// Disclaimers / provenance notes are not content — never let them BE the summary.
const BOILERPLATE = /^(editorial summary|verify against|digitally signed|page \d+ of \d+|reportable|non-reportable)/i;

export function extractiveSummary(passage: string, maxChars = 360): string {
  const clean = passage.replace(/\s+/g, " ").trim();
  // Split on sentence ends, but not after common legal abbreviations (Co. Ltd. v. Dr. No. etc.).
  const protectedText = clean.replace(/\b(Co|Ltd|Pvt|vs?|Dr|Mr|Mrs|Ms|No|Nos|Art|Sec|Ss|Hon'?ble|Corpn|Govt|St|Jr|Sr|[A-Z])\./g, "$1\u0000");
  const sentences = (protectedText.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [protectedText])
    .map((x) => x.replace(/\u0000/g, ".").trim())
    .filter((x) => x && !BOILERPLATE.test(x));
  if (sentences.length === 0) return clean.slice(0, maxChars).trim();
  let out = "";
  for (const sentence of sentences) {
    if (out && (out + " " + sentence).length > maxChars) break;
    out = out ? `${out} ${sentence}` : sentence;
  }
  return out.length > maxChars ? `${out.slice(0, maxChars - 1).trimEnd()}…` : out;
}
