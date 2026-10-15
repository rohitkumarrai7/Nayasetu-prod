"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import AppShell, { PageHeader } from "@/components/AppShell";
import { api } from "@/convex/_generated/api";
import { errMsg } from "@/lib/client";

export default function AdminPage() {
  return (
    <AppShell>
      <Gate />
    </AppShell>
  );
}

function Gate() {
  const isAdmin = useQuery(api.admin.amIAdmin);
  if (isAdmin === undefined) return <div className="skeleton h-40" />;
  if (!isAdmin)
    return (
      <p className="card text-sm text-ink-soft">
        Platform admins only. Add your email to <code>ADMIN_EMAILS</code> on the Convex deployment
        (<code>npx convex env set ADMIN_EMAILS you@example.com</code>).
      </p>
    );
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Platform" title="Admin & trust" subtitle="BCI verification queue, trust metrics (fabrication rate, consent opt-in) and data tools." />
      <Metrics />
      <Queue />
      <Tools />
    </div>
  );
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

function Metrics() {
  const m = useQuery(api.admin.metrics);
  if (!m) return null;
  const tiles: [string, string | number][] = [
    ["Avg fabrication rate", pct(m.trust.avgFabricationRate)],
    ["Research briefs", m.trust.briefs],
    ["Citizen sessions", m.citizen.sessions],
    ["Consent opt-in", pct(m.citizen.optInRate)],
    ["Consented leads", m.citizen.consentedLeads],
    ["Lead → matter", pct(m.marketplace.leadToMatterRate)],
    ["Verified advocates", m.marketplace.verifiedListed],
    ["Pending verification", m.marketplace.pendingVerification],
  ];
  return (
    <section>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([k, v]) => (
          <div key={k} className="card p-4">
            <p className="text-2xl font-semibold">{v}</p>
            <p className="text-xs text-ink-muted">{k}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 font-semibold">Citizen demand by domain</h3>
          {m.citizen.byDomain.length === 0 && <p className="text-xs text-ink-muted">No sessions yet.</p>}
          {m.citizen.byDomain.map((d) => (
            <p key={d.domain} className="flex justify-between text-sm"><span>{d.domain}</span><span>{d.count}</span></p>
          ))}
        </div>
        <div className="card">
          <h3 className="mb-3 font-semibold">Verified advocates per district</h3>
          {m.marketplace.verifiedPerDistrict.length === 0 && <p className="text-xs text-ink-muted">None yet.</p>}
          {m.marketplace.verifiedPerDistrict.slice(0, 15).map((d) => (
            <p key={d.district} className="flex justify-between text-sm"><span>{d.district}</span><span>{d.count}</span></p>
          ))}
        </div>
      </div>
    </section>
  );
}

function Queue() {
  const [tab, setTab] = useState<"pending" | "verified" | "rejected">("pending");
  const rows = useQuery(api.admin.verificationQueue, { status: tab });
  const decide = useMutation(api.admin.decideVerification);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="font-serif text-xl font-semibold">BCI verification</h2>
        {(["pending", "verified", "rejected"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`chip capitalize ${tab === t ? "chip-on" : ""}`}>{t}</button>
        ))}
      </div>
      <p className="mb-3 text-xs text-ink-muted">
        Check each enrolment number against the State Bar Council roll before approving. Approval lists the advocate
        publicly and unlocks citizens&apos; contact details in their lead feed.
      </p>
      {error && <p className="mb-2 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {rows?.length === 0 && <p className="text-sm text-ink-muted">Nothing here.</p>}
      <div className="space-y-3">
        {rows?.map((r) => (
          <div key={r._id} className="card text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-semibold">{r.displayName} <span className="font-normal text-ink-muted">· {r.email ?? "no email"}</span></p>
                <p className="text-ink-soft">Enrolment <b>{r.bciEnrolmentNo ?? "—"}</b> · {r.enrolmentState ?? "council?"}{r.enrolmentYear ? ` · ${r.enrolmentYear}` : ""}</p>
                <p className="text-xs text-ink-muted">{r.practiceAreas.join(", ")} · {r.city ?? "no location"}</p>
                {r.homeCourts.length > 0 && <p className="text-xs text-ink-muted">Home courts: {r.homeCourts.join("; ")}</p>}
                {r.verificationNote && <p className="text-xs text-ink-muted">Note: {r.verificationNote}</p>}
              </div>
              {tab !== "verified" && (
                <div className="flex min-w-[220px] flex-col gap-2">
                  <input className="input" placeholder="Note (required to reject)" value={notes[r._id] ?? ""} onChange={(e) => setNotes({ ...notes, [r._id]: e.target.value })} />
                  <div className="flex gap-2">
                    <button className="btn bg-emerald-600 hover:bg-emerald-700" onClick={() => decide({ profileId: r._id, decision: "verified", note: notes[r._id] }).catch((e) => setError(errMsg(e)))}>Approve</button>
                    <button className="btn-ghost" onClick={() => decide({ profileId: r._id, decision: "rejected", note: notes[r._id] }).catch((e) => setError(errMsg(e)))}>Reject</button>
                  </div>
                </div>
              )}
              {tab === "verified" && (
                <button className="btn-ghost self-start" onClick={() => {
                  const note = prompt("Reason for revoking verification?");
                  if (note) decide({ profileId: r._id, decision: "rejected", note }).catch((e) => setError(errMsg(e)));
                }}>Revoke</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Tools() {
  const reindex = useAction(api.admin.reindexCorpus);
  const importCourts = useMutation(api.geo.importDistrictCourts);
  const [msg, setMsg] = useState<string | null>(null);
  const [json, setJson] = useState("");
  return (
    <section className="card space-y-4 text-sm">
      <h2 className="font-serif text-xl font-semibold">Data tools</h2>
      <div>
        <p className="font-medium">Re-index judgment corpus</p>
        <p className="text-xs text-ink-muted">Run after setting or changing GEMINI_API_KEY so every chunk is embedded by the same model as queries.</p>
        <button className="btn-ghost mt-2" onClick={async () => {
          setMsg("Re-indexing…");
          try {
            let cursor: string | null = null, total = 0;
            for (;;) {
              const r: any = await reindex({ cursor });
              total += r.reindexed;
              if (r.done) { setMsg(`Re-indexed ${total} chunks with the ${r.embedder} embedder.`); break; }
              cursor = r.cursor ?? null;
              if (!r.cursor) { setMsg(`Re-indexed ${total} chunks so far — click again to continue.`); break; }
            }
          } catch (e) { setMsg(errMsg(e)); }
        }}>Re-index corpus</button>
      </div>
      <div>
        <p className="font-medium">Import district courts</p>
        <p className="text-xs text-ink-muted">
          Paste a JSON array of {"{code, name, district, state, lat, lng}"} (e.g. from the eCourts directory). Upserts by code.
          The built-in seed of ~150 court complexes is used until you import.
        </p>
        <textarea className="input mt-2 font-mono text-xs" rows={4} value={json} onChange={(e) => setJson(e.target.value)} placeholder='[{"code":"DL-THC","name":"Tis Hazari Courts","district":"Central","state":"Delhi","lat":28.667,"lng":77.216}]' />
        <div className="mt-2 flex gap-2">
          <button className="btn-ghost" onClick={async () => {
            try { const r = await importCourts({ courts: json.trim() ? JSON.parse(json) : [], seedBuiltIns: true }); setMsg(`Courts: ${r.inserted} added, ${r.updated} updated, ${r.total} total.`); }
            catch (e) { setMsg(e instanceof SyntaxError ? "That isn't valid JSON." : errMsg(e)); }
          }}>Import (with built-in seed)</button>
        </div>
      </div>
      {msg && <p className="rounded bg-paper p-2 text-xs">{msg}</p>}
    </section>
  );
}
