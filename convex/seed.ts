import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { DEMO_CORPUS } from "./lib/demoData";

// Load the demo judgment corpus into the shared vector index. Idempotent — safe to re-run.
// Requires an authenticated caller (any signed-in user) to avoid anonymous abuse.
export const loadDemoCorpus = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    seen: number;
    ingested: number;
    skippedLowQuality: number;
    skippedDuplicate: number;
    chunks: number;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Sign in to load the demo corpus");
    return ctx.runAction(internal.ingest.ingestRecords, { records: DEMO_CORPUS });
  },
});
