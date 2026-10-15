import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { DEMO_CORPUS } from "./lib/demoData";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts", "!./http.ts", "!./auth.ts"]);

async function firmUser(t: ReturnType<typeof convexTest>, email: string) {
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email });
    const firmId = await ctx.db.insert("firms", { name: `${email} firm`, ownerUserId: userId, plan: "basic" });
    await ctx.db.insert("memberships", { userId, firmId, role: "firm_admin" });
    const clientId = await ctx.db.insert("clients", { firmId, name: "Ravi", createdBy: userId });
    const matterId = await ctx.db.insert("matters", {
      firmId,
      clientId,
      title: "Accident claim",
      category: "motor_vehicle",
      subcategory: "injury_compensation",
      summaryText: "Client injured by an uninsured driver without a licence.",
      status: "intake",
      createdBy: userId,
    });
    return { userId, firmId, matterId };
  });
  return { ...ids, as: t.withIdentity({ subject: `${ids.userId}|s` }) };
}

async function settle(t: ReturnType<typeof convexTest>) {
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

describe("advocate research copilot", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("answers offline from the corpus only, with numbered verified sources", async () => {
    const t = convexTest(schema, modules);
    const { as } = await firmUser(t, "a@firm.test");
    await t.action(internal.ingest.ingestRecords, { records: DEMO_CORPUS });
    const { threadId, messageId } = await as.mutation(api.copilot.send, {
      content: "Can the insurer avoid liability when the driver had no valid driving licence?",
    });
    await settle(t);
    const d = await as.query(api.copilot.messages, { threadId });
    const m = d!.messages.find((x) => x._id === messageId)!;
    expect(m.status).toBe("done");
    expect(m.sources!.length).toBeGreaterThan(0);
    const real = new Set(DEMO_CORPUS.map((r) => r.caseName));
    for (const s of m.sources!) expect(real.has(s.caseName)).toBe(true);
    expect(m.sources!.map((s) => s.caseName)).toContain("National Insurance Co. Ltd. v. Swaran Singh");
    expect(m.content).toContain("[1]");
    expect(m.steps.length).toBeGreaterThan(2);
  });

  test("threads are private: another firm cannot read or continue them", async () => {
    const t = convexTest(schema, modules);
    const a = await firmUser(t, "a@firm.test");
    const b = await firmUser(t, "b@other.test");
    const { threadId } = await a.as.mutation(api.copilot.send, { content: "bail guidelines?" });
    await settle(t);
    await expect(b.as.query(api.copilot.messages, { threadId })).rejects.toThrow(/member/i);
    await expect(b.as.mutation(api.copilot.send, { threadId, content: "x" })).rejects.toThrow(/member|Forbidden/i);
    await expect(t.mutation(api.copilot.send, { content: "anon" })).rejects.toThrow(/authenticated/i);
  });

  test("saving an answer to a matter creates a verified brief that drafting can use", async () => {
    const t = convexTest(schema, modules);
    const { as, matterId } = await firmUser(t, "a@firm.test");
    await t.action(internal.ingest.ingestRecords, { records: DEMO_CORPUS });
    const { messageId } = await as.mutation(api.copilot.send, { matterId, content: "pay and recover when licence is invalid" });
    await settle(t);
    const { briefId } = await as.mutation(api.copilot.saveToMatter, { messageId });
    const matter = await as.query(api.crm.getMatter, { matterId });
    const brief = matter.briefs.find((b) => b._id === briefId)!;
    expect(brief.citations.length).toBeGreaterThan(0);
    expect(brief.citations.every((c) => c.verificationStatus === "verified")).toBe(true);
    expect(matter.matter.status).toBe("research");
    const draft = await as.action(api.drafting.generateDraft, { briefId, docType: "legal_notice", facts: "Accident on 1 Jan." });
    expect(draft.content).toContain("[TO CONFIRM");
  });
});
