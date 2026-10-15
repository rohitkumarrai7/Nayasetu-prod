import { describe, expect, it } from "vitest";
import { courtRecords, findPlace, resolveCity } from "./districtCourts";
import { bucketOf, geohashDecode, geohashEncode, geohashNeighbors, haversineKm, nearestCourts } from "./geo";
import { classify, triage } from "./legalTriage";
import { buildDraft } from "./draftTemplates";

describe("geo primitives", () => {
  it("haversine: Delhi→Mumbai ≈ 1150 km", () => {
    const d = haversineKm({ lat: 28.6139, lng: 77.209 }, { lat: 19.076, lng: 72.8777 });
    expect(d).toBeGreaterThan(1130);
    expect(d).toBeLessThan(1170);
  });
  it("geohash round-trips and neighbours cover the cell", () => {
    const h = geohashEncode(28.6139, 77.209, 6);
    expect(h).toBe("ttnfuc"); // verified against pygeohash
    expect(geohashEncode(57.64911, 10.40744, 11)).toBe("u4pruydqqvj"); // canonical example
    const c = geohashDecode(h);
    expect(Math.abs(c.lat - 28.6139)).toBeLessThan(0.01);
    expect(geohashNeighbors(bucketOf({ lat: 28.6, lng: 77.2 }))).toHaveLength(9);
  });
  it("a 40 km radius never escapes cell + neighbours", () => {
    const center = { lat: 28.6, lng: 77.2 };
    const cells = new Set(geohashNeighbors(bucketOf(center)));
    for (let a = 0; a < 360; a += 15) {
      const p = { lat: center.lat + (40 / 111) * Math.sin((a * Math.PI) / 180), lng: center.lng + (40 / (111 * Math.cos((28.6 * Math.PI) / 180))) * Math.cos((a * Math.PI) / 180) };
      expect(cells.has(bucketOf(p))).toBe(true);
    }
  });
  it("nearest 5 courts to Connaught Place are Delhi courts", () => {
    const near = nearestCourts({ lat: 28.6315, lng: 77.2167 }, courtRecords(), 5);
    expect(near).toHaveLength(5);
    expect(near.every((c) => c.state === "Delhi")).toBe(true);
  });
  it("court seed is sane (unique codes, inside India)", () => {
    const rows = courtRecords();
    expect(new Set(rows.map((r) => r.code)).size).toBe(rows.length);
    for (const r of rows) {
      expect(r.lat).toBeGreaterThan(6);
      expect(r.lat).toBeLessThan(37);
      expect(r.lng).toBeGreaterThan(68);
      expect(r.lng).toBeLessThan(98);
    }
  });
});

describe("place recognition", () => {
  it("handles aliases and old names", () => {
    expect(resolveCity("Bangalore")?.courtCode).toBe("KA-BLR");
    expect(resolveCity("gurgaon")?.courtCode).toBe("HR-GGN");
    expect(findPlace("I stay near Whitefield")?.courtCode).toBe("KA-BLR");
    expect(findPlace("This happened in New Delhi")?.courtCode).toBe("DL-PHC");
  });
  it("doesn't treat Hindi words as places", () => {
    expect(findPlace("mera paisa le gaya")).toBeNull();
    expect(findPlace("I live in Gaya")?.courtCode).toBe("BR-GAY");
  });
});

describe("legal triage", () => {
  it.each([
    ["landlord won't return deposit", "property"],
    ["cheque bounce ho gaya", "cheque_bounce"],
    ["OTP fraud on UPI, money deducted", "cyber"],
    ["salary not paid by employer", "employment"],
    ["husband demands dowry", "family"],
    ["police won't file FIR", "criminal"],
    ["defective fridge, seller refuses refund", "consumer"],
    ["car accident, insurer rejected my claim", "motor_vehicle"],
    ["hi", "other"],
  ])("%s → %s", (text, cat) => {
    expect(classify([text]).category).toBe(cat);
  });
  it("answers name the Act and always disclaim", () => {
    const a = triage(["my cheque bounced"]);
    expect(a.act).toMatch(/Negotiable Instruments Act/);
    expect(a.answer).toMatch(/not legal advice/);
  });
});

describe("draft templates", () => {
  it("inserts only the supplied authorities and marks gaps", () => {
    const d = buildDraft({
      docType: "legal_notice",
      issue: "Refund of deposit",
      facts: "",
      clientName: "A",
      authorities: [{ caseName: "X v. Y", citationString: "(2000) 1 SCC 1", relevancePassage: "" }],
    });
    expect(d).toContain("X v. Y, (2000) 1 SCC 1");
    expect(d).toContain("[TO CONFIRM");
  });
});
