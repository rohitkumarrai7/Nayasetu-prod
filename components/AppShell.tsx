"use client";

// Advocate workspace shell (Side A): auth gate → firm onboarding → sidebar layout.
// Every /dashboard and /admin page renders inside this, and reads the firm via useWorkspace().
import { useAuthActions } from "@convex-dev/auth/react";
import { AuthLoading, Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import {
  Briefcase, Inbox, LayoutDashboard, LogOut, Menu, Newspaper, Scale, ShieldCheck, Sparkles, UserRound, Users, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, ReactNode, useContext, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { errMsg } from "@/lib/client";
import AuthForm from "./AuthForm";
import Logo from "./Logo";

export interface Workspace {
  firmId: Id<"firms">;
  firmName: string;
  email: string | null;
  role: string | null;
}

const Ctx = createContext<Workspace | null>(null);
export function useWorkspace(): Workspace {
  const w = useContext(Ctx);
  if (!w) throw new Error("useWorkspace outside AppShell");
  return w;
}

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/copilot", label: "Research copilot", icon: Sparkles },
  { href: "/dashboard/matters", label: "Matters", icon: Briefcase },
  { href: "/dashboard/clients", label: "Clients", icon: Users },
  { href: "/dashboard/leads", label: "Client leads", icon: Inbox },
  { href: "/dashboard/profile", label: "Advocate profile", icon: UserRound },
];

export default function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <>
      <AuthLoading>
        <FullScreenLoader />
      </AuthLoading>
      <Unauthenticated>
        <div className="flex min-h-[100dvh] items-center justify-center bg-paper px-4 py-10">
          <div className="w-full max-w-sm">
            <div className="mb-6 flex justify-center"><Logo sub="Advocate workspace" /></div>
            <AuthForm />
          </div>
        </div>
      </Unauthenticated>
      <Authenticated>
        <Gate wide={wide}>{children}</Gate>
      </Authenticated>
    </>
  );
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-paper">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand/20 border-t-brand" />
    </div>
  );
}

function Gate({ children, wide }: { children: ReactNode; wide: boolean }) {
  const me = useQuery(api.firms.me);
  if (me === undefined) return <FullScreenLoader />;
  if (!me?.firmId) return <CreateFirm email={me?.email ?? null} />;
  const ws: Workspace = { firmId: me.firmId, firmName: me.firmName ?? "My firm", email: me.email, role: me.role };
  return (
    <Ctx.Provider value={ws}>
      <Layout wide={wide}>{children}</Layout>
    </Ctx.Provider>
  );
}

function Layout({ children, wide }: { children: ReactNode; wide: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-[100dvh] bg-paper">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-[100dvh] w-64 shrink-0 flex-col border-r border-line bg-white/70 lg:flex">
        <Sidebar onNavigate={() => {}} />
      </aside>
      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-lift">
            <button className="absolute right-3 top-4 rounded-lg p-1.5 text-ink-muted" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-paper/90 px-4 backdrop-blur lg:hidden">
          <button className="rounded-lg p-1.5 text-ink" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <Logo href="/dashboard" />
        </header>
        <main className={`mx-auto w-full flex-1 px-4 py-6 sm:px-6 lg:py-8 ${wide ? "max-w-[1400px]" : "max-w-6xl"}`}>{children}</main>
      </div>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const path = usePathname();
  const ws = useWorkspace();
  const isAdmin = useQuery(api.admin.amIAdmin);
  const leads = useQuery(api.leads.feed, {});
  const { signOut } = useAuthActions();
  const newLeads = leads?.leads.filter((l) => !l.myAction).length ?? 0;
  const active = (href: string, exact?: boolean) => (exact ? path === href : path === href || path?.startsWith(href + "/"));
  const item = (href: string, label: string, Icon: typeof Scale, exact?: boolean, badge?: number) => (
    <Link
      key={href}
      href={href}
      onClick={onNavigate}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
        active(href, exact) ? "bg-brand text-white shadow-sm" : "text-ink-soft hover:bg-paper-dark hover:text-ink"
      }`}
    >
      <Icon className={`h-4 w-4 ${active(href, exact) ? "text-saffron-100" : "text-ink-muted group-hover:text-brand"}`} />
      <span className="flex-1">{label}</span>
      {!!badge && <span className="rounded-full bg-saffron px-1.5 text-[11px] font-semibold text-white">{badge}</span>}
    </Link>
  );
  return (
    <>
      <div className="px-5 pb-4 pt-5">
        <Logo href="/dashboard" sub="Advocate workspace" />
      </div>
      <div className="mx-3 mb-3 rounded-xl border border-line bg-paper px-3 py-2.5">
        <p className="truncate text-sm font-semibold text-ink">{ws.firmName}</p>
        <p className="truncate text-xs text-ink-muted">{ws.email}</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV.map((n) => item(n.href, n.label, n.icon, n.exact, n.href === "/dashboard/leads" ? newLeads : undefined))}
        <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Knowledge</p>
        {item("/updates", "Legal updates", Newspaper)}
        {isAdmin && (
          <>
            <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Platform</p>
            {item("/admin", "Admin & verification", ShieldCheck)}
          </>
        )}
      </nav>
      <div className="border-t border-line p-3">
        <Link href="/citizen" onClick={onNavigate} className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs text-ink-muted hover:text-brand">
          <Scale className="h-4 w-4" /> View citizen portal
        </Link>
        <button onClick={() => void signOut()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-soft hover:bg-paper-dark">
          <LogOut className="h-4 w-4 text-ink-muted" /> Sign out
        </button>
      </div>
    </>
  );
}

function CreateFirm({ email }: { email: string | null }) {
  const bootstrap = useMutation(api.firms.bootstrap);
  const { signOut } = useAuthActions();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-paper px-4">
      <form
        className="card w-full max-w-md space-y-4 p-7"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await bootstrap({ firmName: name.trim() || "My Chambers" });
          } catch (err) {
            setError(errMsg(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Logo sub="Advocate workspace" />
        <div>
          <p className="eyebrow">Step 1 of 2</p>
          <h1 className="mt-1 font-serif text-2xl font-semibold">Name your chambers</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Your matters, clients and research stay private to this workspace{email ? ` (${email})` : ""}.
          </p>
        </div>
        <input className="input" autoFocus placeholder="e.g. Sharma & Associates" value={name} onChange={(e) => setName(e.target.value)} />
        {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <button className="btn w-full" disabled={busy}>{busy ? "Creating…" : "Create workspace"}</button>
        <button type="button" className="w-full text-center text-xs text-ink-muted hover:text-brand" onClick={() => void signOut()}>
          Use a different account
        </button>
      </form>
    </div>
  );
}

/** Page header used across the workspace. */
export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
