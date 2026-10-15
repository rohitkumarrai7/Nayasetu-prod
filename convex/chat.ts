// Citizen legal assistant (C1) + consent-based lead capture (C2).
//
// Reliability contract: this action ALWAYS returns a useful, domain-routed answer.
//   1. A deterministic triage engine (lib/legalTriage) classifies the problem and drafts a
//      plain-language answer with the governing Act, rights and next steps — no LLM needed.
//   2. If an LLM is configured, it writes a more conversational answer (JSON mode, 15 s budget).
//      Its output is validated: unknown category / bad JSON / timeout / 429 → we keep step 1.
// The session is persisted as a lead-intelligence signal {domain, location, summary}; nothing is
// shared with advocates until the citizen explicitly consents (grantConsent).
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { GUIDES, pickSubcategory, triage, TriageAnswer } from "./lib/legalTriage";
import { complete, hasLiveProvider } from "./lib/llm";
import { redactPii } from "./lib/pii";
import { CATEGORY_KEYS, categoryLabel, TAXONOMY } from "./lib/taxonomy";
import { audit } from "./model/access";
import { resolveLocation } from "./model/geo";

const CATEGORY_LIST = TAXONOMY.map((c) => `- ${c.key}: ${c.label}`).join("\n");

const SYS = `You are NyayaSetu's citizen legal-information assistant for Indian law. You give general
INFORMATION, not legal advice. Be warm, plain-language (simple English; mirror Hinglish if the user
writes Hinglish) and concise. Use current Indian law: since 1 July 2024 the Bharatiya Nyaya Sanhita
(BNS), Bharatiya Nagarik Suraksha Sanhita (BNSS) and Bharatiya Sakshya Adhiniyam (BSA) replaced the
IPC, CrPC and Evidence Act. Never invent case names or citations. Never predict outcomes.
Compensation claims are civil (e.g. motor accident claims go to the MACT under the Motor Vehicles Act,
1988); the BNS only covers the criminal side. Name the specific governing Act and forum.

Classify the user's issue into ONE category key from this list:
${CATEGORY_LIST}
- other: none of the above / not enough detail yet

Return STRICT JSON ONLY with this shape:
{
  "answer": "3-6 short sentences: what the situation is legally, the main Indian law, the forum, and the next practical step. If details are missing, ask ONE clarifying question.",
  "category": "one key from the list above",
  "act": "main Indian Act that applies, or empty",
  "location": "the user's city/town if they mentioned one, else empty",
  "summary": "one neutral line summarising the problem, no names or phone numbers"
}`;

function parseJson(text: string): Record<string, unknown> | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const v = JSON.parse(m[0]);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const str = (x: unknown, max = 2000) => (typeof x === "string" ? x.trim().slice(0, max) : "");

const msg = v.object({ role: v.string(), content: v.string() });

// ── persistence ───────────────────────────────────────────────────────────────
export const sessionState = internalQuery({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, { sessionId }) => {
    const s = await ctx.db.get(sessionId);
    if (!s) return null;
    return {
      location: s.location,
      clientLat: s.clientLat,
      clientLng: s.clientLng,
      nearestCourtName: s.nearestCourtName,
      consentToShare: s.consentToShare,
    };
  },
});

export const locate = internalQuery({
  args: {
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    city: v.optional(v.string()),
    text: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const r = await resolveLocation(ctx, args, 1);
    if (!r) return null;
    return {
      lat: r.lat,
      lng: r.lng,
      label: r.label,
      geoBucket: r.geoBucket,
      nearestCourt: r.nearestCourt.code,
      nearestCourtName: r.nearestCourt.name,
      distanceKm: r.nearestCourt.distanceKm,
    };
  },
});

const geoFields = {
  location: v.optional(v.string()),
  clientLat: v.optional(v.number()),
  clientLng: v.optional(v.number()),
  geoBucket: v.optional(v.string()),
  nearestCourt: v.optional(v.string()),
  nearestCourtName: v.optional(v.string()),
};

export const saveSession = internalMutation({
  args: {
    sessionId: v.optional(v.id("chatSessions")),
    messages: v.array(msg),
    category: v.optional(v.string()),
    subcategory: v.optional(v.string()),
    act: v.optional(v.string()),
    summary: v.optional(v.string()),
    ...geoFields,
  },
  handler: async (ctx, args): Promise<Id<"chatSessions">> => {
    const { sessionId, ...rest } = args;
    // Only overwrite geo when we have a new fix — a follow-up message without a city must not
    // erase the location captured earlier.
    const patch: Record<string, unknown> = {
      messages: rest.messages,
      category: rest.category,
      subcategory: rest.subcategory,
      act: rest.act,
      summary: rest.summary,
    };
    if (rest.clientLat !== undefined) {
      Object.assign(patch, {
        location: rest.location,
        clientLat: rest.clientLat,
        clientLng: rest.clientLng,
        geoBucket: rest.geoBucket,
        nearestCourt: rest.nearestCourt,
        nearestCourtName: rest.nearestCourtName,
      });
    }
    if (sessionId) {
      const existing = await ctx.db.get(sessionId);
      if (existing) {
        await ctx.db.patch(sessionId, patch);
        return sessionId;
      }
    }
    return ctx.db.insert("chatSessions", {
      ...(patch as { messages: { role: string; content: string }[] }),
      location: rest.location,
      clientLat: rest.clientLat,
      clientLng: rest.clientLng,
      geoBucket: rest.geoBucket,
      nearestCourt: rest.nearestCourt,
      nearestCourtName: rest.nearestCourtName,
      consentToShare: false,
      createdAt: Date.now(),
    });
  },
});

// ── the assistant ──────────────────────────────────────────────────────────────
export const respond = action({
  args: {
    sessionId: v.optional(v.id("chatSessions")),
    history: v.array(msg),
    message: v.string(),
    // Optional precise location from the browser (navigator.geolocation), or a typed city.
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    city: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    answer: string;
    category: string;
    subcategory: string;
    act: string;
    needsLocation: boolean;
    location: string;
    nearestCourtName: string;
    summary: string;
    rights: string[];
    nextSteps: string[];
    documents: string[];
    sessionId: Id<"chatSessions">;
    modelUsed: string;
    source: "llm" | "rules";
  }> => {
    const raw = args.message.trim().slice(0, 4000);
    if (!raw) throw new Error("Please type a message.");
    // §9.2: redact PII before anything leaves the process (free-tier LLMs may train on prompts).
    const safeMessage = redactPii(raw).text;
    const history = args.history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-12)
      .map((m) => ({ role: m.role, content: redactPii(m.content).text.slice(0, 1500) }));
    const userTurns = [...history.filter((m) => m.role === "user").map((m) => m.content), safeMessage];

    // ── location: browser coords > typed city > place named in this message > earlier fix ──
    const prior = args.sessionId ? await ctx.runQuery(internal.chat.sessionState, { sessionId: args.sessionId }) : null;
    let loc = await ctx.runQuery(internal.chat.locate, {
      lat: args.lat,
      lng: args.lng,
      city: args.city,
      text: safeMessage,
    });
    const known =
      loc ??
      (prior?.clientLat !== undefined
        ? { label: prior.location ?? "", nearestCourtName: prior.nearestCourtName ?? "" }
        : null);

    // ── 1) deterministic triage (always) ──
    const rules: TriageAnswer = triage(userTurns, {
      placeLabel: known?.label,
      courtName: known?.nearestCourtName,
    });

    // ── 2) LLM answer (optional, validated) ──
    let answer = rules.answer;
    let category = rules.category;
    let subcategory = rules.subcategory;
    let act = rules.act;
    let summary = rules.summary;
    let modelUsed = "rules:triage";
    let source: "llm" | "rules" = "rules";

    if (hasLiveProvider("general")) {
      try {
        const convo = [...history, { role: "user", content: safeMessage }]
          .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
          .join("\n");
        // Ground the model in the verified domain guide so it cannot misname the governing law
        // (e.g. attributing motor-accident compensation to the BNS instead of the MV Act / MACT).
        const guide = rules.category !== "other" ? GUIDES[rules.category] : null;
        const guideBlock = guide
          ? `\n\nVERIFIED DOMAIN GUIDE (use it if the issue fits this domain; never contradict it):\n` +
            `Domain: ${categoryLabel(rules.category)}\nGoverning law: ${guide.act}\nForum: ${guide.forum}\n` +
            `Key rights:\n${guide.rights.map((r) => `- ${r}`).join("\n")}`
          : "";
        const res = await complete("general", SYS, `Conversation so far:\n${convo}${guideBlock}\n\nRespond as JSON.`, {
          json: true,
          timeoutMs: 15_000,
          maxTokens: 700,
        });
        const parsed = res.provider === "echo" ? null : parseJson(res.text);
        const llmAnswer = str(parsed?.answer);
        if (parsed && llmAnswer.length >= 20) {
          const llmCat = str(parsed.category, 40);
          // Trust the LLM's category only if it is one of ours; if it says "other" but the rules
          // are confident, keep the rules' domain so routing still works.
          if (CATEGORY_KEYS.includes(llmCat)) {
            category = llmCat;
            subcategory = llmCat === rules.category ? rules.subcategory : pickSubcategory(llmCat, userTurns.join(" "));
          } else if (rules.category === "other") {
            category = "other";
            subcategory = "";
          }
          // In a domain the rules know, the governing Act is the verified one, and an LLM answer
          // that doesn't name it is not trusted (it may have attributed the claim to the wrong law).
          const sameAsRules = category === rules.category && rules.category !== "other";
          const actKey = rules.act.split(",")[0].toLowerCase();
          answer = sameAsRules && !llmAnswer.toLowerCase().includes(actKey) ? rules.answer : llmAnswer;
          act = sameAsRules ? rules.act : str(parsed.act, 200);
          summary = str(parsed.summary, 200) || rules.summary;
          modelUsed = `${res.provider}:${res.model}`;
          source = "llm";
          // If the LLM spotted a city the gazetteer missed, try to resolve it.
          const llmLoc = str(parsed.location, 80);
          if (!loc && !known && llmLoc) {
            loc = await ctx.runQuery(internal.chat.locate, { city: llmLoc });
          }
        }
      } catch (e) {
        console.warn(`[chat] LLM unavailable, using rules: ${String(e).slice(0, 200)}`);
      }
    }

    const messages = [...history, { role: "user", content: safeMessage }, { role: "assistant", content: answer }];
    const sessionId: Id<"chatSessions"> = await ctx.runMutation(internal.chat.saveSession, {
      sessionId: args.sessionId,
      messages,
      category,
      subcategory: subcategory || undefined,
      act: act || undefined,
      summary,
      ...(loc
        ? {
            location: loc.label,
            clientLat: loc.lat,
            clientLng: loc.lng,
            geoBucket: loc.geoBucket,
            nearestCourt: loc.nearestCourt,
            nearestCourtName: loc.nearestCourtName,
          }
        : {}),
    });

    const location = loc?.label ?? known?.label ?? "";
    const sameDomain = category === rules.category;
    return {
      answer,
      category,
      subcategory,
      act,
      needsLocation: category !== "other" && !location,
      location,
      nearestCourtName: loc?.nearestCourtName ?? known?.nearestCourtName ?? "",
      summary,
      rights: sameDomain ? rules.rights : [],
      nextSteps: sameDomain ? rules.nextSteps : [],
      documents: sameDomain ? rules.documents : [],
      sessionId,
      modelUsed,
      source,
    };
  },
});

// ── location capture without a new message ("Use my location" / typed city) ─────
export const setLocation = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    city: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.sessionId);
    if (!s) throw new Error("Chat session not found — please send a message first.");
    const r = await resolveLocation(ctx, { lat: args.lat, lng: args.lng, city: args.city }, 1);
    if (!r) {
      throw new Error(
        args.city
          ? `Couldn't find "${args.city.slice(0, 40)}". Try your district or a nearby city name.`
          : "Couldn't use that location. Try typing your city instead.",
      );
    }
    await ctx.db.patch(args.sessionId, {
      location: r.label,
      clientLat: r.lat,
      clientLng: r.lng,
      geoBucket: r.geoBucket,
      nearestCourt: r.nearestCourt.code,
      nearestCourtName: r.nearestCourt.name,
    });
    return { location: r.label, nearestCourtName: r.nearestCourt.name, lat: r.lat, lng: r.lng };
  },
});

// ── consent (DPDP: explicit, specific, withdrawable) ───────────────────────────
const PHONE_RE = /^(?:\+?91[-\s]?)?[6-9]\d{4}[-\s]?\d{5}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const grantConsent = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    contactName: v.string(),
    contactPhone: v.string(), // phone OR email — whichever the citizen chose to share
  },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.sessionId);
    if (!s) throw new Error("Chat session not found.");
    const name = args.contactName.trim().slice(0, 80);
    const contact = args.contactPhone.trim().slice(0, 120);
    if (name.length < 2) throw new Error("Please enter your name.");
    if (!PHONE_RE.test(contact) && !EMAIL_RE.test(contact)) {
      throw new Error("Please enter a valid 10-digit mobile number or an email address.");
    }
    if (!s.category || s.category === "other") {
      throw new Error("Describe your problem first so we can route it to the right advocates.");
    }
    await ctx.db.patch(args.sessionId, {
      consentToShare: true,
      consentedAt: Date.now(),
      withdrawnAt: undefined,
      contactName: name,
      contactPhone: contact,
    });
    await audit(ctx, "lead.consent", `chatSessions/${args.sessionId}`, undefined, {
      category: s.category,
      nearestCourt: s.nearestCourt ?? null,
    });
    return { ok: true, nearestCourtName: s.nearestCourtName ?? null, location: s.location ?? null };
  },
});

export const withdrawConsent = mutation({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, { sessionId }) => {
    const s = await ctx.db.get(sessionId);
    if (!s) throw new Error("Chat session not found.");
    await ctx.db.patch(sessionId, {
      consentToShare: false,
      withdrawnAt: Date.now(),
      contactName: undefined,
      contactPhone: undefined,
    });
    await audit(ctx, "lead.withdraw", `chatSessions/${sessionId}`);
    return { ok: true };
  },
});

/** What the citizen can see about their own session (by unguessable id). */
export const sessionStatus = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, { sessionId }) => {
    const s = await ctx.db.get(sessionId);
    if (!s) return null;
    const actions = await ctx.db
      .query("leadActions")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    return {
      consentToShare: s.consentToShare,
      location: s.location ?? null,
      nearestCourtName: s.nearestCourtName ?? null,
      advocatesAccepted: actions.filter((a) => a.action === "accepted").length,
    };
  },
});
