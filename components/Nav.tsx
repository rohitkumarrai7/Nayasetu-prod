"use client";

// Public site header (citizens + marketing). Advocates get the workspace shell (AppShell) instead.
import { Authenticated, Unauthenticated } from "convex/react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Logo from "./Logo";

const LINKS = [
  { href: "/citizen", label: "Get legal help" },
  { href: "/marketplace", label: "Find an advocate" },
  { href: "/updates", label: "Legal updates" },
];

export default function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => path === href || path?.startsWith(href + "/");
  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-line/80 bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Logo />
        <nav className="hidden items-center gap-1 text-sm md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 transition ${isActive(l.href) ? "bg-white font-semibold text-brand shadow-card" : "text-ink-soft hover:text-brand"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Authenticated>
            <Link href="/dashboard" className="btn">Open workspace →</Link>
          </Authenticated>
          <Unauthenticated>
            <Link href="/login" className="text-sm font-medium text-ink-soft hover:text-brand">Advocate sign in</Link>
            <Link href="/login?mode=signup" className="btn">Join as advocate</Link>
          </Unauthenticated>
        </div>
        <button className="ml-auto rounded-lg p-2 text-ink md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-line bg-paper px-4 pb-4 md:hidden">
          <nav className="flex flex-col py-2">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm ${isActive(l.href) ? "bg-white font-semibold text-brand" : "text-ink-soft"}`}>
                {l.label}
              </Link>
            ))}
          </nav>
          <Authenticated>
            <Link href="/dashboard" className="btn w-full">Open workspace →</Link>
          </Authenticated>
          <Unauthenticated>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/login" className="btn-ghost">Sign in</Link>
              <Link href="/login?mode=signup" className="btn">Join as advocate</Link>
            </div>
          </Unauthenticated>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line bg-paper-dark/60">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-ink-muted sm:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-xs leading-relaxed">
            Legal information, not legal advice. NyayaSetu connects you with BCI-verified advocates only with your
            explicit consent.
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-ink">For citizens</p>
          <Link href="/citizen" className="block hover:text-brand">Ask the legal assistant</Link>
          <Link href="/marketplace" className="block hover:text-brand">Verified advocate directory</Link>
          <Link href="/updates" className="block hover:text-brand">Legal updates</Link>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-ink">For advocates</p>
          <Link href="/login?mode=signup" className="block hover:text-brand">Create a workspace</Link>
          <Link href="/login" className="block hover:text-brand">Sign in</Link>
          <p className="text-xs">Emergency 112 · Women 181 · Cyber fraud 1930</p>
        </div>
      </div>
    </footer>
  );
}
