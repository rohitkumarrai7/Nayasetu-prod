import { describe, expect, it } from "vitest";
import { extractCaseNames, guardAnswer, nameMatches } from "./answerGuard";

const SOURCES = ["National Insurance Co. Ltd. v. Swaran Singh", "Sarla Verma v. Delhi Transport Corporation"];

describe("extractCaseNames", () => {
  it("finds case names with abbreviations and initials", () => {
    const names = extractCaseNames(
      "In National Insurance Co. Ltd. v. Swaran Singh, the Court held X. See also Lucknow Development Authority v. M.K. Gupta.",
    ).map((c) => c.name);
    expect(names).toContain("National Insurance Co. Ltd. v. Swaran Singh");
    expect(names.some((n) => n.startsWith("Lucknow Development Authority v. M.K. Gupta"))).toBe(true);
  });

  it("ignores generic party labels", () => {
    expect(extractCaseNames("The Plaintiff v. Defendant dispute turns on notice.")).toEqual([]);
  });
});

describe("nameMatches", () => {
  it("accepts short forms and spelling variants of a known case", () => {
    expect(nameMatches("National Insurance Company v. Swaran Singh", SOURCES)).toBe(true);
    expect(nameMatches("Sarla Verma v. Union of India", SOURCES)).toBe(false);
    expect(nameMatches("Sarla Verma v. Delhi Transport Corp", SOURCES)).toBe(true);
  });
});

describe("guardAnswer (drop-not-flag)", () => {
  const base = { sourceCount: 2, sourceCaseNames: SOURCES, sourceCitationKeys: ["SCC:2004:3:297"] };

  it("keeps sentences backed by sources and drops ones citing unknown cases", () => {
    const r = guardAnswer({
      ...base,
      answer:
        "The insurer must prove fault, as held in National Insurance Co. Ltd. v. Swaran Singh [1]. " +
        "This was also affirmed in Ramesh Kumar v. Imaginary Insurance Ltd. (2019) 4 SCC 999. " +
        "Multiplier tables apply [2].",
    });
    expect(r.text).toContain("Swaran Singh [1]");
    expect(r.text).toContain("Multiplier tables apply [2]");
    expect(r.text).not.toContain("Ramesh Kumar");
    expect(r.text).not.toContain("4 SCC 999");
    expect(r.removed.length).toBe(1);
  });

  it("drops unverified reporter citations and dangling [n] markers", () => {
    const r = guardAnswer({
      ...base,
      answer: "- Point one (2004) 3 SCC 297 [1].\n- Point two AIR 2011 SC 9999.\n- Point three [7].",
    });
    expect(r.text).toContain("(2004) 3 SCC 297 [1]");
    expect(r.text).not.toContain("AIR 2011");
    expect(r.text).not.toContain("[7]");
    expect(r.text).toContain("Point three");
  });

  it("allows authorities the caller resolved against the corpus", () => {
    const r = guardAnswer({
      ...base,
      answer: "See Pranay Sethi v. National Insurance Co. Ltd. for the 40% addition.",
      corpusCaseNames: ["National Insurance Co. Ltd. v. Pranay Sethi", "Pranay Sethi v. National Insurance Co. Ltd."],
    });
    expect(r.removed).toEqual([]);
    expect(r.text).toContain("Pranay Sethi");
  });

  it("normalises 【n】 and [1, 2] markers", () => {
    const r = guardAnswer({ ...base, answer: "Held so 【2】 and so [1, 2]." });
    expect(r.text).toBe("Held so [2] and so [1][2].");
  });
});
