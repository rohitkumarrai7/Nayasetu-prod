import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { complete, hasLiveProvider } from "./llm";

const KEYS = ["GROQ_API_KEY", "GEMINI_API_KEY", "GEMINI_PAID_API_KEY", "GEMINI_FREE_API_KEY", "GEMINI_ALLOW_PRIVILEGED"];
let saved: Record<string, string | undefined>;
const realFetch = globalThis.fetch;

beforeEach(() => {
  saved = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  globalThis.fetch = realFetch;
});

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("sensitivity routing (§6)", () => {
  it("privileged with only a FREE gemini key never uses it — falls back to offline echo", async () => {
    process.env.GEMINI_FREE_API_KEY = "FREE";
    const spy = vi.fn();
    globalThis.fetch = spy as any;
    const res = await complete("privileged", "", "some privileged matter facts");
    expect(res.trainedOn).toBe(false);
    expect(res.provider).toBe("echo");
    expect(spy).not.toHaveBeenCalled();
    expect(hasLiveProvider("privileged")).toBe(false);
  });

  it("general with a free gemini key uses it (marked trainedOn), key sent in a header", async () => {
    process.env.GEMINI_FREE_API_KEY = "FREE";
    const spy = vi.fn(async (url: string, init: any) => {
      expect(url).not.toContain("key=");
      expect(init.headers["x-goog-api-key"]).toBe("FREE");
      return ok({ candidates: [{ content: { parts: [{ text: "hello" }] } }] });
    });
    globalThis.fetch = spy as any;
    const res = await complete("general", "", "what is deficiency in service");
    expect(res.provider).toBe("gemini-free");
    expect(res.trainedOn).toBe(true);
    expect(res.text).toBe("hello");
  });

  it("a bad key (401) fails fast to the next provider without retry storms", async () => {
    process.env.GROQ_API_KEY = "BAD";
    const spy = vi.fn(async () => new Response("invalid api key", { status: 401 }));
    globalThis.fetch = spy as any;
    const res = await complete("general", "", "q");
    expect(res.provider).toBe("echo");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("a hung provider times out and falls through", async () => {
    process.env.GROQ_API_KEY = "SLOW";
    globalThis.fetch = ((_u: string, init: any) =>
      new Promise((_r, rej) => init.signal.addEventListener("abort", () => rej(new Error("aborted"))))) as any;
    const t0 = Date.now();
    const res = await complete("general", "", "q", { timeoutMs: 200 });
    expect(res.provider).toBe("echo");
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it("offline echo stays grounded to the CONTEXT block", async () => {
    const res = await complete("privileged", "sys", "Summarize.\n\nCONTEXT:\nThe insurer is liable under the Act.");
    expect(res.provider).toBe("echo");
    expect(res.text).toContain("insurer is liable");
  });

  it("GEMINI_API_KEY is not used for privileged unless GEMINI_ALLOW_PRIVILEGED=true", async () => {
    process.env.GEMINI_API_KEY = "SINGLE";
    const res = await complete("privileged", "", "privileged facts");
    expect(res.provider).toBe("echo");
  });
});
