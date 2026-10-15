// The production path: an LLM key IS configured. Groq is mocked at the fetch layer so we can
// prove the assistant (a) uses a good LLM answer, (b) never routes on a hallucinated category,
// and (c) degrades to the deterministic rules on 401 / 429 / timeouts — never a dead end.
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts", "!./http.ts", "!./auth.ts"]);

function groqReturns(body: unknown, status = 200) {
  const fn = vi.fn(async (url: string) => {
    if (!String(url).includes("groq.com")) throw new Error(`unexpected fetch ${url}`);
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}
const groqJson = (obj: unknown) => ({ choices: [{ message: { content: JSON.stringify(obj) } }] });

beforeEach(() => {
  process.env.GROQ_API_KEY = "test-key";
});
afterEach(() => {
  delete process.env.GROQ_API_KEY;
  vi.unstubAllGlobals();
});

describe("citizen chatbot with an LLM configured", () => {
  test("a valid LLM answer is used, with its category", async () => {
    const fetchMock = groqReturns(
      groqJson({
        answer: "Since the scooter was hit, you can claim compensation before the MACT. Get the FIR copy first.",
        category: "motor_vehicle",
        act: "Motor Vehicles Act, 1988",
        location: "",
        summary: "Scooter hit by car; driver refuses to pay",
      }),
    );
    const t = convexTest(schema, modules);
    const r = await t.action(api.chat.respond, { history: [], message: "a car hit my scooter in Pune" });
    expect(r.source).toBe("llm");
    expect(r.category).toBe("motor_vehicle");
    expect(r.answer).toContain("MACT");
    expect(r.location).toBe("Pune"); // gazetteer still resolves location
    // JSON mode requested
    const body = JSON.parse((fetchMock.mock.calls[0] as any)[1].body);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  test("an invented category is not trusted — routing comes from the rules", async () => {
    groqReturns(groqJson({ answer: "This is a vehicle matter, please consult a lawyer soon.", category: "traffic_law", act: "", location: "", summary: "x" }));
    const t = convexTest(schema, modules);
    const r = await t.action(api.chat.respond, { history: [], message: "a truck hit my bike and the driver ran away" });
    expect(r.category).toBe("motor_vehicle");
  });

  test("LLM says 'other' but the rules are confident → keep the domain (panels still show)", async () => {
    groqReturns(groqJson({ answer: "Could you share a bit more about what happened, please?", category: "other", act: "", location: "", summary: "x" }));
    const t = convexTest(schema, modules);
    const r = await t.action(api.chat.respond, { history: [], message: "my landlord won't return my security deposit" });
    expect(r.category).toBe("property");
  });

  test.each([
    ["invalid key (401)", { error: "invalid api key" }, 401],
    ["non-JSON prose", { choices: [{ message: { content: "Sure! Here's some help." } }] }, 200],
  ])("%s → deterministic answer, never the old canned dead-end", async (_n, body, status) => {
    groqReturns(body, status);
    const t = convexTest(schema, modules);
    const r = await t.action(api.chat.respond, { history: [], message: "cheque bounce ho gaya, insufficient funds" });
    expect(r.source).toBe("rules");
    expect(r.category).toBe("cheque_bounce");
    expect(r.answer).toMatch(/Negotiable Instruments Act/);
  });

  test("rate limited (429) is retried, then falls back", async () => {
    const fn = groqReturns({ error: "rate limited" }, 429);
    const t = convexTest(schema, modules);
    const r = await t.action(api.chat.respond, { history: [], message: "OTP fraud, money deducted via UPI" });
    expect(r.category).toBe("cyber");
    expect(r.source).toBe("rules");
    expect(fn.mock.calls.length).toBe(3); // bounded retries
  }, 15000);
});
