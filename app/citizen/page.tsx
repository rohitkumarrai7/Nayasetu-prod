"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowUp, BadgeCheck, Check, ChevronDown, FileText, Gavel, Landmark, Loader2, Lock, MapPin, Navigation, Phone,
  RotateCcw, Scale, ShieldCheck, UserCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Nav from "@/components/Nav";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { CATEGORY_LABEL, errMsg, useGeolocation } from "@/lib/client";

type Msg = {
  role: "user" | "assistant";
  content: string;
  rights?: string[];
  nextSteps?: string[];
  documents?: string[];
  act?: string;
  category?: string;
  error?: boolean;
};
type Advocate = {
  name: string;
  phone?: string;
  address?: string;
  city?: string;
  url?: string;
  source: string;
  verified: boolean;
  distanceKm?: number | null;
  practiceAreas?: string[];
  languages?: string[];
  feeRange?: string;
  bciEnrolmentNo?: string;
  servesYourCourt?: boolean;
};

const THINKING = ["Understanding your situation", "Identifying the law that applies", "Checking your rights & the right forum", "Writing it in plain language"];
const EXAMPLES = [
  { t: "A bike hit me and the rider won't pay for my treatment", i: "🛵" },
  { t: "My landlord isn't returning my security deposit", i: "🏠" },
  { t: "Someone took money from my account through a fake UPI call", i: "📱" },
  { t: "My employer hasn't paid my salary for 2 months", i: "💼" },
  { t: "Online seller sent a defective phone and refuses refund", i: "🛒" },
  { t: "Cheque bounce ho gaya, party paise nahi de rahi", i: "🧾" },
];

export default function CitizenPage() {
  const respond = useAction(api.chat.respond);
  const findAdvocates = useAction(api.advocates.findAdvocates);
  const setLocation = useMutation(api.chat.setLocation);
  const grantConsent = useMutation(api.chat.grantConsent);
  const withdrawConsent = useMutation(api.chat.withdrawConsent);
  const geo = useGeolocation();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [thinkIdx, setThinkIdx] = useState(0);
  const [sessionId, setSessionId] = useState<Id<"chatSessions"> | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [act, setAct] = useState<string>("");
  const [place, setPlace] = useState<{ label: string; court: string; lat?: number; lng?: number } | null>(null);
  const [cityInput, setCityInput] = useState("");
  const [locError, setLocError] = useState<string | null>(null);
  const [advocates, setAdvocates] = useState<Advocate[] | null>(null);
  const [findingAdv, setFindingAdv] = useState(false);
  const [consent, setConsent] = useState({ name: "", contact: "", agree: false });
  const [consenting, setConsenting] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const status = useQuery(api.chat.sessionStatus, sessionId ? { sessionId } : "skip");
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const cities = useQuery(api.geo.cities);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (!busy) return setThinkIdx(0);
    const t = setInterval(() => setThinkIdx((i) => Math.min(i + 1, THINKING.length - 1)), 1100);
    return () => clearInterval(t);
  }, [busy]);

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || busy) return;
    setInput("");
    const history = messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    try {
      const r = await respond({ sessionId: sessionId ?? undefined, history, message: text, lat: place?.lat, lng: place?.lng });
      setSessionId(r.sessionId);
      setCategory(r.category);
      if (r.act) setAct(r.act);
      if (r.location) setPlace((p) => ({ label: r.location, court: r.nearestCourtName, lat: p?.lat, lng: p?.lng }));
      setMessages((m) => [
        ...m,
        { role: "assistant", content: r.answer, rights: r.rights, nextSteps: r.nextSteps, documents: r.documents, act: r.act, category: r.category },
      ]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `Sorry — ${errMsg(e)}`, error: true }]);
    } finally {
      setBusy(false);
      taRef.current?.focus();
    }
  }

  async function applyLocation(loc: { lat?: number; lng?: number; city?: string }) {
    setLocError(null);
    if (!sessionId) return setLocError("Describe your problem first, then add your location.");
    try {
      const r = await setLocation({ sessionId, ...loc });
      setPlace({ label: r.location, court: r.nearestCourtName, lat: r.lat, lng: r.lng });
      setAdvocates(null);
    } catch (e) {
      setLocError(errMsg(e));
    }
  }

  async function locateAdvocates() {
    if (!category || category === "other") return;
    setFindingAdv(true);
    setAdvocates(null);
    try {
      const r = await findAdvocates({
        practiceArea: CATEGORY_LABEL[category],
        lat: place?.lat,
        lng: place?.lng,
        city: place && place.lat === undefined ? place.label : undefined,
      });
      setAdvocates(r.advocates);
    } catch (e) {
      setLocError(errMsg(e));
      setAdvocates([]);
    } finally {
      setFindingAdv(false);
    }
  }

  async function share() {
    if (!sessionId) return;
    setConsenting(true);
    setConsentError(null);
    try {
      await grantConsent({ sessionId, contactName: consent.name.trim(), contactPhone: consent.contact.trim() });
    } catch (e) {
      setConsentError(errMsg(e));
    } finally {
      setConsenting(false);
    }
  }

  function reset() {
    setMessages([]);
    setSessionId(null);
    setCategory(null);
    setAct("");
    setPlace(null);
    setAdvocates(null);
    setConsent({ name: "", contact: "", agree: false });
  }

  const routed = !!category && category !== "other";
  const label = category ? CATEGORY_LABEL[category] ?? "General" : "";
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && !m.error);

  const panel = (suffix: string) => (
    <CasePanel
      suffix={suffix}
      routed={routed}
      label={label}
      act={act}
      place={place}
      setPlace={setPlace}
      cityInput={cityInput}
      setCityInput={setCityInput}
      cities={cities ?? []}
      geo={geo}
      locError={locError}
      applyLocation={applyLocation}
      advocates={advocates}
      findingAdv={findingAdv}
      locateAdvocates={locateAdvocates}
      sessionId={sessionId}
      status={status ?? null}
      consent={consent}
      setConsent={setConsent}
      consenting={consenting}
      consentError={consentError}
      share={share}
      withdraw={() => sessionId && void withdrawConsent({ sessionId })}
    />
  );

  return (
    <div className="flex h-[100dvh] flex-col">
      <Nav />
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 overflow-hidden px-3 sm:px-4">
        {/* Chat column */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto py-5" aria-live="polite">
            {messages.length === 0 ? (
              <Welcome onPick={(t) => void send(t)} />
            ) : (
              <div className="mx-auto max-w-2xl space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {routed && <span className="badge bg-brand-50 text-brand"><Scale className="h-3 w-3" /> {label}</span>}
                    {place && <span className="badge"><MapPin className="h-3 w-3" /> {place.label}</span>}
                  </div>
                  <button onClick={reset} className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-brand">
                    <RotateCcw className="h-3 w-3" /> New conversation
                  </button>
                </div>
                {messages.map((m, i) => (m.role === "user" ? <UserBubble key={i} text={m.content} /> : <AssistantCard key={i} m={m} />))}
                {busy && <Thinking idx={thinkIdx} />}
                {/* Mobile: the case panel flows under the latest answer */}
                {!busy && routed && lastAssistant && <div className="space-y-4 lg:hidden">{panel("m")}</div>}
              </div>
            )}
          </div>

          <div className="pb-3 pt-1">
            <div className="mx-auto max-w-2xl">
              <div className="flex items-end gap-2 rounded-2xl border border-line bg-white p-2 shadow-card focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/10">
                <textarea
                  ref={taRef}
                  className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] outline-none placeholder:text-ink-muted/70"
                  rows={1}
                  maxLength={4000}
                  placeholder={messages.length ? "Add details or ask a follow-up…" : "Describe what happened, in your own words…"}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                />
                <button className="btn h-10 w-10 shrink-0 rounded-xl p-0" disabled={busy || !input.trim()} onClick={() => void send()} aria-label="Send">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] text-ink-muted">
                Legal information, not legal advice · Phone, Aadhaar, PAN & emails are redacted before processing · Emergency 112 · Women 181 · Cyber fraud 1930
              </p>
            </div>
          </div>
        </main>

        {/* Desktop: sticky case panel */}
        <aside className="hidden w-[360px] shrink-0 overflow-y-auto py-5 lg:block">
          {routed ? (
            <div className="space-y-4">{panel("d")}</div>
          ) : (
            <div className="card space-y-3 text-sm text-ink-muted">
              <p className="font-serif text-lg font-semibold text-ink">How this works</p>
              <p className="flex gap-2"><Scale className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> We identify which Indian law applies to your situation.</p>
              <p className="flex gap-2"><Gavel className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> You get your rights, the right forum and the next step.</p>
              <p className="flex gap-2"><UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> If you want, we connect you to BCI-verified advocates at your nearest district court — only with your consent.</p>
              <p className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> No account. Your chat is never shared with advocates.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Welcome({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center pt-6 text-center sm:pt-12">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-saffron-50 text-saffron-700"><Scale className="h-7 w-7" /></span>
      <h1 className="mt-5 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Namaste. What happened?</h1>
      <p className="mt-3 max-w-lg text-ink-muted">
        Tell me in plain words — English or Hinglish. I&apos;ll explain which law applies, your rights and the next step,
        and help you reach a verified advocate near you.
      </p>
      <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.t}
            onClick={() => onPick(ex.t)}
            className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-left text-sm text-ink-soft shadow-card transition hover:-translate-y-0.5 hover:border-brand/30 hover:text-brand"
          >
            <span className="text-lg">{ex.i}</span>
            {ex.t}
          </button>
        ))}
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end animate-fade-up">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[15px] text-white shadow-sm">{text}</div>
    </div>
  );
}

function AssistantCard({ m }: { m: Msg }) {
  const [docsOpen, setDocsOpen] = useState(false);
  if (m.error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{m.content}</div>;
  }
  return (
    <div className="flex gap-3 animate-fade-up">
      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white"><Scale className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1 space-y-3">
        {m.act && (
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-saffron-50 px-2.5 py-1 text-xs font-medium text-saffron-700">
            <Landmark className="h-3.5 w-3.5" /> {m.act}
          </div>
        )}
        <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
          {/* Rules-engine answers repeat rights/steps inline; the cards below already show them. */}
          {m.rights?.length
            ? m.content.split("\n\n").filter((p) => !/^(Your rights, in short:|What to do next:)/.test(p)).join("\n\n")
            : m.content}
        </div>
        {m.rights && m.rights.length > 0 && (
          <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-3.5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-800"><ShieldCheck className="h-3.5 w-3.5" /> Your rights</p>
            <ul className="space-y-1.5 text-sm text-emerald-950/80">
              {m.rights.map((r) => <li key={r} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{r}</li>)}
            </ul>
          </div>
        )}
        {m.nextSteps && m.nextSteps.length > 0 && (
          <div className="rounded-xl border border-line bg-white p-3.5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">What to do next</p>
            <ol className="space-y-2 text-sm text-ink-soft">
              {m.nextSteps.map((s, i) => (
                <li key={s} className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        )}
        {m.documents && m.documents.length > 0 && (
          <div className="rounded-xl border border-line bg-white">
            <button onClick={() => setDocsOpen((o) => !o)} className="flex w-full items-center justify-between px-3.5 py-2.5 text-sm font-medium text-ink-soft">
              <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-brand" /> Documents to keep ready ({m.documents.length})</span>
              <ChevronDown className={`h-4 w-4 transition ${docsOpen ? "rotate-180" : ""}`} />
            </button>
            {docsOpen && (
              <ul className="space-y-1 border-t border-line px-3.5 py-2.5 text-sm text-ink-muted">
                {m.documents.map((d) => <li key={d} className="flex gap-2"><span className="text-saffron">•</span>{d}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Thinking({ idx }: { idx: number }) {
  return (
    <div className="flex gap-3">
      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white"><Scale className="h-4 w-4" /></span>
      <div className="rounded-xl border border-line bg-white px-4 py-3 shadow-card">
        <ul className="space-y-1.5 text-sm">
          {THINKING.map((t, i) => (
            <li key={t} className={`flex items-center gap-2 transition ${i > idx ? "text-ink-muted/40" : i === idx ? "text-ink" : "text-ink-muted"}`}>
              {i < idx ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : i === idx ? <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" /> : <span className="h-3.5 w-3.5" />}
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

interface PanelProps {
  suffix: string;
  routed: boolean;
  label: string;
  act: string;
  place: { label: string; court: string; lat?: number; lng?: number } | null;
  setPlace: (p: null) => void;
  cityInput: string;
  setCityInput: (s: string) => void;
  cities: string[];
  geo: ReturnType<typeof useGeolocation>;
  locError: string | null;
  applyLocation: (l: { lat?: number; lng?: number; city?: string }) => Promise<void>;
  advocates: Advocate[] | null;
  findingAdv: boolean;
  locateAdvocates: () => Promise<void>;
  sessionId: Id<"chatSessions"> | null;
  status: { consentToShare: boolean; location: string | null; nearestCourtName: string | null; advocatesAccepted: number } | null;
  consent: { name: string; contact: string; agree: boolean };
  setConsent: (c: { name: string; contact: string; agree: boolean }) => void;
  consenting: boolean;
  consentError: string | null;
  share: () => Promise<void>;
  withdraw: () => void;
}

function CasePanel(p: PanelProps) {
  if (!p.routed) return null;
  return (
    <>
      {/* Case summary */}
      <div className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Your case</p>
        <p className="mt-1 font-serif text-lg font-semibold">{p.label}</p>
        {p.act && <p className="text-sm text-ink-muted">{p.act}</p>}
        <div className="mt-3 border-t border-line pt-3">
          {!p.place ? (
            <>
              <p className="mb-2 text-sm font-medium">Where are you? <span className="font-normal text-ink-muted">(to find your district court)</span></p>
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="Your city or district"
                  list={`ns-cities-${p.suffix}`}
                  value={p.cityInput}
                  onChange={(e) => p.setCityInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && p.cityInput.trim() && void p.applyLocation({ city: p.cityInput })}
                />
                <datalist id={`ns-cities-${p.suffix}`}>{p.cities.map((c) => <option key={c} value={c} />)}</datalist>
                <button className="btn shrink-0" disabled={!p.cityInput.trim()} onClick={() => void p.applyLocation({ city: p.cityInput })}>Set</button>
              </div>
              <button
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
                disabled={p.geo.busy}
                onClick={async () => { const g = await p.geo.locate(); if (g) await p.applyLocation(g); }}
              >
                <Navigation className="h-3.5 w-3.5" /> {p.geo.busy ? "Locating…" : "Use my current location"}
              </button>
            </>
          ) : (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-saffron-700" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.place.label}</p>
                {p.place.court && <p className="text-xs text-ink-muted">Nearest court: {p.place.court}</p>}
              </div>
              <button className="text-xs text-brand hover:underline" onClick={() => p.setPlace(null)}>Change</button>
            </div>
          )}
          {(p.locError || p.geo.error) && <p className="mt-2 text-xs text-red-600">{p.locError || p.geo.error}</p>}
        </div>
      </div>

      {/* Consent → lead */}
      {p.sessionId && (
        <div className={`rounded-2xl border p-4 ${p.status?.consentToShare ? "border-emerald-200 bg-emerald-50" : "border-saffron/30 bg-saffron-50/60"}`}>
          {!p.status?.consentToShare ? (
            <>
              <p className="flex items-center gap-2 font-semibold text-ink"><UserCheck className="h-4 w-4 text-saffron-700" /> Get a call from a verified advocate</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                With your consent we share only a one-line summary of your {p.label.toLowerCase()} matter
                {p.place ? `, your area (${p.place.label})` : ""}, your name and the contact below with BCI-verified advocates
                near your court. Your chat is not shared. Withdraw anytime.
              </p>
              <div className="mt-3 space-y-2">
                <input className="input" placeholder="Your name" autoComplete="name" value={p.consent.name} onChange={(e) => p.setConsent({ ...p.consent, name: e.target.value })} />
                <input className="input" placeholder="Mobile number or email" autoComplete="tel" value={p.consent.contact} onChange={(e) => p.setConsent({ ...p.consent, contact: e.target.value })} />
              </div>
              <label className="mt-3 flex items-start gap-2 text-xs text-ink-soft">
                <input type="checkbox" className="mt-0.5 accent-[#13305c]" checked={p.consent.agree} onChange={(e) => p.setConsent({ ...p.consent, agree: e.target.checked })} />
                I agree to share these details with verified advocates for this matter. NyayaSetu gives information, not legal advice.
              </label>
              {p.consentError && <p className="mt-2 text-xs text-red-600">{p.consentError}</p>}
              <button
                className="btn-accent mt-3 w-full"
                disabled={p.consenting || !p.consent.agree || !p.consent.name.trim() || !p.consent.contact.trim()}
                onClick={() => void p.share()}
              >
                {p.consenting ? "Sharing…" : "Connect me with an advocate"}
              </button>
              <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-ink-muted"><Lock className="h-3 w-3" /> Protected under the DPDP Act, 2023</p>
            </>
          ) : (
            <div className="text-sm text-emerald-900">
              <p className="flex items-center gap-2 font-semibold"><BadgeCheck className="h-4 w-4" /> Shared with verified advocates{p.status.location ? ` near ${p.status.location}` : ""}</p>
              <p className="mt-1.5 text-xs">
                {p.status.advocatesAccepted > 0
                  ? `${p.status.advocatesAccepted} advocate${p.status.advocatesAccepted > 1 ? "s have" : " has"} picked up your case and will contact you.`
                  : "An advocate will contact you on the details you shared. Keep this page open to see when one picks it up."}
              </p>
              {p.status.advocatesAccepted === 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700"><Loader2 className="h-3 w-3 animate-spin" /> Waiting for an advocate…</p>
              )}
              <button className="mt-3 text-xs text-emerald-800 underline" onClick={p.withdraw}>Withdraw consent and remove my details</button>
            </div>
          )}
        </div>
      )}

      {/* Directory */}
      <div className="card p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">Verified {p.label} advocates</p>
          <button className="btn-ghost btn-sm" disabled={p.findingAdv} onClick={() => void p.locateAdvocates()}>
            {p.findingAdv ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {p.advocates ? "Refresh" : "Show near me"}
          </button>
        </div>
        {!p.place && !p.advocates && <p className="mt-1 text-xs text-ink-muted">Add your location for advocates who practise at your court.</p>}
        {p.advocates && p.advocates.length === 0 && (
          <p className="mt-2 text-sm text-ink-muted">
            No verified {p.label} advocates listed near you yet. Share your case above so one can reach out, or browse the{" "}
            <Link href="/marketplace" className="text-brand underline">directory</Link>.
          </p>
        )}
        {p.advocates && p.advocates.length > 0 && (
          <ul className="mt-3 space-y-2">
            {p.advocates.map((a, i) => (
              <li key={i} className="rounded-xl border border-line p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand">{initials(a.name)}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{a.name}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {[a.city, a.distanceKm != null ? `${a.distanceKm} km` : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                  {a.verified ? <span className="badge-verified"><BadgeCheck className="h-3 w-3" /> Verified</span> : <span className="badge bg-amber-50 text-amber-700">Unverified</span>}
                </div>
                {a.servesYourCourt && <p className="mt-2 text-xs font-medium text-emerald-700">Practises at your court</p>}
                {a.languages && <p className="mt-1 text-xs text-ink-muted">{a.languages.join(", ")}{a.feeRange ? ` · ${a.feeRange}` : ""}</p>}
                <div className="mt-2 flex gap-3 text-xs">
                  {a.phone && <a href={`tel:${a.phone}`} className="inline-flex items-center gap-1 text-brand underline"><Phone className="h-3 w-3" /> Call</a>}
                  {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="text-brand underline">Details →</a>}
                  {a.bciEnrolmentNo && <span className="text-ink-muted">Enrolment {a.bciEnrolmentNo}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-ink-muted">Listed by distance, then name — never ranked or sponsored (BCI Rule 36).</p>
      </div>
    </>
  );
}

function initials(name: string) {
  return name.replace(/^Adv\.?\s*/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}
