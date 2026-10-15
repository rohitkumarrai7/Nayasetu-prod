"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import Nav, { Footer } from "@/components/Nav";

const KINDS = [
  { key: "", label: "All" },
  { key: "judgment", label: "Judgments" },
  { key: "legislation", label: "Legislation" },
  { key: "news", label: "News" },
];

function timeAgo(ms: number) {
  const d = Math.floor((Date.now() - ms) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

export default function UpdatesPage() {
  const [kind, setKind] = useState("");
  const [area, setArea] = useState("");
  const items = useQuery(api.updates.feed, {
    kind: (kind || undefined) as any,
    practiceArea: area || undefined,
  });
  const areas = useQuery(api.updates.practiceAreas);
  const seed = useMutation(api.updates.seedDemoUpdates);

  return (
    <>
      <Nav />
      <main className="mx-auto min-h-[70vh] max-w-4xl px-4 py-10">
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow">Knowledge</p>
            <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">Legal updates</h1>
            <p className="mt-1 text-sm text-ink-muted">
              New judgments, enacted legislation and legal news — synced on a schedule and filtered
              by practice area.
            </p>
          </div>
          {items && items.length === 0 && (
            <button className="btn-ghost" onClick={() => void seed()}>
              Load sample updates
            </button>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {KINDS.map((k) => (
            <button
              key={k.key}
              onClick={() => setKind(k.key)}
              className={`chip ${kind === k.key ? "chip-on" : ""}`}
            >
              {k.label}
            </button>
          ))}
          <select className="input ml-auto max-w-[200px]" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">All practice areas</option>
            {areas?.map((a: any) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 space-y-3">
          {items === undefined && <p className="text-ink-muted">Loading…</p>}
          {items?.length === 0 && (
            <p className="text-sm text-ink-muted">
              No updates yet. Configure feed sources (UPDATE_JSON_FEEDS / UPDATE_RSS_FEEDS) or load
              the sample set.
            </p>
          )}
          {items?.map((it: any) => (
            <article key={it._id} className="card">
              <div className="mb-1 flex items-center gap-2 text-xs text-ink-muted">
                <span className={`badge capitalize ${it.kind === "judgment" ? "bg-brand-50 text-brand" : it.kind === "legislation" ? "bg-saffron-50 text-saffron-700" : ""}`}>{it.kind}</span>
                {it.jurisdiction && <span className="badge">{it.jurisdiction}</span>}
                <span>· {it.source}</span>
                <span>· {timeAgo(it.publishedAt)}</span>
              </div>
              <h2 className="font-serif text-lg font-semibold text-ink">
                {it.url ? (
                  <a href={it.url} target="_blank" rel="noreferrer" className="hover:text-brand">
                    {it.title}
                  </a>
                ) : (
                  it.title
                )}
              </h2>
              <p className="mt-1 text-sm text-ink-soft">{it.summary}</p>
              {it.practiceAreas.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {it.practiceAreas.map((a: string) => (
                    <span key={a} className="badge">
                      {a}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
