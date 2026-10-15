// Answer guard for generated legal text (PRD §9 "drop-not-flag").
//
// An LLM answer may only rely on authorities that were retrieved from the corpus. Before an answer
// is shown we:
//   1. find every case name ("A v. B") and reporter citation ("(2004) 3 SCC 297") it mentions,
//   2. resolve each against the retrieved sources (and, by the caller, the corpus),
//   3. DROP every sentence that relies on an unresolved authority, and
//   4. strip [n] source markers that point at no source.
// Pure functions only — the corpus lookup is injected by the caller so this stays unit-testable.
import { extractAllCitations } from "./citation";
import { similarity } from "./text";

// Abbreviations whose trailing "." must not end a sentence (case names are full of them).
const ABBREV = /\b(?:Co|Ltd|Pvt|Corp|Inc|Bros|Mfg|Dr|Mr|Mrs|Ms|Smt|Shri|Sri|Sh|Sr|Jr|St|Govt|Adv|No|Nos|Sec|Secs|Art|Arts|Ch|Cl|Vol|Para|Paras|Ors|Anr|Etc|vs|v|i\.e|e\.g|viz|cf|Hon|Ltd|U\.P|M\.P|A\.P|W\.B|J|JJ|CJ|CJI)\.(?=\s)/g;
const INITIAL = /\b([A-Z])\.(?=\s?[A-Z])/g;
const DOT = "․"; // one-dot leader, visually identical, restored afterwards

function protect(text: string): string {
  return text.replace(ABBREV, (m) => m.slice(0, -1) + DOT).replace(INITIAL, `$1${DOT}`);
}
function restore(text: string): string {
  return text.split(DOT).join(".");
}

const GENERIC_PARTY = new Set([
  "plaintiff", "defendant", "petitioner", "respondent", "appellant", "accused", "complainant", "claimant",
  "opposite", "party", "the", "state", "union", "of", "india", "and", "others", "ors", "anr", "another",
  "insurer", "insured", "owner", "employer", "employee", "landlord", "tenant", "husband", "wife",
]);

// "<Party> v. <Party>" — each party 1–8 capitalised-ish tokens (allowing "of", "&", "and", initials).
const PARTY = String.raw`(?:[A-Z][\w'’.&()-]*)(?:\s+(?:[A-Z][\w'’.&()-]*|of|and|&|the|for|de|da|bin|ur))*`;
const CASE_RE = new RegExp(String.raw`(${PARTY})\s+(?:v|vs|versus)\.?\s+(${PARTY})`, "g");

export interface CaseMention {
  raw: string;
  name: string;
}

function trimParty(p: string, fromEnd: boolean): string {
  const words = p.trim().split(/\s+/);
  // Party names in prose are usually short; keep the words nearest to "v."
  const kept = fromEnd ? words.slice(-6) : words.slice(0, 7);
  // drop leading/trailing connector words
  while (kept.length && /^(of|and|&|the|for|in|In|See|see|As|as|held|Held)$/.test(kept[0])) kept.shift();
  while (kept.length && /^(of|and|&|the|for|in)$/.test(kept[kept.length - 1])) kept.pop();
  return kept.join(" ").replace(/[,;:]+$/, "");
}

export function extractCaseNames(text: string): CaseMention[] {
  const out: CaseMention[] = [];
  const seen = new Set<string>();
  const t = restore(text);
  for (const m of t.matchAll(CASE_RE)) {
    const left = trimParty(m[1], true);
    const right = trimParty(m[2], false).replace(/\s*\(.*$/, "");
    if (!left || !right) continue;
    const words = `${left} ${right}`.toLowerCase().match(/[a-z]+/g) ?? [];
    if (words.every((w) => GENERIC_PARTY.has(w))) continue; // "Plaintiff v. Defendant"
    const name = `${left} v. ${right}`;
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ raw: m[0], name });
  }
  return out;
}

/** True when `name` plausibly refers to one of the known case names. */
export function nameMatches(name: string, known: string[]): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/\b(the|ltd|limited|co|company|pvt|private|and|ors|anr|others|another)\b|[.,&']/g, " ").replace(/\s+/g, " ").trim();
  const n = norm(name);
  return known.some((k) => {
    const kn = norm(k);
    if (similarity(n, kn) >= 0.72) return true;
    // Short-form references: "Swaran Singh" for "National Insurance Co. Ltd. v. Swaran Singh".
    const [l, r] = n.split(/\s+v\s+/);
    const [kl, kr] = kn.split(/\s+v\s+/);
    if (!l || !r || !kl || !kr) return false;
    return (kl.includes(l) || l.includes(kl) || similarity(l, kl) >= 0.7) && (kr.includes(r) || r.includes(kr) || similarity(r, kr) >= 0.7);
  });
}

export interface GuardInput {
  answer: string;
  sourceCount: number;
  /** Case names of the retrieved sources (always allowed). */
  sourceCaseNames: string[];
  /** Canonical citation keys of the retrieved sources (always allowed). */
  sourceCitationKeys: string[];
  /** Case names the caller resolved against the corpus. */
  corpusCaseNames?: string[];
  /** Canonical citation keys the caller resolved against the corpus. */
  corpusCitationKeys?: string[];
}

export interface GuardResult {
  text: string;
  removed: string[]; // the unverified authorities that caused a drop
  checked: number; // authorities examined
}

/** Authorities an answer mentions — so the caller can resolve them against the corpus. */
export function mentionedAuthorities(answer: string): { caseNames: string[]; citations: { raw: string; key: string }[] } {
  return {
    caseNames: extractCaseNames(answer).map((c) => c.name),
    citations: extractAllCitations(answer).map((c) => ({ raw: c.raw, key: c.canonical })),
  };
}

export function guardAnswer(input: GuardInput): GuardResult {
  const knownNames = [...input.sourceCaseNames, ...(input.corpusCaseNames ?? [])];
  const knownKeys = new Set([...input.sourceCitationKeys, ...(input.corpusCitationKeys ?? [])]);
  const removed: string[] = [];
  let checked = 0;

  const badInSentence = (sentence: string): string | null => {
    for (const c of extractAllCitations(sentence)) {
      checked++;
      if (!knownKeys.has(c.canonical)) return c.raw;
    }
    for (const c of extractCaseNames(sentence)) {
      checked++;
      if (!nameMatches(c.name, knownNames)) return c.name;
    }
    return null;
  };

  // Some models emit 【2】 / 【2†source】 or [1, 2] — normalise to [2] / [1][2].
  const normalized = input.answer
    .replace(/【\s*(\d{1,2})(?:†[^】]*)?\s*】/g, "[$1]")
    .replace(/\[(\d{1,2}(?:\s*,\s*\d{1,2})+)\]/g, (_m, list: string) => list.split(/\s*,\s*/).map((n) => `[${n}]`).join(""));
  const lines = protect(normalized).split("\n");
  const outLines: string[] = [];
  for (const line of lines) {
    const sentences = line.split(/(?<=[.!?])\s+(?=[A-Z(\["*_])/);
    const kept: string[] = [];
    for (const s of sentences) {
      const bad = badInSentence(restore(s));
      if (bad) removed.push(bad);
      else kept.push(s);
    }
    const joined = kept.join(" ");
    // A list item / heading whose whole content was dropped disappears entirely.
    if (sentences.some((s) => s.trim()) && !joined.trim()) continue;
    if (/^\s*(?:[-*]|\d+[.)])\s*$/.test(joined)) continue;
    outLines.push(joined);
  }
  let text = restore(outLines.join("\n"));
  // Strip [n] markers that point to no source (e.g. [7] when there are 3 sources).
  text = text.replace(/\[(\d{1,2})\]/g, (m, n) => (Number(n) >= 1 && Number(n) <= input.sourceCount ? m : ""));
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return { text, removed: [...new Set(removed)], checked };
}
