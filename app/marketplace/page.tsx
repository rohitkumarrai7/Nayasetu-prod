"use client";

import { useMutation, useQuery } from "convex/react";
import { BadgeCheck, Languages, Landmark, MapPin, MessageSquareText, Navigation, Search, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import Nav, { Footer } from "@/components/Nav";
import { initials } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { errMsg, PRACTICE_AREAS, useGeolocation } from "@/lib/client";

export default function MarketplacePage() {
  const [city, setCity] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [practiceArea, setPracticeArea] = useState("");
  const [language, setLanguage] = useState("");
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const geo = useGeolocation();
  const cities = useQuery(api.geo.cities);
  const seed = useMutation(api.marketplace.seedSampleLawyers);
  const where = useQuery(api.geo.resolve, coords ? { ...coords, n: 1 } : city.trim().length > 2 ? { city, n: 1 } : "skip");
  const results = useQuery(api.marketplace.searchDirectory, {
    city: coords ? undefined : city.trim() || undefined,
    lat: coords?.lat,
    lng: coords?.lng,
    practiceArea: practiceArea || undefined,
    language: language.trim() || undefined,
  });

  return (
    <>
      <Nav />
      <main className="mx-auto min-h-[70vh] max-w-6xl px-4 py-10">
        <p className="eyebrow">Verified directory</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Find a verified advocate near your court</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Only advocates whose Bar Council enrolment has been verified. Listed by distance, then name — never ranked, rated
          or sponsored. You choose whom to contact.
        </p>

        <div className="card mt-6 grid gap-2 p-3 sm:grid-cols-[1.4fr_auto_1fr_1fr]">
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input className="input pl-9" list="ns-cities-m" placeholder="City or district" value={coords ? "Near me (GPS)" : city}
              onChange={(e) => { setCoords(null); setCity(e.target.value); }} />
            <datalist id="ns-cities-m">{cities?.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <button className="btn-ghost" disabled={geo.busy} onClick={async () => { const p = await geo.locate(); if (p) setCoords(p); }}>
            <Navigation className="h-4 w-4" /> {geo.busy ? "Locating…" : "Near me"}
          </button>
          <select className="input" value={practiceArea} onChange={(e) => setPracticeArea(e.target.value)}>
            <option value="">All practice areas</option>
            {PRACTICE_AREAS.map((a) => <option key={a}>{a}</option>)}
          </select>
          <input className="input" placeholder="Language (e.g. Hindi)" value={language} onChange={(e) => setLanguage(e.target.value)} />
        </div>
        {geo.error && <p className="mt-2 text-xs text-red-600">{geo.error}</p>}
        {where && <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-muted"><Landmark className="h-4 w-4 text-saffron-700" /> Matching around {where.label} · nearest court: <b className="font-medium text-ink">{where.courts[0]?.name}</b></p>}
        {city.trim().length > 2 && !coords && where === null && (
          <p className="mt-2 text-xs text-amber-700">We don&apos;t recognise “{city}” — showing exact city matches only. Try your district name.</p>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results === undefined && [0, 1, 2].map((i) => <div key={i} className="skeleton h-44" />)}
          {results?.map((p) => (
            <article key={p._id} className="card flex flex-col">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">{initials(p.displayName)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.displayName}</p>
                  <span className="badge-verified mt-1"><BadgeCheck className="h-3 w-3" /> BCI verified</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {p.practiceAreas.map((a) => <span key={a} className={`badge ${a === practiceArea ? "bg-brand-50 text-brand" : ""}`}>{a}</span>)}
              </div>
              <div className="mt-3 space-y-1 text-xs text-ink-muted">
                <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {[p.city, p.distanceKm != null ? `${p.distanceKm} km away` : null].filter(Boolean).join(" · ") || "Location on request"}</p>
                {p.servesYourCourt && <p className="flex items-center gap-1.5 font-medium text-emerald-700"><Landmark className="h-3.5 w-3.5" /> Practises at your court</p>}
                {p.languages.length > 0 && <p className="flex items-center gap-1.5"><Languages className="h-3.5 w-3.5" /> {p.languages.join(", ")}</p>}
                {p.feeRange && <p className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> {p.feeRange}</p>}
              </div>
              {p.bciEnrolmentNo && <p className="mt-auto pt-3 text-[11px] text-ink-muted">Enrolment {p.bciEnrolmentNo}</p>}
            </article>
          ))}
        </div>
        {results?.length === 0 && (
          <div className="card mt-2 flex flex-col items-center py-10 text-center">
            <Search className="h-7 w-7 text-ink-muted" />
            <p className="mt-3 font-semibold">No verified advocates match these filters yet</p>
            <p className="mt-1 max-w-md text-sm text-ink-muted">
              Describe your problem to the assistant and consent to be contacted — verified advocates near your court will see it.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link href="/citizen" className="btn-accent"><MessageSquareText className="h-4 w-4" /> Ask the assistant</Link>
              <button className="btn-ghost" onClick={() => seed().then((r) => setSeedMsg(`Loaded ${r.inserted} fictional demo advocates.`)).catch((e) => setSeedMsg(errMsg(e)))}>
                Load demo advocates (fictional)
              </button>
            </div>
            {seedMsg && <p className="mt-2 text-xs text-ink-muted">{seedMsg}</p>}
          </div>
        )}
        <div className="mt-10 rounded-2xl bg-brand-900 p-6 text-white sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="font-serif text-xl font-semibold text-white">Are you an advocate?</p>
            <p className="mt-1 text-sm text-white/70">Get verified to be listed here and receive consented client leads near your courts.</p>
          </div>
          <Link href="/login?mode=signup" className="btn-accent mt-4 sm:mt-0">Join as advocate</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
