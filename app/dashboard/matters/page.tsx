"use client";

import { useMutation, useQuery } from "convex/react";
import { Briefcase, Check, ChevronRight, ClipboardList, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import AppShell, { PageHeader, useWorkspace } from "@/components/AppShell";
import { Empty, StatusPill } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { CATEGORY_LABEL, errMsg, timeAgo } from "@/lib/client";

const FILTERS = ["all", "intake", "research", "drafting", "active", "closed"] as const;

export default function MattersPage() {
  return (
    <AppShell>
      <Suspense>
        <Matters />
      </Suspense>
    </AppShell>
  );
}

function Matters() {
  const ws = useWorkspace();
  const params = useSearchParams();
  const router = useRouter();
  const matters = useQuery(api.crm.listMatters, { firmId: ws.firmId });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [q, setQ] = useState("");
  const showNew = params.get("new") === "1";
  const setNew = (on: boolean) => router.replace(on ? "/dashboard/matters?new=1" : "/dashboard/matters");

  const rows = useMemo(
    () =>
      (matters ?? []).filter(
        (m) =>
          (filter === "all" || m.status === filter) &&
          (!q.trim() || `${m.title} ${m.clientName} ${CATEGORY_LABEL[m.category] ?? ""}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [matters, filter, q],
  );

  return (
    <>
      <PageHeader
        eyebrow="Practice"
        title="Matters"
        subtitle="Every matter moves Intake → Research → Draft. Leads you accept land here automatically."
        actions={<button className="btn" onClick={() => setNew(true)}><Plus className="h-4 w-4" /> New matter</button>}
      />
      {showNew && <IntakeWizard onClose={() => setNew(false)} />}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`chip capitalize ${filter === f ? "chip-on" : ""}`}>
            {f}
            {matters && <span className="opacity-70">{f === "all" ? matters.length : matters.filter((m) => m.status === f).length}</span>}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input className="input pl-9" placeholder="Search matters or clients" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="card-flat overflow-hidden">
        {matters === undefined ? (
          <div className="space-y-2 p-4"><div className="skeleton h-12" /><div className="skeleton h-12" /><div className="skeleton h-12" /></div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <Empty
              icon={Briefcase}
              title={matters.length ? "Nothing matches" : "No matters yet"}
              text={matters.length ? "Try another filter." : "Open one with guided intake, or accept a client lead."}
              action={!matters.length && <button className="btn btn-sm" onClick={() => setNew(true)}><Plus className="h-3.5 w-3.5" /> New matter</button>}
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((m) => (
              <li key={m._id}>
                <Link href={`/dashboard/matter/${m._id}`} className="flex items-center gap-4 px-4 py-3.5 transition hover:bg-paper/70">
                  <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand sm:flex"><Briefcase className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{m.title}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {m.clientName} · {CATEGORY_LABEL[m.category] ?? m.category} · opened {timeAgo(m._creationTime)}
                      {m.sourceLeadId && <span className="ml-1 text-emerald-700">· from citizen lead</span>}
                    </p>
                  </div>
                  <StatusPill status={m.status} />
                  <ChevronRight className="h-4 w-4 text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function IntakeWizard({ onClose }: { onClose: () => void }) {
  const ws = useWorkspace();
  const router = useRouter();
  const taxonomy = useQuery(api.intake.taxonomy);
  const clients = useQuery(api.crm.listClients, { firmId: ws.firmId });
  const createClient = useMutation(api.crm.createClient);
  const createMatter = useMutation(api.crm.createMatter);
  const [clientId, setClientId] = useState("");
  const [newClient, setNewClient] = useState({ name: "", phone: "" });
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const checklist = useQuery(api.intake.checklist, category && subcategory ? { category, subcategory } : "skip");
  const cat = taxonomy?.find((c) => c.key === category);
  const addingClient = clientId === "__new" || (clients !== undefined && clients.length === 0);

  async function submit() {
    setError(null);
    if (!category || !subcategory) return setError("Pick the area of law and the type of matter.");
    if (addingClient && !newClient.name.trim()) return setError("Enter the client's name.");
    if (!addingClient && !clientId) return setError("Pick a client.");
    setBusy(true);
    try {
      const cid = addingClient
        ? await createClient({ firmId: ws.firmId, name: newClient.name.trim(), phone: newClient.phone.trim() || undefined })
        : (clientId as Id<"clients">);
      const sub = cat?.subcategories.find((s) => s.key === subcategory);
      const id = await createMatter({
        firmId: ws.firmId,
        clientId: cid,
        title: title.trim() || `${sub?.label ?? cat?.label ?? "New"} matter`,
        category,
        subcategory,
        summaryText: summary.trim(),
      });
      router.push(`/dashboard/matter/${id}`);
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  }

  return (
    <section className="card mb-6 p-0 animate-fade-up">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-saffron-700" />
          <h2 className="font-semibold">Guided intake</h2>
        </div>
        <button className="rounded-lg p-1 text-ink-muted hover:bg-paper-dark" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="label">1 · Client</label>
            {!addingClient ? (
              <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Select client…</option>
                {clients?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                <option value="__new">+ Add a new client</option>
              </select>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <input className="input" placeholder="Client name" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} />
                <input className="input" placeholder="Phone (optional)" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
                {clients && clients.length > 0 && (
                  <button className="col-span-2 text-left text-xs text-brand hover:underline" onClick={() => setClientId("")}>← Pick an existing client</button>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="label">2 · Area of law</label>
            <div className="flex flex-wrap gap-1.5">
              {taxonomy?.map((c) => (
                <button key={c.key} type="button" onClick={() => { setCategory(c.key); setSubcategory(""); }} className={`chip ${category === c.key ? "chip-on" : ""}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          {cat && (
            <div>
              <label className="label">3 · Type of matter</label>
              <div className="space-y-1.5">
                {cat.subcategories.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSubcategory(s.key)}
                    className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${subcategory === s.key ? "border-brand bg-brand-50 text-brand" : "border-line bg-white text-ink-soft hover:border-brand/30"}`}
                  >
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${subcategory === s.key ? "border-brand bg-brand text-white" : "border-line"}`}>
                      {subcategory === s.key && <Check className="h-3 w-3" />}
                    </span>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="label">4 · Title & facts</label>
            <input className="input" placeholder="Matter title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="input mt-2" rows={5} placeholder="Fact summary — dates, parties, amounts, what the client wants (~300 words)" value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>
        </div>
        <div className="rounded-2xl bg-paper p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Path-specific checklist</p>
          {!checklist ? (
            <p className="mt-2 text-sm text-ink-muted">Pick the area of law and type of matter to see the documents to collect from the client.</p>
          ) : (
            <>
              <p className="mt-1 font-serif text-lg font-semibold">{checklist.label}</p>
              <ul className="mt-3 space-y-2">
                {checklist.checklist.map((d) => (
                  <li key={d} className="flex gap-2 text-sm text-ink-soft"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-saffron" />{d}</li>
                ))}
              </ul>
              {checklist.suggestedDocTypes?.length > 0 && (
                <p className="mt-4 text-xs text-ink-muted">Typical drafts: {checklist.suggestedDocTypes.map((d) => d.replace(/_/g, " ")).join(", ")}</p>
              )}
            </>
          )}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
        {error && <p className="mr-auto text-sm text-red-600">{error}</p>}
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn" disabled={busy} onClick={() => void submit()}>{busy ? "Creating…" : "Create matter →"}</button>
      </div>
    </section>
  );
}
