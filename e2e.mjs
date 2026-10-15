import { ConvexHttpClient } from "convex/browser";
// Run against a THROWAWAY deployment only: it creates users, leads and demo data.
const URL = process.env.E2E_CONVEX_URL || "http://127.0.0.1:3210";
const anon = new ConvexHttpClient(URL);
let fails = 0;
const ok = (c, m) => { console.log(c ? "  PASS" : "  FAIL", m); if (!c) fails++; };
async function signUp(email) {
  const c = new ConvexHttpClient(URL);
  const r = await c.action("auth:signIn", { provider: "password", params: { email, password: "password123", flow: "signUp" } });
  c.setAuth(r.tokens.token); return c;
}

console.log("1. Citizen chatbot (no LLM key configured)");
const cases = [
  ["A bike hit me in Delhi and the rider won't pay for my hospital bills", "motor_vehicle", "Delhi"],
  ["my landlord is not returning my security deposit", "property", ""],
  ["Amazon sent a defective phone and refuses refund", "consumer", ""],
  ["cheque bounce ho gaya, insufficient funds", "cheque_bounce", ""],
  ["company has not paid my salary for 3 months and terminated me", "employment", ""],
  ["Someone took 40000 from my account through a fake KYC UPI call", "cyber", ""],
  ["my husband beats me and demands dowry", "family", ""],
  ["police refused to register my FIR for theft", "criminal", ""],
  ["hello", "other", ""],
];
for (const [m, cat, loc] of cases) {
  const r = await anon.action("chat:respond", { history: [], message: m });
  ok(r.category === cat && (!loc || r.location === loc), `"${m.slice(0,40)}" → ${r.category} ${r.location||""} [${r.source}]`);
}
const r1 = await anon.action("chat:respond", { history: [], message: "A car hit my scooter and the driver ran away. I'm injured." });
ok(r1.needsLocation === true && r1.subcategory === "injury_compensation", "asks for location; subcategory injury");
const r2 = await anon.action("chat:respond", { sessionId: r1.sessionId, history: [{role:"user",content:"A car hit my scooter and the driver ran away. I'm injured."},{role:"assistant",content:r1.answer}], message: "I live in Gurgaon" });
ok(r2.category === "motor_vehicle" && r2.location === "Gurgaon" && /Gurugram/.test(r2.nearestCourtName), `follow-up keeps domain + resolves city → ${r2.nearestCourtName}`);
const pii = await anon.action("chat:respond", { history: [], message: "my number is 9876543210, a truck hit my car in Pune" });
console.log("   answer excerpt:", r2.answer.slice(0, 160).replace(/\n/g," "), "…");

console.log("2. Consent");
try { await anon.mutation("chat:grantConsent", { sessionId: r1.sessionId, contactName: "Ravi", contactPhone: "123" }); ok(false, "bad contact rejected"); } catch (e) { ok(/valid/.test(e.message), "bad contact rejected"); }
await anon.mutation("chat:grantConsent", { sessionId: r1.sessionId, contactName: "Ravi Kumar", contactPhone: "9876543210" });
const pune = await anon.action("chat:respond", { history: [], message: "a truck hit my car in Pune, insurer rejected claim" });
await anon.mutation("chat:grantConsent", { sessionId: pune.sessionId, contactName: "Pune Citizen", contactPhone: "pune@example.com" });
const loc = await anon.mutation("chat:setLocation", { sessionId: r1.sessionId, lat: 28.47, lng: 77.03 });
ok(/Gurugram/.test(loc.nearestCourtName), "GPS location → nearest court " + loc.nearestCourtName);

console.log("3. Advocate onboarding (unverified)");
const lawyer = await signUp("lawyer@firm.test");
await lawyer.mutation("firms:bootstrap", { firmName: "Rai & Associates" });
try { await lawyer.mutation("marketplace:upsertLawyerProfile", { displayName: "Adv Rohit", bciEnrolmentNo: "garbage", practiceAreas: ["Motor Vehicle"], languages: ["Hindi"], listed: true, city: "Delhi" }); ok(false,"bad BCI rejected"); } catch(e) { ok(/Enrolment/.test(e.message), "bad BCI no. rejected"); }
await lawyer.mutation("marketplace:upsertLawyerProfile", { displayName: "Adv Rohit Rai", bciEnrolmentNo: "d/1234/2015", enrolmentState: "Delhi", practiceAreas: ["Motor Vehicle"], languages: ["Hindi","English"], listed: true, city: "Delhi", radiusKm: 40 });
const prof = await lawyer.query("marketplace:myProfile", {});
ok(prof.homeCourts.length === 5 && prof.bciEnrolmentNo === "D/1234/2015", `home courts: ${prof.homeCourtDetails.map(c=>c.name.split(",")[0]+" "+c.distanceKm+"km").join("; ")}`);
let feed = await lawyer.query("leads:feed", {});
const gl = feed.leads.find(l => l._id === r1.sessionId);
ok(!!gl && gl.contactLocked && gl.contactPhone === "", `unverified sees Gurgaon lead (${gl?.distanceKm} km) with contact LOCKED`);
ok(!feed.leads.find(l => l._id === pune.sessionId), "Pune lead NOT in Delhi advocate's feed");
try { await lawyer.mutation("leads:accept", { sessionId: r1.sessionId }); ok(false,"unverified accept blocked"); } catch(e) { ok(/verified/.test(e.message), "unverified cannot accept"); }
await lawyer.mutation("marketplace:submitForVerification", {});

console.log("4. Platform admin verifies");
const admin = await signUp("admin@nyayasetu.test");
ok(await admin.query("admin:amIAdmin", {}) === true && await lawyer.query("admin:amIAdmin", {}) === false, "admin guard via ADMIN_EMAILS");
const q = await admin.query("admin:verificationQueue", {});
ok(q.length === 1 && q[0].bciEnrolmentNo === "D/1234/2015", "verification queue has the advocate");
try { await lawyer.query("admin:verificationQueue", {}); ok(false,"non-admin blocked"); } catch { ok(true, "non-admin cannot read queue"); }
await admin.mutation("admin:decideVerification", { profileId: q[0]._id, decision: "verified" });

console.log("5. Verified advocate: lead → matter → research → draft");
feed = await lawyer.query("leads:feed", {});
const gl2 = feed.leads.find(l => l._id === r1.sessionId);
ok(gl2 && gl2.contactPhone === "9876543210" && !gl2.contactLocked, "contact unlocked after verification");
const { matterId } = await lawyer.mutation("leads:accept", { sessionId: r1.sessionId });
const again = await lawyer.mutation("leads:accept", { sessionId: r1.sessionId });
ok(again.matterId === matterId, "accept is idempotent");
const st = await anon.query("chat:sessionStatus", { sessionId: r1.sessionId });
ok(st.advocatesAccepted === 1, "citizen sees an advocate accepted");
const seeded = await lawyer.action("seed:loadDemoCorpus", {});
ok(seeded.ingested === 20, `demo corpus ingested ${seeded.ingested} docs, ${seeded.chunks} chunks`);
const res = await lawyer.action("research:runResearch", { matterId, query: "hit and run accident compensation multiplier future prospects insurer pay and recover" });
ok(res.authorities.length > 0 && res.fabricationRate === 0, `research: ${res.authorities.map(a=>a.caseName).join(" | ")} (fab ${res.fabricationRate}, ${res.modelUsed})`);
const draft = await lawyer.action("drafting:generateDraft", { briefId: res.briefId, docType: "legal_notice", facts: "On 2 Oct 2026 the respondent's car hit the client's scooter in Gurugram." });
ok(/LEGAL NOTICE/.test(draft.content) && /Ravi Kumar/.test(draft.content) && /Pranay Sethi|Sarla Verma|Swaran|Nanjappan/.test(draft.content), `draft (${draft.modelUsed}) cites verified authorities, ${draft.content.length} chars`);
const stats = await lawyer.query("analytics:firmStats", { firmId: (await lawyer.query("firms:me",{})).firmId });
ok(stats.fromLeads === 1 && stats.briefs === 1 && stats.drafts === 1, `firm stats: ${JSON.stringify(stats.byStatus)}`);
try { await lawyer.mutation("leads:accept", { sessionId: pune.sessionId }); ok(false, "out-of-area accept blocked"); } catch (e) { ok(/outside your jurisdiction/.test(e.message), "Delhi advocate cannot claim a Pune lead"); }
try { await anon.action("ingest:ingestRecords", { records: [] }); ok(false, "ingest locked"); } catch { ok(true, "public corpus ingestion is closed"); }

console.log("6. Citizen directory (geo)");
await anon.mutation("marketplace:seedSampleLawyers", {});
const near = await anon.action("advocates:findAdvocates", { practiceArea: "Motor Vehicle", city: "Noida" });
ok(near.advocates.length >= 2 && near.advocates[0].distanceKm <= near.advocates[1].distanceKm, `near Noida: ${near.advocates.map(a=>`${a.name} ${a.distanceKm}km`).join("; ")}`);
const mum = await anon.query("marketplace:searchDirectory", { city: "Bandra" });
ok(mum.length > 0 && mum.every(a => a.distanceKm < 60), `Bandra: ${mum.map(a=>a.displayName+" "+a.distanceKm+"km").join("; ")}`);
const metrics = await admin.query("admin:metrics", {});
ok(metrics.citizen.consentedLeads === 2 && metrics.marketplace.leadsAccepted === 1, `metrics: opt-in ${(metrics.citizen.optInRate*100).toFixed(0)}%, lead→matter ${(metrics.marketplace.leadToMatterRate*100).toFixed(0)}%`);
await anon.mutation("chat:withdrawConsent", { sessionId: pune.sessionId });
ok((await admin.query("admin:metrics",{})).citizen.consentedLeads === 1, "withdrawn consent removes lead");
console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
