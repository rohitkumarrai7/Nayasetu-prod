import { describe, expect, it } from "vitest";
import { keywords, passageSupported, similarity } from "./text";

describe("similarity", () => {
  it("is 1 for identical, high for near, low for unrelated", () => {
    expect(similarity("Swaran Singh", "Swaran Singh")).toBe(1);
    expect(
      similarity(
        "National Insurance Co Ltd v Swaran Singh",
        "National Insurance Co. Ltd. v. Swaran Singh",
      ),
    ).toBeGreaterThan(0.82);
    expect(similarity("Swaran Singh", "Lucknow Development Authority")).toBeLessThan(0.4);
  });
});

describe("keywords", () => {
  it("drops stopwords", () => {
    const kw = keywords("the insurer refused the claim on the vehicle loan");
    expect(kw).not.toContain("the");
    expect(kw.some((w) => ["insurer", "claim", "vehicle", "loan"].includes(w))).toBe(true);
  });
});

describe("passageSupported", () => {
  it("accepts a passage whose words are in the doc, rejects an alien passage", () => {
    const doc = "The insurer must satisfy the claim under the Motor Vehicles Act.";
    expect(passageSupported("insurer must satisfy the claim", doc)).toBe(true);
    expect(passageSupported("quantum physics governs interstellar treaty obligations", doc)).toBe(
      false,
    );
  });
});

import { extractiveSummary } from "./text";
describe("extractiveSummary", () => {
  it("skips disclaimers and does not split on legal abbreviations", () => {
    const s = extractiveSummary(
      "Editorial summary (NyayaSetu demo corpus) — verify against the full judgment. The Court in National Insurance Co. Ltd. v. Pranay Sethi settled future prospects. It also fixed conventional heads.",
    );
    expect(s.startsWith("The Court in National Insurance Co. Ltd. v. Pranay Sethi settled")).toBe(true);
    expect(s).not.toMatch(/Editorial summary/);
  });
});
