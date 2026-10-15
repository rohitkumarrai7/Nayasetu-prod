// Sensitivity-aware LLM routing (§6).
// Hard invariant: a PRIVILEGED request can never reach a training-enabled (free-tier) endpoint.
//
// Providers, in preference order:
//   Groq   (GROQ_API_KEY)          - OpenAI-compatible; inference-only (does not train on API
//                                    data), so usable for BOTH privileged and general.
//   Gemini paid (GEMINI_PAID_API_KEY | GEMINI_API_KEY+GEMINI_ALLOW_PRIVILEGED) - no training.
//   Gemini free (GEMINI_FREE_API_KEY | GEMINI_API_KEY) - TRAINS; general/citizen only.
//   echo   (offline, grounded)     - never leaves the process; safe for any sensitivity.
export type Sensitivity = "privileged" | "general";

export interface LlmResult {
  text: string;
  model: string;
  provider: string;
  trainedOn: boolean;
}

export interface CompleteOptions {
  /** Ask the provider for a JSON object response (Groq json_object / Gemini application/json). */
  json?: boolean;
  /** Per-attempt timeout. A hung provider must never block the user — we fall to the next one. */
  timeoutMs?: number;
  maxTokens?: number;
}

const DEFAULT_TIMEOUT_MS = 25_000;

/** True when at least one real (network) provider is configured for this sensitivity. */
export function hasLiveProvider(sensitivity: Sensitivity): boolean {
  return (sensitivity === "privileged" ? privilegedChain() : generalChain()).some((p) => p.name !== "echo");
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    const err = new Error(
      ctrl.signal.aborted ? `timeout after ${timeoutMs}ms` : `network error: ${String(e)}`,
    ) as Error & { status: number };
    err.status = ctrl.signal.aborted ? 408 : 0;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const GEMINI_MODEL = () => process.env.GEMINI_MODEL || "gemini-flash-latest";
const GROQ_MODEL = () => process.env.GROQ_MODEL || "openai/gpt-oss-120b";
// Groq retires models (llama-3.3-70b-versatile was withdrawn → every call 404'd and the app
// silently fell back to rules). If the configured model is gone, try these before giving up.
const GROQ_FALLBACK_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];
const groqModels = () => [...new Set([GROQ_MODEL(), ...GROQ_FALLBACK_MODELS])];
const isModelGone = (e: unknown) => {
  const status = (e as { status?: number })?.status ?? 0;
  return status === 404 || (status === 400 && /model|decommission/i.test(String(e)));
};

// Bounded retry: only rate limits (429) and server errors (5xx) are retried, at most twice, so a
// failing provider costs seconds, not a minute. Network errors / timeouts / 4xx (bad key, bad
// model name) fail fast to the next provider in the chain.
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const status = (e as { status?: number })?.status ?? 0;
      const retryable = status === 429 || status >= 500;
      if (!retryable || attempt === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 600 + Math.random() * 300));
    }
  }
  throw lastErr;
}

/** Calls Groq, falling through retired models. Returns the text and the model that answered. */
async function callGroq(
  apiKey: string,
  system: string,
  prompt: string,
  opts: CompleteOptions,
): Promise<{ text: string; model: string }> {
  let lastErr: unknown;
  for (const model of groqModels()) {
    try {
      return { text: await callGroqModel(apiKey, model, system, prompt, opts), model };
    } catch (e) {
      lastErr = e;
      if (!isModelGone(e)) throw e;
      console.warn(`[llm] groq model ${model} unavailable, trying next: ${String(e).slice(0, 160)}`);
    }
  }
  throw lastErr;
}

async function callGroqModel(
  apiKey: string,
  model: string,
  system: string,
  prompt: string,
  opts: CompleteOptions,
): Promise<string> {
  return withRetry(async () => {
    const messages = [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content: prompt },
    ];
    const body: Record<string, unknown> = { model, messages, temperature: 0.2 };
    if (opts.json) body.response_format = { type: "json_object" };
    // Reasoning models spend completion tokens on hidden reasoning; keep it short so the visible
    // answer fits the budget and latency stays chat-like.
    const reasoning = /gpt-oss/.test(model);
    if (reasoning) body.reasoning_effort = "low";
    if (opts.maxTokens) body.max_completion_tokens = reasoning ? opts.maxTokens + 600 : opts.maxTokens;
    const res = await fetchWithTimeout(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      },
      opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    if (!res.ok) {
      const err = new Error(`groq ${res.status}: ${await res.text()}`) as Error & { status: number };
      err.status = res.status;
      throw err;
    }
    const data = (await res.json()) as any;
    const text = data?.choices?.[0]?.message?.content ?? "";
    if (!text) throw Object.assign(new Error("groq: empty response"), { status: 502 });
    return text;
  });
}

async function callGemini(apiKey: string, system: string, prompt: string, opts: CompleteOptions): Promise<string> {
  return withRetry(async () => {
    const model = GEMINI_MODEL();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const payload: Record<string, unknown> = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    };
    if (system) payload.systemInstruction = { parts: [{ text: system }] };
    const generationConfig: Record<string, unknown> = { temperature: 0.2 };
    if (opts.json) generationConfig.responseMimeType = "application/json";
    if (opts.maxTokens) generationConfig.maxOutputTokens = opts.maxTokens;
    payload.generationConfig = generationConfig;
    // Key in a header (not the query string) so it never lands in proxy/access logs.
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(payload),
      },
      opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    if (!res.ok) {
      const err = new Error(`gemini ${res.status}: ${await res.text()}`) as Error & { status: number };
      err.status = res.status;
      throw err;
    }
    const data = (await res.json()) as any;
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p: { text?: string }) => p.text ?? "").join("");
    if (!text) throw Object.assign(new Error("gemini: empty response"), { status: 502 });
    return text;
  });
}

// Offline fallback that stays grounded: surfaces the CONTEXT block only, never invents facts.
function groundedEcho(prompt: string): string {
  const marker = "CONTEXT:\n";
  const idx = prompt.indexOf(marker);
  if (idx >= 0) {
    return (
      "[offline-grounded output — set GROQ_API_KEY or a Gemini key for full generation]\n\n" +
      prompt.slice(idx + marker.length).trim().slice(0, 4000)
    );
  }
  return "[offline-grounded response — no LLM key configured]";
}

interface Provider {
  name: string;
  trainedOn: boolean;
  model: string;
  run: (system: string, prompt: string, opts: CompleteOptions) => Promise<string | { text: string; model: string }>;
}

function privilegedChain(): Provider[] {
  const chain: Provider[] = [];
  if (process.env.GROQ_API_KEY) {
    const key = process.env.GROQ_API_KEY;
    chain.push({ name: "groq", trainedOn: false, model: GROQ_MODEL(), run: (s, p, o) => callGroq(key, s, p, o) });
  }
  const paid =
    process.env.GEMINI_PAID_API_KEY ||
    (process.env.GEMINI_ALLOW_PRIVILEGED === "true" ? process.env.GEMINI_API_KEY : undefined);
  if (paid) {
    chain.push({ name: "gemini-paid", trainedOn: false, model: GEMINI_MODEL(), run: (s, p, o) => callGemini(paid, s, p, o) });
  }
  chain.push({ name: "echo", trainedOn: false, model: "echo", run: async (_s, p) => groundedEcho(p) });
  return chain;
}

function generalChain(): Provider[] {
  const chain: Provider[] = [];
  if (process.env.GROQ_API_KEY) {
    const key = process.env.GROQ_API_KEY;
    chain.push({ name: "groq", trainedOn: false, model: GROQ_MODEL(), run: (s, p, o) => callGroq(key, s, p, o) });
  }
  const gkey = process.env.GEMINI_FREE_API_KEY || process.env.GEMINI_API_KEY;
  if (gkey) {
    const trainedOn = !process.env.GEMINI_PAID_API_KEY;
    chain.push({ name: "gemini-free", trainedOn, model: GEMINI_MODEL(), run: (s, p, o) => callGemini(gkey, s, p, o) });
  }
  chain.push({ name: "echo", trainedOn: false, model: "echo", run: async (_s, p) => groundedEcho(p) });
  return chain;
}

export async function complete(
  sensitivity: Sensitivity,
  system: string,
  prompt: string,
  opts: CompleteOptions = {},
): Promise<LlmResult> {
  const chain = sensitivity === "privileged" ? privilegedChain() : generalChain();
  // Invariant: privileged chain must contain no training-enabled provider.
  if (sensitivity === "privileged" && chain.some((p) => p.trainedOn)) {
    throw new Error("privileged chain contains a training-enabled provider");
  }
  let lastErr: unknown;
  for (const p of chain) {
    try {
      const out = await p.run(system, prompt, opts);
      const { text, model } = typeof out === "string" ? { text: out, model: p.model } : out;
      return { text, model, provider: p.name, trainedOn: p.trainedOn };
    } catch (e) {
      lastErr = e;
      // Visible in the Convex dashboard logs — the #1 way to diagnose a bad/expired key.
      console.warn(`[llm] provider ${p.name} failed: ${String(e).slice(0, 300)}`);
    }
  }
  throw new Error(`all LLM providers failed: ${lastErr}`);
}
