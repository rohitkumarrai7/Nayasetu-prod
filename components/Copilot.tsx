"use client";

import { useMutation, useQuery } from "convex/react";
import {
  ArrowUp, BookmarkPlus, Check, CheckCircle2, ChevronDown, Copy, ExternalLink, Loader2, ShieldCheck, Sparkles, TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { errMsg } from "@/lib/client";
import Markdown from "./Markdown";

type Message = Doc<"copilotMessages">;

const GENERAL_SUGGESTIONS = [
  "Can an insurer avoid paying a third-party accident victim if the driver had no valid licence?",
  "Is registration of an FIR mandatory when a cognizable offence is disclosed?",
  "What must a wife disclose when claiming maintenance, and from when is it payable?",
  "Is a Section 65B certificate mandatory for WhatsApp and CCTV evidence?",
  "When can a tenant be evicted for the landlord's bona fide need?",
  "Where can a cheque-bounce complaint under Section 138 be filed?",
];

export default function Copilot({
  threadId,
  onThread,
  matterId,
  firmId,
  suggestions,
  compact = false,
}: {
  threadId: Id<"copilotThreads"> | null;
  onThread: (id: Id<"copilotThreads">) => void;
  matterId?: Id<"matters">;
  firmId: Id<"firms">;
  suggestions?: string[];
  compact?: boolean;
}) {
  const data = useQuery(api.copilot.messages, threadId ? { threadId } : "skip");
  const send = useMutation(api.copilot.send);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = data?.messages ?? [];
  const pending = messages.some((m) => m.status === "pending");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.steps.length, messages[messages.length - 1]?.status]);

  async function ask(text?: string) {
    const content = (text ?? input).trim();
    if (!content || pending || sending) return;
    setError(null);
    setSending(true);
    setInput("");
    try {
      const r = await send({ content, threadId: threadId ?? undefined, matterId: threadId ? undefined : matterId });
      if (r.threadId !== threadId) onThread(r.threadId);
    } catch (e) {
      setError(errMsg(e));
      setInput(content);
    } finally {
      setSending(false);
    }
  }

  const sugg = suggestions?.length ? suggestions : GENERAL_SUGGESTIONS;

  return (
    <div className={`flex min-h-0 flex-col ${compact ? "h-[640px]" : "h-full"}`}>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-1 py-4">
        {!threadId || (data && messages.length === 0) ? (
          <div className="mx-auto max-w-2xl pt-4 text-center sm:pt-10">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-saffron-100"><Sparkles className="h-6 w-6" /></span>
            <h2 className="mt-4 font-serif text-2xl font-semibold">{matterId ? "Research this matter" : "What are you researching?"}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
              Answers cite only judgments retrieved from the verified corpus. Any case or citation the model mentions that
              can&apos;t be verified is removed before you see it.
            </p>
            <div className="mt-6 grid gap-2 text-left sm:grid-cols-2">
              {sugg.slice(0, 6).map((s) => (
                <button key={s} onClick={() => void ask(s)} className="rounded-xl border border-line bg-white px-3.5 py-3 text-sm text-ink-soft shadow-card transition hover:border-brand/30 hover:text-brand">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : data === undefined ? (
          <div className="mx-auto max-w-3xl space-y-3 pt-4">
            <div className="skeleton h-10 w-2/3" />
            <div className="skeleton h-32 w-full" />
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m._id} className="flex justify-end animate-fade-up">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[15px] text-white">{m.content}</div>
                </div>
              ) : (
                <Answer key={m._id} m={m} matterId={matterId ?? data?.thread.matterId} firmId={firmId} />
              ),
            )}
          </div>
        )}
      </div>

      <div className="pt-2">
        <div className="mx-auto max-w-3xl">
          {error && <p className="mb-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          <div className="flex items-end gap-2 rounded-2xl border border-line bg-white p-2 shadow-card focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/10">
            <textarea
              className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] outline-none placeholder:text-ink-muted/70"
              rows={1}
              maxLength={4000}
              placeholder={threadId ? "Ask a follow-up…" : "Ask a legal research question…"}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask();
                }
              }}
            />
            <button className="btn h-10 w-10 shrink-0 rounded-xl p-0" disabled={pending || sending || !input.trim()} onClick={() => void ask()} aria-label="Ask">
              {pending || sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-ink-muted">
            Privileged route: matter data only reaches no-training models · Research aid — verify before filing
          </p>
        </div>
      </div>
    </div>
  );
}

function LiveSteps({ steps }: { steps: string[] }) {
  return (
    <ul className="space-y-1.5 rounded-xl border border-line bg-white px-4 py-3 text-sm shadow-card">
      {steps.map((s, i) => (
        <li key={i} className={`flex items-center gap-2 ${i === steps.length - 1 ? "text-ink" : "text-ink-muted"}`}>
          {i === steps.length - 1 ? <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" /> : <Check className="h-3.5 w-3.5 text-emerald-600" />}
          {s}
        </li>
      ))}
    </ul>
  );
}

function Answer({ m, matterId, firmId }: { m: Message; matterId?: Id<"matters">; firmId: Id<"firms"> }) {
  const [active, setActive] = useState<number | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [copied, setCopied] = useState(false);
  const pending = m.status === "pending";
  const sources = m.sources ?? [];

  if (m.status === "error") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <TriangleAlert className="h-4 w-4" /> {m.content}
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-fade-up">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-saffron-100"><Sparkles className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1 space-y-3">
        {pending ? (
          <LiveSteps steps={m.steps} />
        ) : (
          <>
            <button onClick={() => setShowSteps((s) => !s)} className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-brand">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              {m.steps.length} research steps
              <ChevronDown className={`h-3 w-3 transition ${showSteps ? "rotate-180" : ""}`} />
            </button>
            {showSteps && (
              <ul className="space-y-1 rounded-xl bg-paper-dark/60 px-3 py-2 text-xs text-ink-muted">
                {m.steps.map((s, i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 h-3 w-3 text-emerald-600" />{s}</li>)}
              </ul>
            )}
            {sources.length > 0 && (
              <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {sources.map((s) => (
                  <button
                    key={s.n}
                    onClick={() => setActive(active === s.n ? null : s.n)}
                    className={`w-52 shrink-0 rounded-xl border p-2.5 text-left transition ${active === s.n ? "border-brand bg-brand-50" : "border-line bg-white hover:border-brand/30"}`}
                  >
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-brand">
                      <span className="flex h-4 w-4 items-center justify-center rounded bg-brand text-[10px] text-white">{s.n}</span>
                      {s.citationString || "Verified source"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs font-medium text-ink">{s.caseName}</p>
                  </button>
                ))}
              </div>
            )}
            {active !== null && sources.find((s) => s.n === active) && <SourcePassage s={sources.find((s) => s.n === active)!} />}
            <Markdown text={m.content} onCite={(n) => setActive(n)} maxCite={sources.length} />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="badge-verified"><ShieldCheck className="h-3 w-3" /> 0 unverified citations shown</span>
              {!!m.removed?.length && (
                <span className="badge bg-amber-50 text-amber-800" title={m.removed.join("; ")}>
                  {m.removed.length} unverified reference{m.removed.length > 1 ? "s" : ""} removed
                </span>
              )}
              {m.modelUsed && <span className="badge">{m.modelUsed.replace(/^groq:/, "")}</span>}
              <div className="ml-auto flex items-center gap-1">
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => { void navigator.clipboard.writeText(m.content); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
                </button>
                <SaveToMatter m={m} matterId={matterId} firmId={firmId} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SourcePassage({ s }: { s: NonNullable<Message["sources"]>[number] }) {
  return (
    <div className="rounded-xl border border-brand/20 bg-brand-50/50 p-3.5 text-sm animate-fade-up">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-ink">[{s.n}] {s.caseName}{s.citationString ? <span className="font-normal text-ink-muted"> — {s.citationString}</span> : null}</p>
        {s.sourceUrl && (
          <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs text-brand hover:underline">
            Source <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <p className="mt-2 border-l-2 border-saffron/60 pl-3 text-[13px] leading-relaxed text-ink-soft">{s.passage}</p>
      <p className="mt-2 text-[11px] text-emerald-700">✓ Verified in corpus via {s.matchMethod}</p>
    </div>
  );
}

function SaveToMatter({ m, matterId, firmId }: { m: Message; matterId?: Id<"matters">; firmId: Id<"firms"> }) {
  const save = useMutation(api.copilot.saveToMatter);
  const matters = useQuery(api.crm.listMatters, matterId ? "skip" : { firmId });
  const [pick, setPick] = useState(false);
  const [state, setState] = useState<{ ok: boolean; text: string; matterId?: string } | null>(null);

  async function doSave(target?: Id<"matters">) {
    try {
      const r = await save({ messageId: m._id, matterId: target });
      setState({ ok: true, text: "Saved as brief", matterId: r.matterId });
      setPick(false);
    } catch (e) {
      setState({ ok: false, text: errMsg(e) });
    }
  }

  if (m.briefId || state?.ok) {
    const mid = state?.matterId ?? matterId;
    return mid ? (
      <Link href={`/dashboard/matter/${mid}?tab=draft`} className="btn-ghost btn-sm text-emerald-700"><Check className="h-3.5 w-3.5" /> Saved · Draft →</Link>
    ) : (
      <span className="badge-verified"><Check className="h-3 w-3" /> Saved</span>
    );
  }
  return (
    <div className="relative">
      <button className="btn btn-sm" onClick={() => (matterId ? void doSave() : setPick((p) => !p))}>
        <BookmarkPlus className="h-3.5 w-3.5" /> Save to matter
      </button>
      {pick && (
        <div className="absolute bottom-full right-0 z-20 mb-2 w-72 rounded-xl border border-line bg-white p-2 shadow-lift">
          <p className="px-2 py-1 text-xs font-semibold text-ink-muted">Save this research as a brief on…</p>
          <div className="max-h-56 overflow-y-auto">
            {matters?.length === 0 && <p className="px-2 py-2 text-xs text-ink-muted">No matters yet — create one under Matters.</p>}
            {matters?.map((mt) => (
              <button key={mt._id} onClick={() => void doSave(mt._id)} className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm hover:bg-paper-dark">
                {mt.title} <span className="text-xs text-ink-muted">· {mt.clientName}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {state && !state.ok && <p className="absolute right-0 top-full mt-1 w-60 text-right text-xs text-red-600">{state.text}</p>}
    </div>
  );
}
