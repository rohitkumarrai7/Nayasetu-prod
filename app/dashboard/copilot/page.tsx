"use client";

import { useMutation, useQuery } from "convex/react";
import { Briefcase, MessageSquarePlus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import AppShell, { useWorkspace } from "@/components/AppShell";
import Copilot from "@/components/Copilot";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { timeAgo } from "@/lib/client";

export default function CopilotPage() {
  return (
    <AppShell wide>
      <Suspense>
        <CopilotScreen />
      </Suspense>
    </AppShell>
  );
}

function CopilotScreen() {
  const ws = useWorkspace();
  const router = useRouter();
  const params = useSearchParams();
  const threadId = (params.get("t") as Id<"copilotThreads"> | null) ?? null;
  const threads = useQuery(api.copilot.threads, {});
  const remove = useMutation(api.copilot.deleteThread);
  const open = (id: string | null) => router.replace(id ? `/dashboard/copilot?t=${id}` : "/dashboard/copilot");

  return (
    <div className="flex h-[calc(100dvh-7rem)] gap-5 lg:h-[calc(100dvh-4rem)]">
      <aside className="hidden w-64 shrink-0 flex-col lg:flex">
        <button className="btn w-full" onClick={() => open(null)}>
          <MessageSquarePlus className="h-4 w-4" /> New research
        </button>
        <p className="mb-1 mt-5 px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">History</p>
        <div className="-mx-1 flex-1 space-y-0.5 overflow-y-auto px-1">
          {threads?.length === 0 && <p className="px-2 py-2 text-xs text-ink-muted">Your research conversations appear here.</p>}
          {threads?.map((t) => (
            <div key={t._id} className={`group flex items-center gap-1 rounded-lg ${t._id === threadId ? "bg-white shadow-card" : "hover:bg-paper-dark"}`}>
              <button onClick={() => open(t._id)} className="min-w-0 flex-1 px-2.5 py-2 text-left">
                <p className="truncate text-sm text-ink">{t.title}</p>
                <p className="flex items-center gap-1 truncate text-[11px] text-ink-muted">
                  {"matterTitle" in t && t.matterTitle ? <><Briefcase className="h-3 w-3" /> {t.matterTitle as string} · </> : null}
                  {timeAgo(t.updatedAt)}
                </p>
              </button>
              <button
                className="mr-1 rounded p-1 text-ink-muted opacity-0 hover:text-red-600 group-hover:opacity-100"
                onClick={async () => { await remove({ threadId: t._id }); if (t._id === threadId) open(null); }}
                aria-label="Delete conversation"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col rounded-2xl border border-line bg-white/60 px-3 pb-3 sm:px-5">
        <div className="flex items-center justify-between border-b border-line py-3">
          <div>
            <p className="eyebrow">Research copilot</p>
            <p className="text-xs text-ink-muted">Grounded in the verified judgment corpus · citations checked before display</p>
          </div>
          <button className="btn-ghost btn-sm lg:hidden" onClick={() => open(null)}><MessageSquarePlus className="h-3.5 w-3.5" /> New</button>
        </div>
        <Copilot key={threadId ?? "new"} threadId={threadId} onThread={(id) => open(id)} firmId={ws.firmId} />
      </section>
    </div>
  );
}
