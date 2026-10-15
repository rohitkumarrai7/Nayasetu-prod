import { v } from "convex/values";
import { query } from "./_generated/server";
import { getChecklist, TAXONOMY } from "./lib/taxonomy";

// L1 intake taxonomy + path-specific checklists. Public (no privileged data).
export const taxonomy = query({
  args: {},
  handler: async () => TAXONOMY,
});

export const checklist = query({
  args: { category: v.string(), subcategory: v.string() },
  handler: async (_ctx, { category, subcategory }) => {
    const sub = getChecklist(category, subcategory);
    if (!sub) return null;
    return {
      category,
      subcategory,
      label: sub.label,
      checklist: sub.checklist,
      suggestedDocTypes: sub.suggestedDocTypes,
      researchSeed: sub.researchSeed,
    };
  },
});
