// Deterministic citizen legal triage (C1). Runs with NO LLM, so the assistant always works —
// and it is the validator/fallback for the LLM path (an LLM answer with an unknown category, bad
// JSON, a timeout or a 429 never reaches the user as a dead end).
//
// Content is general legal INFORMATION about Indian law, written conservatively: it names the
// statute and forum and the practical next step, and never predicts outcomes. It deliberately
// avoids figures that change often (fee slabs, compensation amounts).
import { getChecklist, TAXONOMY } from "./taxonomy";

export interface DomainGuide {
  act: string;
  forum: string;
  rights: string[];
  nextSteps: string[];
  urgent?: string;
}

export const GUIDES: Record<string, DomainGuide> = {
  motor_vehicle: {
    act: "Motor Vehicles Act, 1988",
    forum: "Motor Accident Claims Tribunal (MACT) of the area where the accident happened, where you live, or where the other side lives",
    rights: [
      "If you were injured or your vehicle was damaged, you can claim compensation from the driver/owner — and from their insurer, who generally has to pay a third-party claim.",
      "Even in a hit-and-run, there is a government compensation scheme for victims.",
      "Rash or negligent driving is also a criminal offence, so a police complaint (FIR) can be filed alongside the compensation claim.",
    ],
    nextSteps: [
      "Make sure an FIR is registered and get a copy.",
      "Keep all medical bills, repair estimates and photos of the vehicles and the spot.",
      "Note the other vehicle's number and insurer; the claim petition goes to the MACT — file it promptly, because time limits apply.",
    ],
    urgent: "If anyone is badly hurt, get medical help first — hospitals must treat accident victims without waiting for police formalities.",
  },
  consumer: {
    act: "Consumer Protection Act, 2019",
    forum: "District Consumer Disputes Redressal Commission (complaints can be filed online through e-Daakhil)",
    rights: [
      "If goods are defective or a service was deficient, you can ask for repair, replacement, refund and compensation.",
      "You can file the complaint where you live or work — you don't have to go to the seller's city.",
      "Unfair trade practices and misleading advertisements are also covered.",
    ],
    nextSteps: [
      "Collect the bill, warranty card, and all chats/emails with the seller or service provider.",
      "Send a written complaint or legal notice giving them a fair deadline to fix it.",
      "If unresolved, file before the District Commission — generally within 2 years of the problem.",
    ],
  },
  property: {
    act: "your State's Rent Control / Tenancy law and the Transfer of Property Act, 1882",
    forum: "Rent Controller / Rent Authority, or the Civil Court, depending on your State",
    rights: [
      "A landlord cannot throw a tenant out, cut water/electricity, or lock the premises without following the legal process.",
      "A tenant who doesn't pay rent can be evicted — but only through the Rent Controller / court.",
      "A security deposit must be returned as per the agreement, after lawful deductions.",
    ],
    nextSteps: [
      "Keep the rent agreement, rent receipts / bank transfers, and all messages.",
      "Send a written notice stating exactly what you want (rent, possession, or deposit refund) and a deadline.",
      "If it isn't resolved, a local advocate can file before the Rent Authority or Civil Court.",
    ],
  },
  cheque_bounce: {
    act: "Negotiable Instruments Act, 1881 (Section 138)",
    forum: "Magistrate's court having jurisdiction over the bank branch where you presented the cheque",
    rights: [
      "A cheque bounced for insufficient funds can be a criminal offence by the person who issued it.",
      "The law presumes the cheque was given for a debt unless the issuer proves otherwise.",
    ],
    nextSteps: [
      "Send a written demand notice to the issuer within 30 days of receiving the bank's return memo.",
      "The issuer then has 15 days to pay.",
      "If they don't pay, the complaint must be filed within one month after those 15 days — these deadlines are strict.",
    ],
    urgent: "Deadlines here are strict — note the date on the bank's return memo today.",
  },
  family: {
    act: "the personal law that applies to your marriage (e.g. Hindu Marriage Act, 1955 or Special Marriage Act, 1954), the Protection of Women from Domestic Violence Act, 2005, and maintenance under Section 144 of the Bharatiya Nagarik Suraksha Sanhita, 2023",
    forum: "Family Court (or the District Court where there is no Family Court); a Magistrate for domestic-violence protection orders",
    rights: [
      "A spouse who cannot maintain themselves, and children, can claim maintenance.",
      "A woman facing domestic violence can seek protection, residence and monetary relief orders.",
      "Custody decisions are made on the child's welfare, and both parents can ask for custody or visitation.",
    ],
    nextSteps: [
      "Keep your marriage proof, income details and any evidence (messages, medical records, complaints).",
      "Mediation is often tried first and can resolve things faster.",
      "A family-law advocate can advise which petition fits your situation.",
    ],
    urgent: "If you are in danger right now, call 112. The Women Helpline is 181.",
  },
  employment: {
    act: "the Labour Codes in force (Code on Wages, 2019 and Industrial Relations Code, 2020) and your employment contract",
    forum: "Labour Commissioner / conciliation officer, then the Labour Court or Industrial Tribunal; Civil Court for some contract claims",
    rights: [
      "Your employer must pay earned wages on time and cannot make unauthorised deductions.",
      "Termination must follow your contract and the law; depending on your role you may be entitled to notice pay, retrenchment compensation and gratuity.",
    ],
    nextSteps: [
      "Collect your offer letter, salary slips, bank statements and all emails about the dispute.",
      "Send a written demand (email is fine) asking for the dues with a deadline.",
      "If unpaid, complain to the Labour Commissioner's office for your area, or consult an advocate about a legal notice.",
    ],
  },
  criminal: {
    act: "Bharatiya Nyaya Sanhita, 2023 (offences) and Bharatiya Nagarik Suraksha Sanhita, 2023 (procedure)",
    forum: "Police station (FIR, e-FIR or Zero FIR at any police station); Magistrate's court; Sessions Court / High Court for bail",
    rights: [
      "For a serious (cognizable) offence, the police must register an FIR, and you are entitled to a free copy.",
      "If the police refuse, you can write to the Superintendent of Police, and then approach the Magistrate.",
      "If you are arrested, you have the right to know the grounds, to inform a family member, to consult a lawyer, and to be produced before a Magistrate within 24 hours.",
    ],
    nextSteps: [
      "Write down what happened, with dates, times and names of witnesses.",
      "Go to the police station (any police station can register a Zero FIR) and keep the copy.",
      "If you fear arrest, a criminal advocate can advise on anticipatory bail.",
    ],
    urgent: "In an emergency, call 112.",
  },
  cyber: {
    act: "Information Technology Act, 2000 and the Bharatiya Nyaya Sanhita, 2023 (cheating), plus RBI rules on unauthorised banking transactions",
    forum: "National Cybercrime Reporting Portal (cybercrime.gov.in) / helpline 1930, your bank, and the cyber police",
    rights: [
      "If you report an unauthorised transaction to your bank quickly, RBI rules can limit or remove your liability.",
      "Money stuck in the fraudster's account can sometimes be frozen if reported fast.",
    ],
    nextSteps: [
      "Call 1930 or report at cybercrime.gov.in immediately — speed matters.",
      "Inform your bank in writing and block your card/UPI; note the complaint numbers.",
      "Keep screenshots, transaction IDs and the numbers/links used by the fraudster.",
    ],
    urgent: "Report within hours if you can: call 1930 now and block your card/UPI.",
  },
};

// Keyword → weight. Includes common Hinglish phrasing. Multi-word phrases score higher.
const SIGNALS: Record<string, [string, number][]> = {
  motor_vehicle: [
    ["accident", 3], ["hit me", 3], ["hit my", 3], ["collision", 3], ["crash", 2], ["bike", 1.5],
    ["scooter", 1.5], ["car", 1], ["truck", 1.5], ["vehicle", 1.5], ["insurance claim", 2.5],
    ["insurer", 1.5], ["mact", 4], ["hit and run", 4], ["hit-and-run", 4], ["rash driving", 3],
    ["driver", 1], ["motor", 1.5], ["tempo", 1], ["auto rickshaw", 1.5], ["takkar", 3], ["thok", 2],
    ["injured", 1], ["helmet", 1], ["challan", 1.5], ["road", 0.5], ["vehicle loan", 1.5],
  ],
  consumer: [
    ["refund", 3], ["defective", 3], ["warranty", 3], ["consumer", 4], ["seller", 2], ["amazon", 2],
    ["flipkart", 2], ["product", 1.5], ["service centre", 2.5], ["service center", 2.5],
    ["replacement", 2], ["e-commerce", 2], ["online order", 2.5], ["delivery", 1], ["bill", 0.5],
    ["builder", 2], ["flat possession", 3], ["airline", 2], ["flight", 1.5], ["hospital bill", 1],
    ["overcharged", 2.5], ["mrp", 2], ["telecom", 1.5], ["courier", 1.5], ["insurance company", 1],
  ],
  property: [
    ["landlord", 4], ["tenant", 4], ["rent", 2.5], ["evict", 4], ["eviction", 4], ["lease", 2.5],
    ["security deposit", 4], ["deposit", 1.5], ["kirayedar", 4], ["makan malik", 4], ["kiraya", 3],
    ["property", 2], ["possession", 1.5], ["encroach", 3], ["boundary", 2], ["land", 1.5],
    ["mutation", 2], ["title deed", 3], ["sale deed", 3], ["registry", 2], ["flat", 1], ["house", 1],
    ["partition", 2.5], ["ancestral", 2.5],
  ],
  cheque_bounce: [
    ["cheque bounce", 6], ["check bounce", 6], ["bounced cheque", 6], ["cheque", 3.5], ["dishonour", 4],
    ["dishonor", 4], ["138", 3], ["insufficient funds", 4], ["return memo", 4], ["funds insufficient", 4],
  ],
  family: [
    ["divorce", 5], ["husband", 2.5], ["wife", 2.5], ["marriage", 2.5], ["maintenance", 3],
    ["alimony", 4], ["custody", 3.5], ["dowry", 4], ["in-laws", 3], ["in laws", 3], ["sasural", 3],
    ["domestic violence", 5], ["talaq", 4], ["separation", 2.5], ["spouse", 2.5], ["child support", 3],
    ["shaadi", 2.5], ["pati", 2], ["patni", 2],
  ],
  employment: [
    ["salary", 3.5], ["employer", 3], ["fired", 3], ["terminated", 3], ["termination", 3],
    ["wages", 3.5], ["gratuity", 4], ["pf", 1.5], ["provident fund", 3], ["notice period", 3],
    ["resign", 2], ["hr", 1], ["company not paying", 4], ["boss", 2], ["layoff", 3], ["laid off", 3],
    ["relieving letter", 3], ["full and final", 3], ["tankhwah", 3], ["naukri", 2], ["office", 0.5],
    ["harassment at work", 3], ["posh", 3],
  ],
  criminal: [
    ["police", 3], ["fir", 4], ["arrest", 4], ["bail", 4], ["theft", 3.5], ["stolen", 3], ["assault", 3.5],
    ["threat", 2.5], ["beat", 2], ["attacked", 3], ["murder", 4], ["robbery", 3.5], ["chori", 3],
    ["maar", 1.5], ["complaint", 1], ["harass", 1.5], ["blackmail", 3], ["extortion", 3.5],
    ["kidnap", 4], ["molest", 4], ["stalking", 3.5], ["false case", 3.5],
  ],
  cyber: [
    ["upi", 3.5], ["otp", 4], ["scam", 3], ["fraud", 2.5], ["phishing", 4], ["hacked", 3.5],
    ["online fraud", 5], ["cyber", 4], ["fake call", 3], ["kyc", 2.5], ["money deducted", 3],
    ["credit card", 2], ["debit card", 2], ["unauthorised transaction", 5], ["unauthorized transaction", 5],
    ["sextortion", 4], ["loan app", 3.5], ["paytm", 2], ["phonepe", 2], ["gpay", 2], ["link", 1],
    ["scammer", 3.5], ["investment scam", 4], ["task scam", 4],
  ],
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const COMPILED: Record<string, [RegExp, number][]> = Object.fromEntries(
  Object.entries(SIGNALS).map(([k, list]) => [
    k,
    list.map(([kw, w]) => [new RegExp(`(^|[^a-z0-9])${escapeRe(kw)}([^a-z0-9]|$)`, "i"), w] as [RegExp, number]),
  ]),
);

export interface Classification {
  category: string; // taxonomy key or "other"
  subcategory: string; // taxonomy subcategory key or ""
  confidence: number; // 0..1
  scores: Record<string, number>;
}

/** Score free text against every domain. Later turns weigh more than earlier ones. */
export function classify(turns: string[]): Classification {
  const scores: Record<string, number> = {};
  turns.forEach((turn, i) => {
    const recency = 0.6 + 0.4 * ((i + 1) / turns.length);
    for (const [cat, sigs] of Object.entries(COMPILED)) {
      for (const [re, w] of sigs) if (re.test(turn)) scores[cat] = (scores[cat] ?? 0) + w * recency;
    }
  });
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0 || ranked[0][1] < 2.5) {
    return { category: "other", subcategory: "", confidence: 0, scores };
  }
  const [top, topScore] = ranked[0];
  const second = ranked[1]?.[1] ?? 0;
  const confidence = Math.min(1, topScore / 8) * (topScore / (topScore + second));
  return { category: top, subcategory: pickSubcategory(top, turns.join(" ")), confidence, scores };
}

export function pickSubcategory(cat: string, text: string): string {
  const t = text.toLowerCase();
  const subs = TAXONOMY.find((c) => c.key === cat)?.subcategories ?? [];
  if (cat === "motor_vehicle") {
    if (/injur|hospital|death|died|fracture|medical|hurt|disab/.test(t)) return "injury_compensation";
    return "accident_claim_loan_dispute";
  }
  if (cat === "property" && /deposit/.test(t) && !/evict/.test(t)) return "security_deposit";
  return subs[0]?.key ?? "";
}

const GREETING = /^\s*(hi|hello|hey|namaste|namaskar|good (morning|afternoon|evening)|hii+)\b[\s!.]*$/i;

export interface TriageAnswer {
  answer: string;
  category: string;
  subcategory: string;
  act: string;
  summary: string;
  rights: string[];
  nextSteps: string[];
  documents: string[];
}

/** Build a plain-language answer from the deterministic guide. */
export function triage(userTurns: string[], opts: { placeLabel?: string; courtName?: string } = {}): TriageAnswer {
  const last = userTurns[userTurns.length - 1] ?? "";
  const c = classify(userTurns);

  if (c.category === "other") {
    const answer = GREETING.test(last)
      ? "Namaste! Tell me in your own words what happened — for example “my landlord won’t return my deposit” or “a car hit my bike and the driver won’t pay”. I’ll explain which law applies, your rights, and the next step."
      : "I want to make sure I point you to the right law. Could you tell me a little more — what happened, who is involved (for example a landlord, employer, seller, spouse, police, or another driver), and roughly when it happened?";
    return {
      answer,
      category: "other",
      subcategory: "",
      act: "",
      summary: last.slice(0, 140),
      rights: [],
      nextSteps: [],
      documents: [],
    };
  }

  const g = GUIDES[c.category];
  const label = TAXONOMY.find((t) => t.key === c.category)?.label ?? c.category;
  const sub = getChecklist(c.category, c.subcategory);
  const docs = (sub?.checklist ?? []).slice(0, 5);

  const parts: string[] = [];
  if (g.urgent) parts.push(`⚠️ ${g.urgent}`);
  parts.push(`This looks like a ${label.toLowerCase()} matter. The main law is the ${g.act}, and it is usually handled by the ${g.forum}.`);
  parts.push(`Your rights, in short:\n${g.rights.map((r) => `• ${r}`).join("\n")}`);
  parts.push(`What to do next:\n${g.nextSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
  if (opts.placeLabel) {
    parts.push(
      `Since you're in ${opts.placeLabel}${opts.courtName ? ` (nearest court complex: ${opts.courtName})` : ""}, I can show verified advocates nearby, or — with your consent — share a short summary so one can reach out.`,
    );
  } else {
    parts.push("Tell me your city (or tap “Use my location”) and I can show verified advocates near you.");
  }
  parts.push("This is general information, not legal advice.");

  return {
    answer: parts.join("\n\n"),
    category: c.category,
    subcategory: c.subcategory,
    act: g.act,
    summary: summarize(userTurns, label),
    rights: g.rights,
    nextSteps: g.nextSteps,
    documents: docs,
  };
}

/** A short, neutral one-line case summary for the lead card (no identifiers — PII is redacted upstream). */
export function summarize(userTurns: string[], label: string): string {
  // Prefer the most descriptive user turn (longest), not a bare "Delhi" follow-up.
  const best = [...userTurns].sort((a, b) => b.length - a.length)[0] ?? "";
  const clean = best.replace(/\s+/g, " ").trim();
  const clipped = clean.length > 160 ? `${clean.slice(0, 157)}…` : clean;
  return clipped ? `${label}: ${clipped}` : label;
}
