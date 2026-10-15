import { v } from "convex/values";
import { action } from "./_generated/server";
import { triage } from "./lib/legalTriage";
import { complete, hasLiveProvider } from "./lib/llm";
import { redactPii } from "./lib/pii";

// C1 single-shot info question (the conversational flow is chat.respond). Information, NOT advice.
// Non-privileged → free tier permitted, so PII is redacted before the prompt leaves the process.
const DISCLAIMER =
  "This is general legal information, not legal advice, and does not create an advocate-client " +
  "relationship. For advice on your situation, please consult a verified advocate.";

const SYS =
  "You provide general legal INFORMATION about Indian law to the public. You do NOT give advice, " +
  "predict outcomes, or draft documents. Keep it plain-language and neutral, use current law (BNS/BNSS/BSA " +
  "replaced IPC/CrPC/Evidence Act from 1 July 2024), never invent case citations, and end by suggesting " +
  "the person consult a qualified advocate.";

export const ask = action({
  args: { question: v.string() },
  handler: async (_ctx, { question }) => {
    const safe = redactPii(question.slice(0, 4000)).text;
    if (hasLiveProvider("general")) {
      try {
        const res = await complete("general", SYS, safe, { timeoutMs: 20_000, maxTokens: 700 });
        if (res.provider !== "echo" && res.text.trim()) {
          return { answer: res.text.trim(), disclaimer: DISCLAIMER, modelUsed: `${res.provider}:${res.model}` };
        }
      } catch {
        /* fall back to rules */
      }
    }
    return { answer: triage([safe]).answer, disclaimer: DISCLAIMER, modelUsed: "rules:triage" };
  },
});
