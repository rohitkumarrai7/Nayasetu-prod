"use client";

import { useMutation, useQuery } from "convex/react";
import { FunctionReturnType } from "convex/server";
import { Briefcase, Mail, MapPin, Phone, Plus, Search, Users, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import AppShell, { PageHeader, useWorkspace } from "@/components/AppShell";
import { Empty, initials, StatusPill } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { errMsg, timeAgo } from "@/lib/client";

export default function ClientsPage() {
  return (
    <AppShell>
      <Clients />
    </AppShell>
  );
}

function Clients() {
  const ws = useWorkspace();
  const clients = useQuery(api.crm.listClients, { firmId: ws.firmId });
  const matters = useQuery(api.crm.listMatters, { firmId: ws.firmId });
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Id<"clients"> | null>(null);

  const byClient = useMemo(() => {
    const m = new Map<string, MatterRow[]>();
    for (const mt of matters ?? []) m.set(mt.clientId, [...(m.get(mt.clientId) ?? []), mt]);
    return m;
  }, [matters]);
  const rows = (clients ?? []).filter((c) => !q.trim() || `${c.name} ${c.phone ?? ""} ${c.email ?? ""} ${c.city ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const sel = clients?.find((c) => c._id === selected) ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Practice"
        title="Clients"
        subtitle="Private to your firm. Clients from accepted leads arrive with the contact details they consented to share."
        actions={<button className="btn" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add client</button>}
      />
      {adding && <AddClient onClose={() => setAdding(false)} />}
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input className="input pl-9" placeholder="Search by name, phone, email or city" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="card-flat overflow-hidden">
            {clients === undefined ? (
              <div className="space-y-2 p-4"><div className="skeleton h-12" /><div className="skeleton h-12" /></div>
            ) : rows.length === 0 ? (
              <div className="p-6"><Empty icon={Users} title={clients.length ? "No match" : "No clients yet"} text={clients.length ? "Try another search." : "Add a client, or accept a lead from the feed."} /></div>
            ) : (
              <ul className="divide-y divide-line">
                {rows.map((c) => (
                  <li key={c._id}>
                    <button onClick={() => setSelected(c._id)} className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-paper/70 ${selected === c._id ? "bg-brand-50/60" : ""}`}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand">{initials(c.name)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-ink">{c.name}</p>
                        <p className="truncate text-xs text-ink-muted">{[c.phone, c.email, c.city].filter(Boolean).join(" · ") || "No contact details"}</p>
                      </div>
                      <span className="badge">{byClient.get(c._id)?.length ?? 0} matter{(byClient.get(c._id)?.length ?? 0) === 1 ? "" : "s"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="lg:col-span-2">
          {sel ? (
            <ClientDetail key={sel._id} client={sel} matters={byClient.get(sel._id) ?? []} />
          ) : (
            <div className="card text-sm text-ink-muted">Select a client to see their details and matters.</div>
          )}
        </div>
      </div>
    </>
  );
}

function AddClient({ onClose }: { onClose: () => void }) {
  const ws = useWorkspace();
  const create = useMutation(api.crm.createClient);
  const [f, setF] = useState({ name: "", phone: "", email: "", city: "" });
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="card mb-5 grid gap-2 animate-fade-up sm:grid-cols-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!f.name.trim()) return setError("Client name is required.");
        try {
          await create({
            firmId: ws.firmId,
            name: f.name.trim(),
            phone: f.phone.trim() || undefined,
            email: f.email.trim() || undefined,
            city: f.city.trim() || undefined,
          });
          onClose();
        } catch (err) {
          setError(errMsg(err));
        }
      }}
    >
      <input className="input sm:col-span-2" placeholder="Full name *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
      <input className="input" placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      <input className="input" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <input className="input" placeholder="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
      <div className="flex items-center gap-2 sm:col-span-5">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="button" className="btn-ghost ml-auto" onClick={onClose}><X className="h-4 w-4" /> Cancel</button>
        <button className="btn">Save client</button>
      </div>
    </form>
  );
}

type ClientDoc = FunctionReturnType<typeof api.crm.listClients>[number];
type MatterRow = FunctionReturnType<typeof api.crm.listMatters>[number];

function ClientDetail({ client, matters }: { client: ClientDoc; matters: MatterRow[] }) {
  const update = useMutation(api.crm.updateClient);
  const [notes, setNotes] = useState(client.notes ?? "");
  const [saved, setSaved] = useState(false);
  return (
    <div className="card space-y-4 lg:sticky lg:top-6">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-base font-semibold text-white">{initials(client.name)}</span>
        <div>
          <p className="font-serif text-lg font-semibold">{client.name}</p>
          <p className="text-xs text-ink-muted">Client since {timeAgo(client._creationTime)}</p>
        </div>
      </div>
      <div className="space-y-1.5 text-sm">
        {client.phone && <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-brand"><Phone className="h-4 w-4" />{client.phone}</a>}
        {client.email && <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-brand"><Mail className="h-4 w-4" />{client.email}</a>}
        {client.city && <p className="flex items-center gap-2 text-ink-soft"><MapPin className="h-4 w-4 text-ink-muted" />{client.city}</p>}
      </div>
      <div>
        <p className="label">Notes</p>
        <textarea className="input" rows={3} value={notes} onChange={(e) => { setNotes(e.target.value); setSaved(false); }} />
        <button
          className="btn-ghost btn-sm mt-2"
          disabled={notes === (client.notes ?? "")}
          onClick={async () => { await update({ clientId: client._id, notes }); setSaved(true); }}
        >
          {saved ? "Saved" : "Save notes"}
        </button>
      </div>
      <div>
        <p className="label">Matters</p>
        {matters.length === 0 ? (
          <Link href="/dashboard/matters?new=1" className="text-sm text-brand hover:underline">+ Open a matter for this client</Link>
        ) : (
          <ul className="space-y-1.5">
            {matters.map((m) => (
              <li key={m._id}>
                <Link href={`/dashboard/matter/${m._id}`} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:border-brand/30">
                  <Briefcase className="h-4 w-4 text-ink-muted" />
                  <span className="min-w-0 flex-1 truncate">{m.title}</span>
                  <StatusPill status={m.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
