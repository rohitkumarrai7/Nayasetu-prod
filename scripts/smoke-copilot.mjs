// Live smoke test of the citizen assistant + advocate copilot against a THROWAWAY backend.
import { ConvexHttpClient } from "convex/browser";
const URL = process.env.E2E_CONVEX_URL || "http://127.0.0.1:3210";
const anon = new ConvexHttpClient(URL);
const r = await anon.action("chat:respond", { history: [], message: "A bike hit me near Saket in Delhi and the rider refuses to pay my hospital bills" });
console.log("CITIZEN", r.source, r.modelUsed, r.category, r.location, "|", r.answer.slice(0, 300));
const c = new ConvexHttpClient(URL);
const email = `copilot${Date.now()}@test.in`;
const t = await c.action("auth:signIn", { provider: "password", params: { email, password: "password123", flow: "signUp" } });
c.setAuth(t.tokens.token);
await c.mutation("firms:bootstrap", { firmName: "Smoke & Co" });
await c.action("seed:loadDemoCorpus", {});
async function ask(content, threadId) {
  const { threadId: tid, messageId } = await c.mutation("copilot:send", { content, threadId });
  for (let i = 0; i < 120; i++) {
    const d = await c.query("copilot:messages", { threadId: tid });
    const m = d.messages.find((x) => x._id === messageId);
    if (m.status !== "pending") return { tid, m };
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("timeout");
}
const q1 = await ask("Can the insurer avoid paying a third-party victim if the driver had no valid licence?");
console.log("COPILOT", q1.m.status, q1.m.modelUsed, "fab", q1.m.fabricationRate, "removed", q1.m.removed);
console.log(q1.m.steps.join("\n  > "));
console.log("SOURCES", q1.m.sources.map((s) => `[${s.n}] ${s.caseName}`).join(" | "));
console.log(q1.m.content.slice(0, 1500));
const q2 = await ask("And how is future prospects added to income for a deceased victim?", q1.tid);
console.log("FOLLOWUP", q2.m.status, q2.m.sources.map((s) => s.caseName).join(" | "), "removed", q2.m.removed);
console.log(q2.m.content.slice(0, 800));
