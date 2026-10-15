"use client";

import type { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import { STATUS_META } from "@/lib/client";

export function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.intake;
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>;
}

export function Empty({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line px-4 py-8 text-center">
      <Icon className="h-6 w-6 text-ink-muted" />
      <p className="mt-2 text-sm font-medium text-ink">{title}</p>
      <p className="mt-0.5 max-w-xs text-xs text-ink-muted">{text}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function initials(name: string) {
  return name.replace(/^Adv\.?\s*/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}
