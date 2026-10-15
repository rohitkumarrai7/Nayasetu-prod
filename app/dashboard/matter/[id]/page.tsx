"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { FunctionReturnType } from "convex/server";
import {
  ArrowLeft, Check, ClipboardList, Copy, Download, FileSignature, FileText, Inbox, Loader2, Mail, MessageSquarePlus, Pencil,
  Phone, Search, ShieldCheck, Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import AppShell, { useWorkspace } from "@/components/AppShell";
import Copilot from "@/components/Copilot";
import Markdown from "@/components/Markdown";
import { StatusPill } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { CATEGORY_LABEL, errMsg, timeAgo } from "@/lib/client";

const STATUSES = ["intake", "research", "drafting", "active", "closed"] as const;
const DOC_TYPES: [string, string][] = [
  ["legal_notice", "Legal notice"],
  ["demand_letter", "Demand letter"],
  ["claim_petition", "Claim petition"],
  ["consumer_complaint", "Consumer complaint"],
  ["complaint", "Complaint"],
  ["petition", "Petition"],
  ["written_statement", "Written statement"],
  ["bail_application", "Bail application"],
];
type Tab = "overview" | "research" | "draft";

export default function MatterPage() {
  return (
    <AppShell wide>
      <Suspense>
        <Matter />
      </Suspense>
    </AppShell>
  );
}

function Matter() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const matterId = params.id as Id<"matters">;
  const data = useQuery(api.crm.getMatter, { matterId });
  const checklist = useQuery(
    api.intake.checklist,
    data ? { category: data.matter.category, subcategory: data.matter.subcategory } : "skip",
  );
  const setStatus = useMutation(api.crm.updateMatterStatus);
  const tab = ((search.get("tab") as Tab) || "overview") as Tab;
  const setTab = (t: Tab) => router.replace(`/dashboard/matter/${matterId}?tab=${t}`);

  if (data === undefined) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-8 w-1/3" />
        <div className="skeleton h-40 w-full" />
      </div>
    );
  }
  const m = data.matter;
  const stepIdx = STATUSES.indexOf(m.status);

  return (
    <div>
      <Link href="/dashboard/matters" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> Matters
      </Link>
      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge bg-brand-50 text-brand">{CATEGORY_LABEL[m.category] ?? m.category}</span>
            {checklist && <span className="badge">{checklist.label}</span>}
            {m.sourceLeadId && <span className="badge bg-emerald-50 text-emerald-700"><Inbox className="h-3 w-3" /> From citizen lead</span>}
          </div>
          <TitleEditor matterId={m._id} title={m.title} />
          <p className="mt-1 text-sm text-ink-muted">{data.client?.name} · opened {timeAgo(m._creationTime)}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={m.status} />
          <select
            className="input w-auto py-1.5 text-xs"
            value={m.status}
            onChange={(e) => void setStatus({ matterId: m._id, status: e.target.value as (typeof STATUSES)[number] })}
            aria-label="Matter status"
          >
            {STATUSES.map((s) => <option key={s} value={s}>Move to {s}</option>)}
          </select>
        </div>
      </header>

      {/* Stepper */}
      <ol className="mt-5 grid grid-cols-5 gap-1.5">
        {STATUSES.map((s, i) => (
          <li key={s}>
            <div className={`h-1.5 rounded-full ${i <= stepIdx ? "bg-brand" : "bg-line"}`} />
            <p className={`mt-1.5 text-[11px] capitalize ${i === stepIdx ? "font-semibold text-brand" : "text-ink-muted"}`}>{s}</p>
          </li>
        ))}
      </ol>

      {/* Tabs */}
      <div className="mt-5 flex gap-1 border-b border-line">
        {([
          ["overview", "Overview", ClipboardList],
          ["research", "Research", Sparkles],
          ["draft", "Drafts", FileSignature],
        ] as const).map(([k, l, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === k ? "border-brand text-brand" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <Icon className="h-4 w-4" /> {l}
            {k === "research" && data.briefs.length > 0 && <span className="rounded-full bg-paper-dark px-1.5 text-[11px]">{data.briefs.length}</span>}
            {k === "draft" && data.drafts.length > 0 && <span className="rounded-full bg-paper-dark px-1.5 text-[11px]">{data.drafts.length}</span>}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && <Overview data={data} checklist={checklist ?? null} onGo={setTab} />}
        {tab === "research" && <Research matter={m} briefs={data.briefs} seed={checklist?.researchSeed ?? ""} onDraft={() => setTab("draft")} />}
        {tab === "draft" && <Drafts matter={m} briefs={data.briefs} drafts={data.drafts} suggested={checklist?.suggestedDocTypes} onResearch={() => setTab("research")} />}
      </div>
    </div>
  );
}

type MatterData = FunctionReturnType<typeof api.crm.getMatter>;
type Checklist = { label: string; checklist: string[]; suggestedDocTypes: string[]; researchSeed: string } | null;
type Brief = MatterData["briefs"][number];

function TitleEditor({ matterId, title }: { matterId: Id<"matters">; title: string }) {
  const update = useMutation(api.crm.updateMatter);
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(title);
  useEffect(() => setV(title), [title]);
  if (editing) {
    return (
      <form
        className="mt-2 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await update({ matterId, title: v });
          setEditing(false);
        }}
      >
        <input className="input font-serif text-xl" value={v} onChange={(e) => setV(e.target.value)} autoFocus />
        <button className="btn">Save</button>
      </form>
    );
  }
  return (
    <h1 className="group mt-2 flex items-center gap-2 font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
      {title}
      <button onClick={() => setEditing(true)} className="opacity-0 transition group-hover:opacity-100" aria-label="Rename matter">
        <Pencil className="h-4 w-4 text-ink-muted" />
      </button>
    </h1>
  );
}

// ── Overview ───────────────────────────────────────────────────────────────────
function Overview({ data, checklist, onGo }: { data: MatterData; checklist: Checklist; onGo: (t: Tab) => void }) {
  const m = data.matter;
  const update = useMutation(api.crm.updateMatter);
  const toggle = useMutation(api.crm.toggleChecklistItem);
  const [facts, setFacts] = useState(m.summaryText);
  const [saved, setSaved] = useState(false);
  useEffect(() => setFacts(m.summaryText), [m.summaryText]);
  const done = new Set(m.checklistDone ?? []);
  const total = checklist?.checklist.length ?? 0;
  const got = checklist?.checklist.filter((c) => done.has(c)).length ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Facts of the matter</h2>
            <span className="text-xs text-ink-muted">Privileged · used for research & drafting</span>
          </div>
          <textarea
            className="input min-h-[180px] leading-relaxed"
            value={facts}
            onChange={(e) => { setFacts(e.target.value); setSaved(false); }}
            placeholder="Dates, parties, amounts, what happened, what the client wants…"
          />
          <div className="mt-2 flex items-center gap-2">
            <button className="btn btn-sm" disabled={facts === m.summaryText} onClick={async () => { await update({ matterId: m._id, summaryText: facts }); setSaved(true); }}>
              Save facts
            </button>
            {saved && <span className="text-xs text-emerald-700">Saved</span>}
          </div>
        </section>

        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Intake checklist</h2>
            {total > 0 && <span className="text-xs text-ink-muted">{got}/{total} collected</span>}
          </div>
          {total > 0 && (
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(got / total) * 100}%` }} />
            </div>
          )}
          {!checklist ? (
            <p className="text-sm text-ink-muted">No checklist for this matter type.</p>
          ) : (
            <ul className="space-y-1">
              {checklist.checklist.map((d) => (
                <li key={d}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-paper">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-[#13305c]"
                      checked={done.has(d)}
                      onChange={(e) => void toggle({ matterId: m._id, item: d, done: e.target.checked })}
                    />
                    <span className={done.has(d) ? "text-ink-muted line-through" : "text-ink-soft"}>{d}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="space-y-6">
        <section className="card">
          <h2 className="mb-3 font-semibold">Client</h2>
          <p className="font-medium">{data.client?.name}</p>
          <div className="mt-2 space-y-1.5 text-sm">
            {data.client?.phone && <a className="flex items-center gap-2 text-brand" href={`tel:${data.client.phone}`}><Phone className="h-4 w-4" />{data.client.phone}</a>}
            {data.client?.email && <a className="flex items-center gap-2 text-brand" href={`mailto:${data.client.email}`}><Mail className="h-4 w-4" />{data.client.email}</a>}
            {data.client?.city && <p className="text-ink-muted">{data.client.city}</p>}
            {data.client?.notes && <p className="rounded-lg bg-paper p-2 text-xs text-ink-muted">{data.client.notes}</p>}
          </div>
        </section>
        <section className="card">
          <h2 className="mb-3 font-semibold">Next step</h2>
          {data.briefs.length === 0 ? (
            <>
              <p className="text-sm text-ink-muted">Research the issue. The copilot answers only from verified authorities.</p>
              <button className="btn mt-3 w-full" onClick={() => onGo("research")}><Sparkles className="h-4 w-4" /> Start research</button>
            </>
          ) : data.drafts.length === 0 ? (
            <>
              <p className="text-sm text-ink-muted">{data.briefs.length} verified brief{data.briefs.length > 1 ? "s" : ""} ready. Generate the first draft.</p>
              <button className="btn mt-3 w-full" onClick={() => onGo("draft")}><FileSignature className="h-4 w-4" /> Generate draft</button>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-muted">{data.drafts.length} draft{data.drafts.length > 1 ? "s" : ""} on file. Review the [TO CONFIRM] gaps, then file.</p>
              <button className="btn-ghost mt-3 w-full" onClick={() => onGo("draft")}>Open drafts</button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Research ──────────────────────────────────────────────────────────────────
function Research({ matter, briefs, seed, onDraft }: { matter: Doc<"matters">; briefs: Brief[]; seed: string; onDraft: () => void }) {
  const ws = useWorkspace();
  const threads = useQuery(api.copilot.threads, { matterId: matter._id });
  const [threadId, setThreadId] = useState<Id<"copilotThreads"> | null>(null);
  const [initialised, setInitialised] = useState(false);
  useEffect(() => {
    if (!initialised && threads !== undefined) {
      setThreadId(threads[0]?._id ?? null);
      setInitialised(true);
    }
  }, [threads, initialised]);

  const label = CATEGORY_LABEL[matter.category] ?? "this area";
  const suggestions = [
    seed,
    `What is the forum and limitation period for this ${label.toLowerCase()} matter?`,
    "Which verified authorities best support the client's position on these facts?",
    "What evidence must the client produce, and what are the likely defences?",
  ].filter(Boolean);

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <section className="card flex flex-col p-0 xl:col-span-2">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <Sparkles className="h-4 w-4 text-saffron-700" />
          <p className="font-semibold">Research copilot</p>
          <span className="text-xs text-ink-muted">· knows this matter&apos;s facts</span>
          <div className="ml-auto flex items-center gap-2">
            {threads && threads.length > 0 && (
              <select className="input w-auto max-w-[220px] py-1 text-xs" value={threadId ?? ""} onChange={(e) => setThreadId((e.target.value || null) as Id<"copilotThreads"> | null)}>
                <option value="">New conversation</option>
                {threads.map((t) => <option key={t._id} value={t._id}>{t.title.slice(0, 50)}</option>)}
              </select>
            )}
            <button className="btn-ghost btn-sm" onClick={() => setThreadId(null)}><MessageSquarePlus className="h-3.5 w-3.5" /> New</button>
          </div>
        </div>
        <div className="px-3 pb-3 sm:px-4">
          <Copilot key={threadId ?? "new"} compact threadId={threadId} onThread={setThreadId} matterId={matter._id} firmId={ws.firmId} suggestions={suggestions} />
        </div>
      </section>

      <div className="space-y-6">
        <QuickBrief matterId={matter._id} defaultQuery={matter.summaryText || seed} />
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Saved briefs</h2>
            {briefs.length > 0 && <button className="text-sm text-brand hover:underline" onClick={onDraft}>Draft from brief →</button>}
          </div>
          {briefs.length === 0 ? (
            <p className="text-sm text-ink-muted">Run a quick brief, or click “Save to matter” on any copilot answer. Drafts are built only from saved briefs.</p>
          ) : (
            <ul className="space-y-2">
              {briefs.map((b) => <BriefItem key={b._id} b={b} />)}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function BriefItem({ b }: { b: Brief }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-xl border border-line">
      <button onClick={() => setOpen((o) => !o)} className="w-full px-3 py-2.5 text-left">
        <p className="line-clamp-2 text-sm font-medium text-ink">{b.queryText}</p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
          <span className="text-emerald-700">✓ {b.citations.length} verified authorit{b.citations.length === 1 ? "y" : "ies"}</span>· {timeAgo(b._creationTime)}
        </p>
      </button>
      {open && (
        <div className="border-t border-line px-3 py-3">
          <Markdown text={b.body} className="text-sm" />
          {b.citations.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-line pt-2 text-xs">
              {b.citations.map((c) => (
                <li key={c._id} className="flex gap-1.5 text-ink-soft">
                  <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                  <span>{c.caseName}{c.citationString ? ` — ${c.citationString}` : ""}{c.sourceUrl && <> · <a className="text-brand underline" href={c.sourceUrl} target="_blank" rel="noreferrer">source</a></>}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function QuickBrief({ matterId, defaultQuery }: { matterId: Id<"matters">; defaultQuery: string }) {
  const run = useAction(api.research.runResearch);
  const [query, setQuery] = useState(defaultQuery);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ n: number; fab: number; dropped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setQuery((q) => q || defaultQuery), [defaultQuery]);
  return (
    <section className="card">
      <h2 className="flex items-center gap-2 font-semibold"><Search className="h-4 w-4 text-brand" /> Quick verified brief</h2>
      <p className="mt-1 text-xs text-ink-muted">One-shot: retrieve → verify → summarise each authority over its own passage. Saved to this matter.</p>
      <textarea className="input mt-3" rows={3} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="State the legal issue" />
      <button
        className="btn mt-2 w-full"
        disabled={busy || !query.trim()}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const r = await run({ matterId, query });
            setResult({ n: r.authorities.length, fab: r.fabricationRate, dropped: r.droppedCount });
          } catch (e) {
            setError(errMsg(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Researching…</> : "Run brief"}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {result && (
        <p className={`mt-2 text-xs ${result.n ? "text-emerald-700" : "text-amber-700"}`}>
          {result.n
            ? `✓ Brief saved with ${result.n} verified authorit${result.n === 1 ? "y" : "ies"}${result.dropped ? ` · ${result.dropped} unverifiable cross-citation(s) dropped` : ""}.`
            : "No authority in the corpus supports this issue — rephrase, or load the demo corpus from Overview."}
        </p>
      )}
    </section>
  );
}

// ── Drafts ────────────────────────────────────────────────────────────────────
function Drafts({
  matter, briefs, drafts, suggested, onResearch,
}: { matter: Doc<"matters">; briefs: Brief[]; drafts: Doc<"drafts">[]; suggested?: string[]; onResearch: () => void }) {
  const generate = useAction(api.drafting.generateDraft);
  const [docType, setDocType] = useState(suggested?.[0] ?? "legal_notice");
  const [facts, setFacts] = useState(matter.summaryText);
  const [briefId, setBriefId] = useState<string>(briefs[0]?._id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (suggested?.[0]) setDocType(suggested[0]); }, [suggested]);
  useEffect(() => { if (!briefId && briefs[0]) setBriefId(briefs[0]._id); }, [briefs, briefId]);

  if (briefs.length === 0) {
    return (
      <div className="card flex flex-col items-center py-12 text-center">
        <FileText className="h-8 w-8 text-ink-muted" />
        <p className="mt-3 font-semibold">Research first</p>
        <p className="mt-1 max-w-sm text-sm text-ink-muted">Drafts are grounded only in verified authorities from a saved brief, so nothing un-cited reaches a filing.</p>
        <button className="btn mt-4" onClick={onResearch}><Sparkles className="h-4 w-4" /> Go to research</button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="card h-fit lg:sticky lg:top-6">
        <h2 className="font-semibold">Generate a first draft</h2>
        <label className="label mt-4">Document</label>
        <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
          {DOC_TYPES.map(([k, l]) => <option key={k} value={k}>{l}{suggested?.includes(k) ? " (suggested)" : ""}</option>)}
        </select>
        <label className="label mt-3">Grounded in brief</label>
        <select className="input" value={briefId} onChange={(e) => setBriefId(e.target.value)}>
          {briefs.map((b) => <option key={b._id} value={b._id}>{b.queryText.slice(0, 60)} · {b.citations.length} auth.</option>)}
        </select>
        <label className="label mt-3">Key facts</label>
        <textarea className="input" rows={6} value={facts} onChange={(e) => setFacts(e.target.value)} placeholder="Dates, parties, amounts" />
        <button
          className="btn-accent mt-3 w-full"
          disabled={busy || !briefId}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await generate({ briefId: briefId as Id<"researchBriefs">, docType, facts });
            } catch (e) {
              setError(errMsg(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Drafting…</> : <><FileSignature className="h-4 w-4" /> Generate draft</>}
        </button>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <p className="mt-3 text-xs text-ink-muted">Every <b>[TO CONFIRM]</b> marks a fact or point you must fill in or check. Citations are inserted exactly as verified.</p>
      </section>
      <div className="space-y-4 lg:col-span-2">
        {drafts.length === 0 && <div className="card text-sm text-ink-muted">Your drafts will appear here.</div>}
        {drafts.map((d) => <DraftItem key={d._id} draft={d} title={matter.title} />)}
      </div>
    </div>
  );
}

function DraftItem({ draft, title }: { draft: Doc<"drafts">; title: string }) {
  const update = useMutation(api.drafting.updateDraft);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(draft.content);
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!editing) setText(draft.content); }, [draft.content, editing]);
  const gaps = (draft.content.match(/\[TO CONFIRM/g) ?? []).length;
  const name = `${draft.docType}-${new Date(draft._creationTime).toISOString().slice(0, 10)}`;

  function download(kind: "txt" | "doc") {
    const blob =
      kind === "txt"
        ? new Blob([draft.content], { type: "text/plain;charset=utf-8" })
        : new Blob(
            [
              `<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body style="font-family:'Times New Roman';font-size:12pt;line-height:1.5">` +
                draft.content.split("\n").map((l) => `<p style="margin:0 0 6pt">${escapeHtml(l) || "&nbsp;"}</p>`).join("") +
                "</body></html>",
            ],
            { type: "application/msword" },
          );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.${kind}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <article className="card p-0">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <FileText className="h-4 w-4 text-brand" />
        <p className="font-semibold capitalize">{draft.docType.replace(/_/g, " ")}</p>
        <span className="badge">{draft.status}</span>
        {gaps > 0 ? <span className="badge bg-amber-50 text-amber-800">{gaps} to confirm</span> : <span className="badge-verified"><Check className="h-3 w-3" /> No open gaps</span>}
        <span className="text-xs text-ink-muted">{timeAgo(draft._creationTime)}</span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button className="btn-ghost btn-sm" onClick={() => { void navigator.clipboard.writeText(draft.content); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy"}
          </button>
          <button className="btn-ghost btn-sm" onClick={() => download("doc")}><Download className="h-3.5 w-3.5" /> Word</button>
          <button className="btn-ghost btn-sm" onClick={() => download("txt")}>.txt</button>
          {!editing ? (
            <button className="btn btn-sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /> Edit</button>
          ) : (
            <>
              <button className="btn btn-sm" onClick={async () => { await update({ draftId: draft._id, content: text, status: "edited" }); setEditing(false); }}>Save</button>
              <button className="btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
            </>
          )}
        </div>
      </header>
      {editing ? (
        <textarea className="block min-h-[520px] w-full resize-y rounded-b-2xl border-0 bg-white p-5 font-serif text-[15px] leading-7 outline-none" value={text} onChange={(e) => setText(e.target.value)} />
      ) : (
        <div className="max-h-[640px] overflow-auto rounded-b-2xl bg-[#fffdf8] px-6 py-5">
          <pre className="whitespace-pre-wrap font-serif text-[15px] leading-7 text-ink">
            {draft.content.split(/(\[TO CONFIRM[^\]]*\])/g).map((part, i) =>
              part.startsWith("[TO CONFIRM") ? <mark key={i} className="rounded bg-amber-100 px-0.5 text-amber-900">{part}</mark> : part,
            )}
          </pre>
        </div>
      )}
    </article>
  );
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
