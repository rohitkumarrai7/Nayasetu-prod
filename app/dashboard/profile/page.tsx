"use client";

import { useMutation, useQuery } from "convex/react";
import { Navigation } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell, { PageHeader } from "@/components/AppShell";
import { api } from "@/convex/_generated/api";
import { errMsg, PRACTICE_AREAS, useGeolocation } from "@/lib/client";

const LANGUAGES = ["English", "Hindi", "Bengali", "Marathi", "Telugu", "Tamil", "Gujarati", "Urdu", "Kannada", "Odia", "Malayalam", "Punjabi", "Assamese"];
const BAR_COUNCILS = [
  "Andhra Pradesh", "Assam, Nagaland, Meghalaya, Manipur, Tripura, Mizoram & Arunachal Pradesh", "Bihar", "Chhattisgarh",
  "Delhi", "Gujarat", "Himachal Pradesh", "Jammu & Kashmir and Ladakh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra & Goa", "Odisha", "Punjab & Haryana", "Rajasthan", "Sikkim", "Tamil Nadu & Puducherry",
  "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

export default function ProfilePage() {
  return (
    <AppShell>
      <ProfileWizard />
    </AppShell>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2 className="mb-4 flex items-center gap-2.5 font-serif text-lg font-semibold">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full font-sans text-xs ${done ? "bg-emerald-600 text-white" : "bg-brand-50 text-brand"}`}>
          {done ? "✓" : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function ProfileWizard() {
  const profile = useQuery(api.marketplace.myProfile);
  const cities = useQuery(api.geo.cities);
  const save = useMutation(api.marketplace.upsertLawyerProfile);
  const submit = useMutation(api.marketplace.submitForVerification);
  const geo = useGeolocation();

  const [displayName, setDisplayName] = useState("");
  const [enrolment, setEnrolment] = useState("");
  const [council, setCouncil] = useState("");
  const [year, setYear] = useState("");
  const [areas, setAreas] = useState<string[]>([]);
  const [langs, setLangs] = useState<string[]>(["English"]);
  const [city, setCity] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(40);
  const [fee, setFee] = useState("");
  const [listed, setListed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (profile === undefined || loaded) return;
    if (profile) {
      setDisplayName(profile.displayName);
      setEnrolment(profile.bciEnrolmentNo ?? "");
      setCouncil(profile.enrolmentState ?? "");
      setYear(profile.enrolmentYear ? String(profile.enrolmentYear) : "");
      setAreas(profile.practiceAreas);
      setLangs(profile.languages.length ? profile.languages : ["English"]);
      setCity(profile.city ?? "");
      setRadius(profile.radiusKm ?? 40);
      setFee(profile.feeRange ?? "");
      setListed(profile.listed);
    }
    setLoaded(true);
  }, [profile, loaded]);

  const preview = useQuery(api.geo.resolve, coords ? { lat: coords.lat, lng: coords.lng } : city.trim().length > 2 ? { city } : "skip");

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function persist() {
    await save({
        displayName,
        bciEnrolmentNo: enrolment || undefined,
        enrolmentState: council || undefined,
        enrolmentYear: year ? Number(year) : undefined,
        practiceAreas: areas,
        languages: langs,
        city: coords ? undefined : city || undefined,
        officeLat: coords?.lat,
        officeLng: coords?.lng,
        radiusKm: radius,
        feeRange: fee || undefined,
        listed,
      });
    setCoords(null);
  }

  async function onSave() {
    setBusy(true);
    setMsg(null);
    try {
      await persist();
      setMsg({ ok: true, text: "Profile saved." });
    } catch (e) {
      setMsg({ ok: false, text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    setBusy(true);
    setMsg(null);
    try {
      await persist();
      const r = await submit({});
      setMsg({ ok: true, text: r.status === "verified" ? "You're already verified." : "Submitted for verification. We'll check your enrolment with the Bar Council roll." });
    } catch (e) {
      setMsg({ ok: false, text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  if (profile === undefined || !loaded) return <p className="text-ink-muted">Loading…</p>;
  const status = profile?.verificationStatus ?? "unsubmitted";
  const statusUi: Record<string, [string, string]> = {
    unsubmitted: ["Not submitted", "bg-paper-dark text-ink-soft"],
    pending: ["Verification pending", "bg-sky-100 text-sky-800"],
    verified: ["✓ BCI verified", "bg-emerald-100 text-emerald-800"],
    rejected: ["Not approved", "bg-red-100 text-red-800"],
  };
  const [statusText, statusCls] = statusUi[status];
  const courts = profile?.homeCourtDetails ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Marketplace"
        title="Advocate profile"
        subtitle="Verified advocates appear in the citizen directory and receive consented client leads near their 5 home courts."
        actions={<span className={`rounded-full px-3 py-1 text-sm font-medium ${statusCls}`}>{statusText}</span>}
      />
      {status === "rejected" && profile?.verificationNote && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">Reviewer note: {profile.verificationNote}</p>
      )}

      <Step n={1} title="Enrolment" done={!!profile?.bciEnrolmentNo && !!profile?.enrolmentState}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Full name (as on the roll)</label>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Adv. Priya Sharma" />
          </div>
          <div>
            <label className="label">Enrolment number</label>
            <input className="input" value={enrolment} onChange={(e) => setEnrolment(e.target.value)} placeholder="D/1234/2015" />
          </div>
          <div>
            <label className="label">Year of enrolment</label>
            <input className="input" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2015" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">State Bar Council</label>
            <select className="input" value={council} onChange={(e) => setCouncil(e.target.value)}>
              <option value="">Select…</option>
              {BAR_COUNCILS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
        </div>
        {status === "verified" && <p className="mt-2 text-xs text-amber-700">Changing your enrolment number sends your profile back for verification.</p>}
      </Step>

      <Step n={2} title="Practice" done={(profile?.practiceAreas.length ?? 0) > 0}>
        <label className="label">Practice areas</label>
        <div className="flex flex-wrap gap-2">
          {PRACTICE_AREAS.map((a) => (
            <button key={a} type="button" onClick={() => toggle(areas, setAreas, a)}
              className={`chip ${areas.includes(a) ? "chip-on" : ""}`}>
              {a}
            </button>
          ))}
        </div>
        <label className="label mt-4">Languages</label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <button key={l} type="button" onClick={() => toggle(langs, setLangs, l)}
              className={`chip ${langs.includes(l) ? "border-brand bg-brand-50 text-brand" : ""}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Indicative fee range</label>
            <input className="input" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="₹2,000–₹5,000 per consultation" />
          </div>
          <label className="flex items-center gap-2 self-end text-sm text-ink-soft">
            <input type="checkbox" checked={listed} onChange={(e) => setListed(e.target.checked)} />
            List me in the public directory (once verified)
          </label>
        </div>
      </Step>

      <Step n={3} title="Office location & lead radius" done={courts.length > 0}>
        <div className="flex flex-wrap items-center gap-2">
          <input className="input max-w-xs" list="ns-cities-p" value={coords ? "Current location (GPS)" : city}
            onChange={(e) => { setCoords(null); setCity(e.target.value); }} placeholder="City or area of your office" />
          <datalist id="ns-cities-p">{cities?.map((c) => <option key={c} value={c} />)}</datalist>
          <button type="button" className="btn-ghost" disabled={geo.busy} onClick={async () => { const p = await geo.locate(); if (p) setCoords(p); }}>
            <Navigation className="h-4 w-4" /> {geo.busy ? "Locating…" : "Use my current location"}
          </button>
        </div>
        {geo.error && <p className="mt-1 text-xs text-red-600">{geo.error}</p>}
        <label className="label mt-4">Lead radius: {radius} km</label>
        <input type="range" min={5} max={100} step={5} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full max-w-sm accent-[#13305c]" />
        <p className="text-xs text-ink-muted">You&apos;ll see consented leads whose nearest court is one of your 5 home courts, or that are within this radius.</p>
        {(preview?.courts ?? courts).length > 0 && (
          <div className="mt-4 rounded-xl bg-paper p-4 text-sm">
            <p className="mb-1 font-medium">{preview ? "Home courts for this location" : "Your home courts"}</p>
            <ol className="list-inside list-decimal text-ink-soft">
              {(preview?.courts ?? courts).map((c) => (
                <li key={c.code}>{c.name} <span className="text-ink-muted">— {c.district}, {c.state}{c.distanceKm != null ? ` · ${c.distanceKm} km` : ""}</span></li>
              ))}
            </ol>
          </div>
        )}
        {city.trim().length > 2 && !coords && preview === null && (
          <p className="mt-2 text-xs text-amber-700">We don&apos;t recognise that place yet — try the district name or a nearby city.</p>
        )}
      </Step>

      {msg && <p className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-ghost" disabled={busy} onClick={() => void onSave()}>{busy ? "Saving…" : "Save profile"}</button>
        {status !== "verified" && status !== "pending" && (
          <button className="btn-accent" disabled={busy} onClick={() => void onSubmit()}>Save & submit for BCI verification</button>
        )}
        <Link href="/dashboard/leads" className="btn-ghost ml-auto">See leads near me →</Link>
      </div>
    </div>
  );
}
