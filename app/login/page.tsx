"use client";

import { useConvexAuth } from "convex/react";
import { BadgeCheck, FileText, Inbox, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import AuthForm from "@/components/AuthForm";
import Logo from "@/components/Logo";

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    if (isAuthenticated) router.replace(params.get("next") || "/dashboard");
  }, [isAuthenticated, router, params]);

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand-900 p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-saffron/20 blur-3xl" />
        <div className="rounded-xl bg-white/95 p-2 self-start"><Logo /></div>
        <div className="mt-auto max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-saffron-500">For advocates</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight text-white">
            From a client&apos;s raw problem to a research-backed draft.
          </h1>
          <ul className="mt-8 space-y-4 text-sm text-white/80">
            {[
              [Inbox, "Consented client leads near your home courts"],
              [Sparkles, "A research copilot that only cites verified judgments"],
              [FileText, "First drafts grounded in the authorities you approve"],
              [BadgeCheck, "BCI verification — listed only when it's real"],
            ].map(([Icon, t], i) => {
              const I = Icon as typeof Inbox;
              return (
                <li key={i} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10"><I className="h-4 w-4 text-saffron-500" /></span>
                  {t as string}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="flex items-center justify-center bg-paper px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden"><Logo sub="Advocate workspace" /></div>
          <AuthForm initialFlow={params.get("mode") === "signup" ? "signUp" : "signIn"} />
          <p className="mt-4 text-center text-xs text-ink-muted">
            Need legal help instead? <a href="/citizen" className="font-medium text-brand underline">Ask the assistant — no account needed</a>
          </p>
        </div>
      </div>
    </div>
  );
}
