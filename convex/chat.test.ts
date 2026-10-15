import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts", "!./http.ts", "!./auth.ts"]);

async function lawyer(t: ReturnType<typeof convexTest>, email: string, city: string, verified: boolean) {
  const userId = await t.run(async (ctx) => {
    const uid = await ctx.db.insert("users", { email });
    const firmId = await ctx.db.insert("firms", { name: `${email} firm`, ownerUserId: uid, plan: "basic" });
    await ctx.db.insert("memberships", { userId: uid, firmId, role: "firm_admin" });
    return uid;
  });
  const as = t.withIdentity({ subject: `${userId}|s` });
  await as.mutation(api.marketplace.upsertLawyerProfile, {
    displayName: `Adv ${email}`,
    bciEnrolmentNo: "D/1234/2015",
    enrolmentState: "Delhi",
    practiceAreas: ["Motor Vehicle"],
    languages: ["Hindi"],
    listed: true,
    city,
  });
  if (verified) {
    await t.run(async (ctx) => {
      const p = await ctx.db.query("lawyerProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
      await ctx.db.patch(p!._id, { verified: true, verificationStatus: "verified" });
    });
  }
  return { userId, as };
}

describe("citizen chatbot (no LLM key)", () => {
  test("routes the problem, captures location, persists the session", async () => {
    const t = convexTest(schema, modules);
    const r = await t.action(api.chat.respond, {
      history: [],
      message: "I had a bike accident in Gurgaon and the other person won't pay for damages",
    });
    expect(r.source).toBe("rules");
    expect(r.category).toBe("motor_vehicle");
    expect(r.location).toBe("Gurgaon");
    expect(r.nearestCourtName).toMatch(/Gurugram/);
    expect(r.answer).toMatch(/Motor Vehicles Act/);
    expect(r.needsLocation).toBe(false);
    const sessions = await t.run((ctx) => ctx.db.query("chatSessions").collect());
    expect(sessions.length).toBe(1);
    expect(sessions[0].messages.length).toBe(2);
    expect(sessions[0].nearestCourt).toBe("HR-GGN");
  });

  test("a follow-up without a city keeps the earlier location; vague input asks to clarify", async () => {
    const t = convexTest(schema, modules);
    const a = await t.action(api.chat.respond, { history: [], message: "landlord won't return my deposit, I live in Pune" });
    const b = await t.action(api.chat.respond, {
      sessionId: a.sessionId,
      history: [{ role: "user", content: "landlord won't return my deposit, I live in Pune" }, { role: "assistant", content: a.answer }],
      message: "what documents do I need?",
    });
    expect(b.category).toBe("property");
    expect(b.location).toBe("Pune");
    const vague = await t.action(api.chat.respond, { history: [], message: "I need help" });
    expect(vague.category).toBe("other");
    expect(vague.answer).toMatch(/tell me a little more/i);
  });

  test("PII is redacted before storage", async () => {
    const t = convexTest(schema, modules);
    await t.action(api.chat.respond, { history: [], message: "call me on 9876543210, a car hit me in Delhi" });
    const s = await t.run((ctx) => ctx.db.query("chatSessions").first());
    expect(JSON.stringify(s!.messages)).not.toContain("9876543210");
  });
});

describe("consent + geo lead feed (PRD §7)", () => {
  test("only nearby advocates see the lead; contact unlocks only when verified; accept creates a matter", async () => {
    const t = convexTest(schema, modules);
    const r = await t.action(api.chat.respond, { history: [], message: "A truck hit my car in Noida, insurer rejected the claim" });
    await expect(
      t.mutation(api.chat.grantConsent, { sessionId: r.sessionId, contactName: "Test Citizen", contactPhone: "12345" }),
    ).rejects.toThrow(/valid/);
    await t.mutation(api.chat.grantConsent, { sessionId: r.sessionId, contactName: "Test Citizen", contactPhone: "9876543210" });

    const delhiUnverified = await lawyer(t, "a@x.test", "Delhi", false);
    const delhiVerified = await lawyer(t, "b@x.test", "New Delhi", true);
    const mumbai = await lawyer(t, "c@x.test", "Mumbai", true);

    const f1 = await delhiUnverified.as.query(api.leads.feed, {});
    expect(f1.leads.length).toBe(1);
    expect(f1.leads[0].contactLocked).toBe(true);
    expect(f1.leads[0].contactPhone).toBe("");
    await expect(delhiUnverified.as.mutation(api.leads.accept, { sessionId: r.sessionId })).rejects.toThrow(/verified/);

    const f2 = await delhiVerified.as.query(api.leads.feed, {});
    expect(f2.leads[0].contactPhone).toBe("9876543210");
    expect(f2.leads[0].distanceKm).toBeLessThan(40);

    const f3 = await mumbai.as.query(api.leads.feed, {});
    expect(f3.leads.length).toBe(0);

    const { matterId } = await delhiVerified.as.mutation(api.leads.accept, { sessionId: r.sessionId });
    const m = await delhiVerified.as.query(api.crm.getMatter, { matterId });
    expect(m.matter.category).toBe("motor_vehicle");
    expect(m.client?.phone).toBe("9876543210");
    expect((await t.query(api.chat.sessionStatus, { sessionId: r.sessionId }))!.advocatesAccepted).toBe(1);

    // withdrawal removes it everywhere
    await t.mutation(api.chat.withdrawConsent, { sessionId: r.sessionId });
    expect((await delhiVerified.as.query(api.leads.feed, {})).leads.length).toBe(0);
  });

  test("users without an advocate profile get no leads", async () => {
    const t = convexTest(schema, modules);
    const uid = await t.run((ctx) => ctx.db.insert("users", { email: "citizen@x.test" }));
    const f = await t.withIdentity({ subject: `${uid}|s` }).query(api.leads.feed, {});
    expect(f.state).toBe("needs_profile");
    expect(f.leads).toEqual([]);
  });
});

describe("advocate search (geo directory)", () => {
  test("verified advocates near the citizen, nearest first; Apify not configured", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.marketplace.seedSampleLawyers, {});
    const r = await t.action(api.advocates.findAdvocates, { practiceArea: "Motor Vehicle", city: "Noida" });
    expect(r.source).toBe("directory");
    expect(r.advocates.length).toBeGreaterThan(0);
    expect(r.advocates.every((a: any) => a.verified && a.distanceKm <= 100)).toBe(true);
    const d = r.advocates.map((a: any) => a.distanceKm);
    expect([...d].sort((x, y) => x - y)).toEqual(d);
    const far = await t.action(api.advocates.findAdvocates, { practiceArea: "Motor Vehicle", city: "Chennai" });
    expect(far.advocates.find((a: any) => a.city === "Gautam Buddh Nagar")).toBeUndefined();
  });
});

describe("BCI verification workflow", () => {
  test("invalid enrolment rejected; changing enrolment after verification re-queues", async () => {
    const t = convexTest(schema, modules);
    const { as, userId } = await lawyer(t, "v@x.test", "Delhi", true);
    await expect(
      as.mutation(api.marketplace.upsertLawyerProfile, {
        displayName: "Adv V", bciEnrolmentNo: "hello", practiceAreas: ["Motor Vehicle"], languages: [], listed: true,
      }),
    ).rejects.toThrow(/Enrolment/);
    await as.mutation(api.marketplace.upsertLawyerProfile, {
      displayName: "Adv V", bciEnrolmentNo: "D/9999/2016", enrolmentState: "Delhi", practiceAreas: ["Motor Vehicle"], languages: [], listed: true,
    });
    const p = await t.run((ctx) => ctx.db.query("lawyerProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique());
    expect(p!.verified).toBe(false);
    expect(p!.verificationStatus).toBe("pending");
    expect(p!.homeCourts!.length).toBe(5); // location kept
  });

  test("admin endpoints are closed to non-admins", async () => {
    const t = convexTest(schema, modules);
    const uid = await t.run((ctx) => ctx.db.insert("users", { email: "nobody@x.test" }));
    const as = t.withIdentity({ subject: `${uid}|s` });
    expect(await as.query(api.admin.amIAdmin, {})).toBe(false);
    await expect(as.query(api.admin.verificationQueue, {})).rejects.toThrow(/admin/);
  });
});
