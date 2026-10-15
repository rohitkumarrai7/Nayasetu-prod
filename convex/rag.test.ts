import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { DEMO_CORPUS } from "./lib/demoData";
import schema from "./schema";

// Load all function modules EXCEPT tests and the auth/http wiring (not exercised here; keeps the
// in-process registry free of import-time auth setup).
const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts", "!./http.ts", "!./auth.ts"]);

async function setup(t: ReturnType<typeof convexTest>) {
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: "lawyer@firm.test" });
    const firmId = await ctx.db.insert("firms", {
      name: "Test Firm",
      ownerUserId: userId,
      plan: "basic",
    });
    await ctx.db.insert("memberships", { userId, firmId, role: "firm_admin" });
    const clientId = await ctx.db.insert("clients", {
      firmId,
      name: "Truck Co",
      createdBy: userId,
    });
    const matterId = await ctx.db.insert("matters", {
      firmId,
      clientId,
      title: "Truck accident claim",
      category: "motor_vehicle",
      subcategory: "accident_claim_loan_dispute",
      summaryText: "Insurer refused the claim; bank pressing the vehicle loan.",
      status: "intake",
      createdBy: userId,
    });
    return { userId, firmId, clientId, matterId };
  });
  return { ...ids, asUser: t.withIdentity({ subject: `${ids.userId}|s`, name: "Lawyer" }) };
}

describe("RAG pipeline (Convex, in-process)", () => {
  test("ingest is idempotent and denoises", async () => {
    const t = convexTest(schema, modules);
    const s1 = await t.action(internal.ingest.ingestRecords, { records: DEMO_CORPUS });
    expect(s1.ingested).toBe(DEMO_CORPUS.length);
    expect(s1.chunks).toBeGreaterThanOrEqual(DEMO_CORPUS.length);
    const s2 = await t.action(internal.ingest.ingestRecords, { records: DEMO_CORPUS });
    expect(s2.ingested).toBe(0);
    expect(s2.skippedDuplicate).toBe(DEMO_CORPUS.length);

    // noise removed from stored corpus text
    const doc = await t.run(async (ctx) =>
      ctx.db
        .query("corpusDocuments")
        .filter((q) => q.eq(q.field("sourceDocId"), "2"))
        .first(),
    );
    expect(doc?.cleanText.toUpperCase()).not.toContain("SOMECOURT");
    expect(doc?.cleanText).not.toContain("Page 3 of 9");
  });

  test("research produces a grounded, verified brief with zero fabrication", async () => {
    const t = convexTest(schema, modules);
    const { matterId, asUser } = await setup(t);
    await t.action(internal.ingest.ingestRecords, { records: DEMO_CORPUS });

    const res = await asUser.action(api.research.runResearch, {
      matterId,
      query: "commercial truck accident insurer refused claim vehicle loan",
    });
    expect(res.authorities.length).toBeGreaterThan(0);
    expect(res.fabricationRate).toBe(0);
    const real = new Set(DEMO_CORPUS.map((d) => d.caseName));
    for (const a of res.authorities) expect(real.has(a.caseName)).toBe(true);
    // precision: an off-topic tenancy/medical case must not pad a motor-insurance brief
    expect(res.authorities.some((a: any) => /Swaran Singh|Nanjappan/.test(a.caseName))).toBe(true);
    expect(res.authorities.some((a: any) => /Shiv Sarup|Medical Association/.test(a.caseName))).toBe(false);
    // offline: extractive summaries, never the raw echo marker
    for (const a of res.authorities) expect(a.summary).not.toContain("offline-grounded");
  });

  test("offline drafting produces a structured, grounded first draft", async () => {
    const t = convexTest(schema, modules);
    const { matterId, asUser } = await setup(t);
    await t.action(internal.ingest.ingestRecords, { records: DEMO_CORPUS });
    const res = await asUser.action(api.research.runResearch, {
      matterId,
      query: "truck driver without valid licence, insurer refused the accident claim",
    });
    const d = await asUser.action(api.drafting.generateDraft, {
      briefId: res.briefId,
      docType: "legal_notice",
      facts: "Truck met with an accident on NH-48.",
    });
    expect(d.modelUsed).toBe("template");
    expect(d.content).toContain("LEGAL NOTICE");
    expect(d.content).toContain("Truck Co");
    expect(d.content).toContain("[TO CONFIRM");
    for (const a of res.authorities) expect(d.content).toContain(a.caseName);
  });

  test("fabricated citations are dropped (fabrication gate §9.3)", async () => {
    const t = convexTest(schema, modules);
    await setup(t);
    await t.action(internal.ingest.ingestRecords, { records: DEMO_CORPUS });
    const res = await t.query(internal.verify.verifyCitations, {
      candidates: [
        {
          caseName: "National Insurance Co. Ltd. v. Swaran Singh",
          citationString: "(2004) 3 SCC 297",
          relevancePassage: "insurer bears the burden of proving the breach of the policy condition",
        },
        { caseName: "Imaginary v. Fictional", citationString: "(2099) 1 SCC 1", relevancePassage: "" },
        {
          caseName: "Nonexistent Corp v. Nobody",
          citationString: "AIR 2098 SC 9999",
          relevancePassage: "",
        },
      ],
    });
    expect(res.verified.length).toBe(1);
    expect(res.dropped.length).toBe(2);
    expect(res.fabricationRate).toBeCloseTo(2 / 3);
  });

  test("parallel citation (AIR form) resolves to the same document", async () => {
    const t = convexTest(schema, modules);
    await t.action(internal.ingest.ingestRecords, { records: DEMO_CORPUS });
    const res = await t.query(internal.verify.verifyCitations, {
      candidates: [
        { caseName: "", citationString: "AIR 2004 SC 1531", relevancePassage: "" },
      ],
    });
    expect(res.verified.length).toBe(1);
    expect(res.verified[0].caseName).toContain("Swaran Singh");
  });
});

describe("tenant isolation (§9.4)", () => {
  test("a member of another firm cannot read the matter", async () => {
    const t = convexTest(schema, modules);
    const { matterId } = await setup(t);
    const otherUser = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", { email: "other@firm.test" });
      const fid = await ctx.db.insert("firms", { name: "Other Firm", ownerUserId: uid, plan: "basic" });
      await ctx.db.insert("memberships", { userId: uid, firmId: fid, role: "firm_admin" });
      return uid;
    });
    const asOther = t.withIdentity({ subject: `${otherUser}|s` });
    await expect(asOther.query(api.crm.getMatter, { matterId })).rejects.toThrow(/member/i);
  });

  test("unauthenticated callers are rejected from firm-scoped queries", async () => {
    const t = convexTest(schema, modules);
    const { firmId } = await setup(t);
    await expect(t.query(api.crm.listClients, { firmId })).rejects.toThrow(/authenticated|member/i);
  });
});
