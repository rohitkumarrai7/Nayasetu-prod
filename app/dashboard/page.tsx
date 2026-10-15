"use client";

import { useAction, useQuery } from "convex/react";
import {
  ArrowRight, BadgeCheck, Briefcase, Database, FileSignature, Inbox, Loader2, MapPin, Plus, SearchCheck, Sparkles, Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import AppShell, { PageHeader, useWorkspace } from "@/components/AppShell";
import { api } from "@/convex/_generated/api";
import { Empty, StatusPill } from "@/components/ui";
import { errMsg, timeAgo } from "@/lib/client";

export default function Dashboard() {
  return (
    <AppShell>
      <Overview />
    </AppShell>
  );
}

function Overview() {
  const ws = useWorkspace();
  const stats = useQuery(api.analytics.firmStats, { firmId: ws.firmId });
  const matters = useQuery(api.crm.listMatters, { firmId: ws.firmId });
  const leads = useQuery(api.leads.feed, {});
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const open = stats ? stats.matters - (stats.byStatus.closed ?? 0) : null;
  const newLeads = leads?.leads.filter((l) => !l.myAction) ?? [];

  return (
    <>
      <PageHeader
        eyebrow={ws.firmName}
        title={`${greet}.`}
        subtitle="Your practice at a glance — leads near your courts, matters in flight, and verified research."
        actions={
          <>
            <Link href="/dashboard/copilot" className="btn-ghost"><Sparkles className="h-4 w-4 text-saffron-700" /> Ask copilot</Link>
            <Link href="/dashboard/matters?new=1" className="btn"><Plus className="h-4 w-4" /> New matter</Link>
          </>
        }
      />
      <ProfileBanner />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Inbox} label="New leads near you" value={leads ? newLeads.length : null} href="/dashboard/leads" accent />
        <Stat icon={Briefcase} label="Open matters" value={open} href="/dashboard/matters" />
        <Stat icon={Users} label="Clients" value={stats?.clients ?? null} href="/dashboard/clients" />
        <Stat
          icon={SearchCheck}
          label="Fabricated citations shown"
          value={stats ? "0" : null}
          hint={stats ? `${stats.briefs} brief${stats.briefs === 1 ? "" : "s"} · ${(stats.avgFabricationRate * 100).toFixed(0)}% caught & dropped` : ""}
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold">Matter pipeline</h2>
            <Link href="/dashboard/matters" className="text-sm text-brand hover:underline">All matters →</Link>
          </div>
          {stats && (
            <div className="mb-5 grid grid-cols-5 gap-1.5">
              {(["intake", "research", "drafting", "active", "closed"] as const).map((s) => (
                <div key={s} className="rounded-xl bg-paper px-2 py-2.5 text-center">
                  <p className="text-xl font-semibold text-ink">{stats.byStatus[s] ?? 0}</p>
                  <p className="text-[11px] capitalize text-ink-muted">{s}</p>
                </div>
              ))}
            </div>
          )}
          {matters === undefined ? (
            <div className="space-y-2"><div className="skeleton h-12" /><div className="skeleton h-12" /></div>
          ) : matters.length === 0 ? (
            <Empty
              icon={Briefcase}
              title="No matters yet"
              text="Accept a client lead, or open a matter with guided intake."
              action={<Link href="/dashboard/matters?new=1" className="btn btn-sm"><Plus className="h-3.5 w-3.5" /> New matter</Link>}
            />
          ) : (
            <ul className="divide-y divide-line">
              {matters.slice(0, 6).map((m) => (
                <li key={m._id}>
                  <Link href={`/dashboard/matter/${m._id}`} className="flex items-center gap-3 py-3 hover:bg-paper/60">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand"><Briefcase className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{m.title}</p>
                      <p className="truncate text-xs text-ink-muted">{m.clientName} · {timeAgo(m._creationTime)}</p>
                    </div>
                    <StatusPill status={m.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold">Leads near your courts</h2>
            <Link href="/dashboard/leads" className="text-sm text-brand hover:underline">Open feed →</Link>
          </div>
          {leads === undefined ? (
            <div className="space-y-2"><div className="skeleton h-16" /><div className="skeleton h-16" /></div>
          ) : leads.state === "needs_profile" ? (
            <Empty icon={MapPin} title="Set your office location" text="Leads are matched to your 5 nearest district courts." action={<Link href="/dashboard/profile" className="btn btn-sm">Set up profile</Link>} />
          ) : newLeads.length === 0 ? (
            <Empty icon={Inbox} title="No new leads right now" text="Consented citizens near your courts appear here live." />
          ) : (
            <ul className="space-y-2">
              {newLeads.slice(0, 4).map((l) => (
                <li key={l._id}>
                  <Link href="/dashboard/leads" className="block rounded-xl border border-line p-3 hover:border-brand/30">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="badge bg-saffron-50 text-saffron-700">{l.categoryLabel}</span>
                      <span className="text-ink-muted">{l.distanceKm != null ? `${l.distanceKm} km · ` : ""}{timeAgo(l.consentedAt)}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">{l.summary}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <Flow icon={Inbox} step="1" title="Lead → matter" text="Accept a consented lead; it becomes a client and a matter with the right intake checklist." href="/dashboard/leads" />
        <Flow icon={Sparkles} step="2" title="Research" text="Ask the copilot. Every authority is retrieved from the corpus and verified before display." href="/dashboard/copilot" />
        <Flow icon={FileSignature} step="3" title="Draft" text="Generate a notice, complaint or petition grounded only in your saved, verified brief." href="/dashboard/matters" />
      </section>

      <CorpusCard />
    </>
  );
}

function Stat({ icon: Icon, label, value, hint, href, accent }: { icon: typeof Inbox; label: string; value: number | string | null; hint?: string; href?: string; accent?: boolean }) {
  const body = (
    <div className={`card h-full p-4 transition ${href ? "hover:-translate-y-0.5 hover:shadow-lift" : ""}`}>
      <div className="flex items-center justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent ? "bg-saffron-50 text-saffron-700" : "bg-brand-50 text-brand"}`}><Icon className="h-4 w-4" /></span>
        {href && <ArrowRight className="h-4 w-4 text-ink-muted" />}
      </div>
      {value === null ? <div className="skeleton mt-3 h-8 w-12" /> : <p className="mt-3 text-3xl font-semibold text-ink">{value}</p>}
      <p className="text-xs text-ink-muted">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-emerald-700">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}



function Flow({ icon: Icon, step, title, text, href }: { icon: typeof Inbox; step: string; title: string; text: string; href: string }) {
  return (
    <Link href={href} className="card group flex gap-3 p-4 transition hover:shadow-lift">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-saffron-100"><Icon className="h-5 w-5" /></span>
      <div>
        <p className="text-xs font-semibold text-saffron-700">Step {step}</p>
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{text}</p>
      </div>
    </Link>
  );
}

function ProfileBanner() {
  const p = useQuery(api.marketplace.myProfile);
  if (p === undefined) return null;
  const status = p?.verificationStatus ?? "none";
  if (status === "verified") return null;
  const msg: Record<string, [string, string]> = {
    none: ["Set up your advocate profile to receive consented client leads near your courts.", "border-saffron/30 bg-saffron-50/70"],
    unsubmitted: ["Submit your profile for BCI verification — lead contact details stay locked until then.", "border-saffron/30 bg-saffron-50/70"],
    pending: ["Verification pending. You can see nearby leads; contact details unlock once your enrolment is verified.", "border-sky-200 bg-sky-50"],
    rejected: [`Verification was not approved${p?.verificationNote ? `: ${p.verificationNote}` : "."} Update your profile and resubmit.`, "border-red-200 bg-red-50"],
  };
  const [text, cls] = msg[status] ?? msg.none;
  return (
    <div className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-sm text-ink-soft ${cls}`}>
      <span className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 shrink-0 text-saffron-700" />{text}</span>
      <Link href="/dashboard/profile" className="btn btn-sm shrink-0">{status === "none" ? "Set up profile" : "Open profile"}</Link>
    </div>
  );
}

function CorpusCard() {
  const load = useAction(api.seed.loadDemoCorpus);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <section className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-line bg-white/50 p-4">
      <Database className="h-5 w-5 text-ink-muted" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-ink">Judgment corpus</p>
        <p className="text-xs text-ink-muted">
          Research answers only from the shared corpus. Load the demo set (20 editorial summaries of leading Supreme Court
          decisions across all 8 practice areas) — idempotent, safe to re-run.
        </p>
        {msg && <p className="mt-1 text-xs text-emerald-700">{msg}</p>}
      </div>
      <button
        className="btn-ghost btn-sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await load({});
            setMsg(`Corpus ready: ${r.ingested} new, ${r.skippedDuplicate} already present.`);
          } catch (e) {
            setMsg(`Couldn't load corpus: ${errMsg(e)}`);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Load demo corpus
      </button>
    </section>
  );
}
