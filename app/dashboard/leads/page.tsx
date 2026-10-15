"use client";

import { useMutation, useQuery } from "convex/react";
import { ArrowRight, Check, Clock, Inbox, Landmark, Lock, Mail, MapPin, Phone, Radar, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AppShell, { PageHeader } from "@/components/AppShell";
import { Empty } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { errMsg, timeAgo } from "@/lib/client";

export default function LeadsPage() {
  return (
    <AppShell>
      <Leads />
    </AppShell>
  );
}

function Leads() {
  const [onlyMine, setOnlyMine] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const data = useQuery(api.leads.feed, { onlyMyPracticeAreas: onlyMine, includeDismissed: showDismissed });
  const accept = useMutation(api.leads.accept);
  const dismiss = useMutation(api.leads.dismiss);
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onAccept(id: Id<"chatSessions">) {
    setBusyId(id);
    setError(null);
    try {
      const { matterId } = await accept({ sessionId: id });
      router.push(`/dashboard/matter/${matterId}`);
    } catch (e) {
      setError(errMsg(e));
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Marketplace"
        title="Client leads near your courts"
        subtitle="Citizens who used the assistant and explicitly consented to be contacted. Shown when their nearest court is one of your home courts or they're within your radius — closest and newest first."
      />

      {data === undefined && <div className="grid gap-3 sm:grid-cols-2"><div className="skeleton h-44" /><div className="skeleton h-44" /></div>}
      {data?.state === "needs_profile" && (
        <div className="card">
          <Empty
            icon={MapPin}
            title="Set up your advocate profile"
            text="Add your office location and practice areas. We'll compute your 5 nearest district courts and show leads around them."
            action={<Link href="/dashboard/profile" className="btn btn-sm">Set up profile</Link>}
          />
        </div>
      )}
      {data && data.state !== "needs_profile" && (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm">
            <span className="flex items-center gap-2 text-ink-soft"><Radar className="h-4 w-4 text-brand" /> {data.homeCourtCount} home courts · {data.radiusKm} km radius</span>
            {data.state === "needs_location" && (
              <Link href="/dashboard/profile" className="badge bg-saffron-50 text-saffron-700">Add your office location for radius matching →</Link>
            )}
            {!data.verified && (
              <span className="badge bg-sky-50 text-sky-800"><Lock className="h-3 w-3" /> Contacts unlock after BCI verification ({data.verificationStatus})</span>
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              <button onClick={() => setOnlyMine((v) => !v)} className={`chip ${onlyMine ? "chip-on" : ""}`}>My practice areas</button>
              <button onClick={() => setShowDismissed((v) => !v)} className={`chip ${showDismissed ? "chip-on" : ""}`}>Show dismissed</button>
            </div>
          </div>
          {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {data.leads.length === 0 ? (
            <div className="card">
              <Empty icon={Inbox} title="No consented leads near you yet" text="They appear here live the moment a citizen near your courts opts in from the assistant." action={<Link href="/citizen" className="btn-ghost btn-sm">See the citizen assistant</Link>} />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {data.leads.map((l) => (
                <article key={l._id} className={`card flex flex-col p-0 ${l.myAction === "accepted" ? "ring-2 ring-emerald-300" : ""} ${l.myAction === "dismissed" ? "opacity-60" : ""}`}>
                  <div className="flex-1 p-5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`badge ${l.practiceAreaMatch ? "bg-brand text-white" : "bg-brand-50 text-brand"}`}>{l.categoryLabel}</span>
                      {l.inHomeCourt && <span className="badge bg-emerald-50 text-emerald-700"><Landmark className="h-3 w-3" /> Your court</span>}
                      {l.distanceKm != null && <span className="badge">{l.distanceKm} km</span>}
                      <span className="ml-auto flex items-center gap-1 text-xs text-ink-muted"><Clock className="h-3 w-3" /> {timeAgo(l.consentedAt)}</span>
                    </div>
                    <p className="mt-3 text-[15px] leading-relaxed text-ink">{l.summary || "Citizen requested an advocate."}</p>
                    {l.act && <p className="mt-2 text-xs text-ink-muted">Likely law: {l.act}</p>}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                      {l.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {l.location}</span>}
                      {l.nearestCourtName && <span className="flex items-center gap-1"><Landmark className="h-3 w-3" /> {l.nearestCourtName}</span>}
                    </div>
                  </div>
                  <div className="rounded-b-2xl border-t border-line bg-paper/60 px-5 py-3">
                    {l.contactLocked ? (
                      <p className="flex items-center gap-1.5 text-xs text-ink-muted"><Lock className="h-3.5 w-3.5" /> Contact visible to BCI-verified advocates</p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="font-medium text-ink">{l.contactName || "—"}</span>
                        {l.contactPhone && (
                          <a href={l.contactPhone.includes("@") ? `mailto:${l.contactPhone}` : `tel:${l.contactPhone}`} className="flex items-center gap-1 text-brand">
                            {l.contactPhone.includes("@") ? <Mail className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />} {l.contactPhone}
                          </a>
                        )}
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      {l.myAction === "accepted" && l.matterId ? (
                        <Link href={`/dashboard/matter/${l.matterId}`} className="btn btn-sm"><Check className="h-3.5 w-3.5" /> Accepted · open matter <ArrowRight className="h-3.5 w-3.5" /></Link>
                      ) : (
                        <>
                          <button className="btn btn-sm" disabled={busyId === l._id || l.contactLocked} onClick={() => void onAccept(l._id)}>
                            {busyId === l._id ? "Accepting…" : "Accept → create matter"}
                          </button>
                          {l.myAction !== "dismissed" && (
                            <button className="btn-ghost btn-sm" onClick={() => void dismiss({ sessionId: l._id }).catch((e) => setError(errMsg(e)))}>
                              <X className="h-3.5 w-3.5" /> Dismiss
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          <p className="mt-6 text-xs text-ink-muted">
            Only the fields the citizen approved are shown — never their chat. Accepting creates a client and a matter in your workspace. Flat lead fee, never a percentage (BCI Rule 36).
          </p>
        </>
      )}
    </>
  );
}
