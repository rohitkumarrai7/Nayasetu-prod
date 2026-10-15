"use client";

import {
  ArrowRight, BadgeCheck, FileSignature, Inbox, Lock, MapPin, MessageSquareText, Scale, SearchCheck, ShieldCheck, Sparkles,
} from "lucide-react";
import Link from "next/link";
import Nav, { Footer } from "@/components/Nav";

const EXAMPLES = [
  "A bike hit me and the rider won't pay for treatment",
  "My landlord isn't returning my deposit",
  "Money was taken through a fake UPI call",
];

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -left-40 top-10 h-[28rem] w-[28rem] rounded-full bg-saffron-100/60 blur-3xl" />
          <div className="pointer-events-none absolute -right-40 -top-20 h-[30rem] w-[30rem] rounded-full bg-brand-100/70 blur-3xl" />
          <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-14 sm:pt-20">
            <p className="eyebrow text-center">न्याय सेतु · the bridge to justice</p>
            <h1 className="mx-auto mt-4 max-w-3xl text-center font-serif text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
              Understand the law. <span className="text-saffron-700">Reach a verified advocate.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-center text-base text-ink-muted sm:text-lg">
              Plain-language legal help for citizens, and a research workspace for advocates where every citation is
              checked against real judgments before it&apos;s shown.
            </p>

            <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
              <Link href="/citizen" className="group card relative overflow-hidden p-6 transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-saffron-50 text-saffron-700"><MessageSquareText className="h-5 w-5" /></span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">I need legal help</p>
                    <p className="font-serif text-xl font-semibold">Ask NyayaSetu</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-ink-muted">
                  Describe what happened in your own words — English or Hinglish. Learn which law applies, your rights
                  and the next step. No account needed.
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {EXAMPLES.map((e) => <span key={e} className="badge bg-paper">{e}</span>)}
                </div>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-saffron-700">
                  Start free <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
              <Link href="/login?mode=signup" className="group relative overflow-hidden rounded-2xl bg-brand-900 p-6 text-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-saffron/25 blur-2xl" />
                <div className="relative flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-saffron-500"><Scale className="h-5 w-5" /></span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/60">I&apos;m an advocate</p>
                    <p className="font-serif text-xl font-semibold text-white">Open your workspace</p>
                  </div>
                </div>
                <p className="relative mt-3 text-sm text-white/75">
                  Consented client leads near your courts, a citation-verified research copilot, first drafts and a
                  practice CRM — in one place.
                </p>
                <ul className="relative mt-4 space-y-1.5 text-sm text-white/85">
                  <li className="flex items-center gap-2"><Inbox className="h-4 w-4 text-saffron-500" /> Leads within your 5 home courts</li>
                  <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-saffron-500" /> Research copilot, 0% fabricated citations</li>
                </ul>
                <span className="relative mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-saffron-500">
                  Join as advocate <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <section className="border-y border-line bg-white/60">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [SearchCheck, "Verified citations only", "Unverifiable case law is dropped before you see it."],
              [BadgeCheck, "BCI-verified advocates", "Listed only after their enrolment is checked."],
              [Lock, "Consent first (DPDP)", "Nothing is shared with an advocate until you opt in."],
              [ShieldCheck, "Privileged stays private", "Client matter data never reaches a model that trains on it."],
            ].map(([Icon, t, d], i) => {
              const I = Icon as typeof Lock;
              return (
                <div key={i} className="flex gap-3">
                  <I className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                  <div>
                    <p className="text-sm font-semibold text-ink">{t as string}</p>
                    <p className="text-xs text-ink-muted">{d as string}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="eyebrow">For citizens</p>
              <h2 className="mt-2 font-serif text-3xl font-semibold">Three minutes from problem to the right help</h2>
              <ol className="mt-6 space-y-5">
                {[
                  [MessageSquareText, "Tell us what happened", "The assistant identifies the area of law — e.g. a road accident falls under the Motor Vehicles Act, 1988."],
                  [Scale, "Know your rights and next step", "Plain-language rights, the right forum, documents to keep ready and deadlines."],
                  [MapPin, "Connect with a verified advocate near you", "With your consent, a one-line summary reaches BCI-verified advocates at your nearest district court."],
                ].map(([Icon, t, d], i) => {
                  const I = Icon as typeof Scale;
                  return (
                    <li key={i} className="flex gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-saffron-50 text-saffron-700"><I className="h-5 w-5" /></span>
                      <div>
                        <p className="font-semibold">{t as string}</p>
                        <p className="text-sm text-ink-muted">{d as string}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <Link href="/citizen" className="btn-accent mt-8">Describe your problem <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div>
              <p className="eyebrow">For advocates</p>
              <h2 className="mt-2 font-serif text-3xl font-semibold">Intake → research → draft, without a law book</h2>
              <ol className="mt-6 space-y-5">
                {[
                  [Inbox, "Accept a consented lead", "Leads from your 5 nearest district courts become a client + matter in one click."],
                  [Sparkles, "Ask the research copilot", "Grounded answers citing [1] [2] verified authorities, with the passage behind every claim."],
                  [FileSignature, "Generate the first draft", "Notices, complaints and petitions built only on authorities you've verified. You finish the last 20%."],
                ].map(([Icon, t, d], i) => {
                  const I = Icon as typeof Scale;
                  return (
                    <li key={i} className="flex gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><I className="h-5 w-5" /></span>
                      <div>
                        <p className="font-semibold">{t as string}</p>
                        <p className="text-sm text-ink-muted">{d as string}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <Link href="/login?mode=signup" className="btn mt-8">Create your workspace <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
