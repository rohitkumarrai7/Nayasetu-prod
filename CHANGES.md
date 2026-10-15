# Changes — production fixes + PRD M2

## Production bugs fixed
| Problem | Cause | Fix |
|---|---|---|
| Chatbot gives the same canned reply; advocate/consent panels never appear | Any LLM failure (no key, bad key, 429, non-JSON) fell to an "echo" stub → category always `other` | Deterministic triage engine (`lib/legalTriage.ts`, 8 domains, Hinglish) always answers; LLM output is validated (JSON mode, 15 s timeout, bounded retries) and falls back to rules |
| Sign-up fails ("Try a different email") | Convex Auth JWT keys not set; real error hidden | `scripts/setup-auth.mjs`; auth form shows real errors |
| Site may talk to the wrong backend | Fallback URL `amiable-bloodhound-285` ≠ PRD's `usablehorse-818` | Fallback corrected + console warning; set `NEXT_PUBLIC_CONVEX_URL` |
| Anyone could write to the judgment corpus | `ingest.ingestRecords` was a public action | Now internal; only authenticated seed / bulk paths |
| Citizens' names + phones visible to any signed-in user | `chat.leads` had no role check | Replaced by `leads.feed`: area-scoped; contact only for BCI-verified advocates |
| Verified advocate could claim a lead outside their area | `accept` didn't re-check eligibility | Same home-court / radius rule as the feed |
| Demo corpus misdescribed real SC judgments | Inaccurate case summaries | Rewritten as labelled editorial summaries; search links, not guessed IDs |
| Offline research summary = just the disclaimer | Extractive summariser picked boilerplate; split on "Co. Ltd." | Skips boilerplate, abbreviation-aware |
| Open tab breaks after a Vercel redeploy | ChunkLoadError | Error boundary reloads once |
| Flaky test (real network call) | LLM test hit the network | Fetch mocked; retries bounded |

## PRD features implemented (M2 + parts of M3/M4)
- **Geo marketplace (§7):** `districtCourts` (≈150 seeded, importable), Haversine + geohash
  candidate buckets, nearest-5 home courts, radius; citizen location by city name or GPS.
- **Advocate lead feed (L7):** consented leads in home courts / radius, ranked distance → recency →
  practice area; accept → client + matter in CRM; dismiss.
- **Onboarding wizard + BCI verification (L8):** `/dashboard/profile`, enrolment format check,
  admin queue at `/admin` (approve / reject with reason).
- **Consent (C2, DPDP):** explicit checkbox, contact validation, audit log, withdrawable.
- **Verified directory (C3):** distance-ranked, neutral ordering (BCI Rule 36).
- **Analytics (L9, §15):** firm stats; admin trust + marketplace metrics.
- **Hybrid retrieval (§9):** vector (embedder-tagged) + full-text search; parallel summaries.
- **Taxonomy:** 3 → 8 domains with checklists; draft templates when no LLM.

## Not done (still roadmap)
Document upload/OCR UI (M3), web-search fallback (M3), payments (v2), e-courts live status (M4),
full ~700-court dataset import (PRD open question #1).
