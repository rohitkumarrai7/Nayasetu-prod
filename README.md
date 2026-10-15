# NyayaSetu (LexSynq)

Indian Legal Intelligence + Practice Management + Lawyer–Citizen Marketplace.
**One monorepo. Convex backend (DB + vector search + auth + file storage + cron — no Docker) +
Next.js frontend on Vercel.**

> Promise to the lawyer: *from a client's raw problem to a research-backed draft without opening a
> law book* — and every citation is verified against the corpus before it's shown.

## Stack

| Layer | Tech | Notes |
|---|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + Tailwind | Deploys to Vercel |
| Backend | **Convex** (`convex/`) | Reactive DB, **native vector search**, auth, file storage, scheduler — all TypeScript, no Docker |
| Auth | Convex Auth (email + password) | Client-side; no third-party provider |
| LLM | **Groq** (primary, no training) → Gemini (paid/free per §6) → grounded offline echo | Sensitivity-aware routing |
| Embeddings | Gemini `text-embedding-004` (768-dim) → deterministic dev embedder | Vector index in Convex |

## The one flow (works end-to-end)

```
INTAKE  →  RESEARCH  →  DRAFT
```

Intake picks a category/sub-category and shows a **path-specific document checklist**; research
retrieves from the grounded judgment corpus (Convex vector search), **verifies every citation**,
and assembles a brief with a measured `fabricationRate`; drafting generates a first-draft legal
document grounded only in the verified authorities.

## Layout

```
convex/                 Convex backend (the differentiator)
  schema.ts             tables + vector index + citation index + search index
  auth.ts, http.ts      Convex Auth (email/password)
  lib/                  PORTED, unit-tested logic:
    clean.ts            denoise (OCR artifacts, headers/footers, page numbers, boilerplate)
    citation.ts         parse/normalize SCC/AIR/SCR/SCC-OnLine/INSC parallel citations
    chunk.ts            paragraph-aware overlapping chunks + dedup
    embeddings.ts       Gemini | deterministic dev embedder
    llm.ts              sensitivity-aware routing (privileged ⇏ training endpoint)
    pii.ts              PII redaction before free-tier calls (DPDP §9.2)
    text.ts, taxonomy.ts, constants.ts, demoData.ts
  model/                access.ts (tenant guards), corpus.ts (store + resolvers)
  ingest.ts             clean→quality-gate→dedup→chunk→embed→store (idempotent)
  ingestBulk.ts         FREE, scalable, resumable bulk ingestion (see below)
  verify.ts             deterministic citation verifier (drops unresolved; fabricationRate)
  research.ts           vector search → verify → grounded brief
  drafting.ts           grounded first-draft generation
  crm.ts, firms.ts, intake.ts, citizen.ts, marketplace.ts, seed.ts
  *.test.ts             78 tests (pure logic + in-process Convex integration)
app/                    Next.js frontend (landing, auth, dashboard, matter, citizen, marketplace)
components/             Nav, AuthForm
```

## Deploy checklist (fixes the current production issues)

Run these from the repo root, logged in to Convex (`npx convex login`). Order matters.

```bash
npm ci
npx convex deploy                                  # 1. push schema + functions (typechecked)
node scripts/setup-auth.mjs --prod --site https://nayasetu-prod.vercel.app
                                                   # 2. JWT keys — without this, sign-up fails
npx convex env set --prod ADMIN_EMAILS "you@example.com"   # 3. who can approve advocates
npx convex env set --prod GROQ_API_KEY <key>       # 4. optional: LLM (the app works without it)
npx convex env set --prod GEMINI_API_KEY <AIza…>   #    optional: embeddings
```

5. **Vercel → Settings → Environment Variables:**
   `NEXT_PUBLIC_CONVEX_URL = https://usable-horse-818.convex.cloud` (your prod deployment URL),
   then **redeploy** — `NEXT_PUBLIC_*` values are baked in at build time.
6. Sign up with the `ADMIN_EMAILS` address → `/admin` appears in the nav.
7. Workspace → **Load demo judgment corpus**; Advocates → **Load sample advocates** (demo only).
8. If you add or change `GEMINI_API_KEY` later: `/admin` → **Re-index corpus** (vectors from
   different embedders are not comparable; until re-indexed, lexical search still finds results).

**Diagnosing the chatbot:** it no longer needs an LLM — without one it answers from the built-in
triage rules (`source: "rules"`). If you set a key and replies still say `rules`, open the Convex
dashboard → Logs and look for `[llm] provider groq failed: …` (bad key, wrong model, 429).

### Local development

```bash
cp .env.example .env.local   # NEXT_PUBLIC_CONVEX_URL = your dev deployment
npx convex dev               # in one terminal
node scripts/setup-auth.mjs  # once per dev deployment
npm run dev:web              # http://localhost:3000
```

### Quality gates

```bash
npm run check   # typecheck (web + Convex) + 78 unit/integration tests + next build
E2E_CONVEX_URL=http://127.0.0.1:3210 npm run e2e   # ~37 end-to-end checks, THROWAWAY backend only
```

`next build` deliberately does not typecheck Convex functions (separate runtime); `convex deploy`
and `npm run typecheck:convex` do.

## Bringing all the cases in — the free, scalable path (§5 rethink)

**Indian Kanoon's API is paid per-call, so it is NOT the bulk path.** The corpus is populated from
**free public-record bulk dumps** (eCourts / OpenJustice High Court + Supreme Court judgments) and
permissively-licensed Hugging Face Indian-judgment datasets, exported to sharded NDJSON. The
`ingestBulk` action ingests one bounded batch per invocation and **self-schedules the next**, so it
is resumable, idempotent, and stays within Convex limits at any scale:

```ts
// from an authenticated client / the Convex dashboard:
await ingestBulk({
  source: "openjustice-hc",
  shardUrls: ["https://…/hc-2024-shard-0.ndjson", "https://…/hc-2024-shard-1.ndjson", …],
  batchSize: 100,
});
```

Indian Kanoon's paid API remains an **optional on-demand top-up** for freshness, not the bulk path.
Note: ingesting the entire national corpus (tens of millions of judgments) is a background job
measured in storage cost and time — the pipeline is built to scale to it, batch by batch.

## Live legal updates & real-time sync (Lexology-style)

`/updates` is a filterable feed of **new judgments, enacted legislation, and legal news** by
practice area and jurisdiction. It's populated by a **Convex cron** (`convex/crons.ts`, every 6h —
tighten for closer to real-time) that runs `updates.syncFromFeeds`, pulling from sources you
configure via env (no code change to add a country's feeds):

```bash
npx convex env set UPDATE_JSON_FEEDS "https://…/sc-latest.json,https://…/gazette.json"
npx convex env set UPDATE_RSS_FEEDS  "https://…/court-rss.xml,https://…/pib-rss.xml"
```

Each item is deduped and idempotent. With no feeds configured the cron is a graceful no-op; a
`seedDemoUpdates` mutation loads sample items so the feed is never empty. **Enacted legislation**
(Acts/amendments) is ingested as `docType: "statute"` through the same pipeline, so research grounds
on statutes as well as judgments. This is what makes it a product that tracks the law as it
changes, not a static demo.

## Compliance enforced in code

- **Citation verification (§9.3):** authorities are grounded by retrieval; any inline citation is
  resolved against the corpus before display; unresolved ones are **dropped**; `fabricationRate` is
  surfaced in the UI and gated in tests.
- **Sensitivity routing (§6):** privileged requests cannot reach a training-enabled endpoint
  (enforced + unit-tested). Groq (no training on API data) is the primary provider.
- **PII redaction (§9.2):** citizen questions are redacted before the free-tier call.
- **Tenant isolation (§9.4):** every firm-scoped function goes through an access guard; verified by
  an in-process test that another firm cannot read a matter.
- **BCI Rule 36 (§9.1):** directory is search/filter only (no ranking), citizen-initiated booking,
  flat listing fee (no commission) — see `convex/marketplace.ts`.

See `THIRD_PARTY.md` for licenses (MIT/Apache/BSD only; no AGPL; ILDC dataset excluded).
