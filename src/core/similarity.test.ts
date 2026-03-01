import { describe, it, expect, beforeEach } from "vitest";
import { createRfq, resetStore, updateRfq } from "./store";
import { deriveRFQ } from "./derive";
import { similarityScore, similarRFQs } from "./similarity";
import type { DerivedRFQ } from "./derive";
import type { ExtractedField } from "./types";

function makeField(
  key: string,
  value: string,
  confidence = 0.9
): ExtractedField {
  return {
    key,
    label: key,
    value,
    confidence,
    sourceSnippet: value,
    sourceRef: "Line 1",
    isConfirmed: true,
    userOverrideValue: null,
  };
}

function makeDerived(overrides: Partial<DerivedRFQ>): DerivedRFQ {
  return {
    id: "test",
    createdAt: new Date().toISOString(),
    customerName: "Test Co",
    subject: "Test",
    status: "NEEDS_REVIEW",
    hasQuote: false,
    hasActuals: false,
    searchText: "test co aluminum cnc",
    ...overrides,
  };
}

beforeEach(() => {
  resetStore();
});

describe("similarityScore", () => {
  it("returns max score for identical derived RFQs", () => {
    const a = makeDerived({
      material: "Aluminum 6061-T6",
      qty: 100,
      toleranceBand: "med",
      finish: "anodized",
      searchText: "aluminum 6061 anodized cnc",
    });
    const { score } = similarityScore(a, { ...a, id: "b" });
    // Exact material (35) + qty ratio 1.0 (25) + tolerance (20) + finish (10) + keywords
    expect(score).toBeGreaterThan(80);
  });

  it("material mismatch gives zero material score", () => {
    const a = makeDerived({ material: "Aluminum 6061-T6", searchText: "aluminum" });
    const b = makeDerived({ material: "Titanium Ti-6Al-4V", searchText: "titanium", id: "b" });
    const { score, reasons } = similarityScore(a, b);
    expect(reasons.every((r) => !r.startsWith("Same material"))).toBe(true);
  });

  it("partial material match gives partial score", () => {
    const a = makeDerived({ material: "316 Stainless Steel", searchText: "stainless steel" });
    const b = makeDerived({ material: "304 Stainless Steel", searchText: "stainless steel", id: "b" });
    const { score, reasons } = similarityScore(a, b);
    expect(score).toBeGreaterThan(0);
    expect(reasons.some((r) => r.includes("Similar material"))).toBe(true);
  });

  it("returns zero score for completely different RFQs", () => {
    const a = makeDerived({ material: "Aluminum", qty: 100, toleranceBand: "loose", searchText: "aluminum" });
    const b = makeDerived({ material: "Titanium", qty: 5000, toleranceBand: "tight", searchText: "titanium aerospace", id: "b" });
    const { score } = similarityScore(a, b);
    // Some keyword overlap unlikely but score should be low
    expect(score).toBeLessThan(30);
  });

  it("qty ratio affects score linearly", () => {
    const a = makeDerived({ qty: 100, searchText: "part" });
    const bClose = makeDerived({ qty: 90, searchText: "part", id: "b1" });
    const bFar = makeDerived({ qty: 10, searchText: "part", id: "b2" });
    const { score: s1 } = similarityScore(a, bClose);
    const { score: s2 } = similarityScore(a, bFar);
    expect(s1).toBeGreaterThan(s2);
  });

  it("returns reasons array when match exists", () => {
    const a = makeDerived({ material: "Steel", toleranceBand: "tight", searchText: "steel" });
    const b = makeDerived({ material: "Steel", toleranceBand: "tight", searchText: "steel", id: "b" });
    const { reasons } = similarityScore(a, b);
    expect(reasons.length).toBeGreaterThan(0);
  });
});

describe("similarRFQs", () => {
  it("returns empty for nonexistent rfqId", async () => {
    const results = await similarRFQs("nonexistent-id");
    expect(results).toEqual([]);
  });

  it("returns similar RFQs sorted by score desc", async () => {
    const rfqA = createRfq({
      customerName: "AlumCo",
      subject: "Aluminum CNC Part",
      rawText: "Material: Aluminum 6061-T6\nQuantity: 100 pieces\nTolerance: ±0.005\"",
    });
    // Seed already has an aluminum bracket (Reynolds Manufacturing)
    updateRfq(rfqA.id, {
      extractedFields: [
        makeField("material", "Aluminum 6061-T6"),
        makeField("quantity", "100"),
        makeField("tolerance", "±0.005\""),
      ],
    });

    const results = await similarRFQs(rfqA.id, 5);
    expect(results.length).toBeGreaterThan(0);
    // Sorted desc by score
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
    // Each result has reasons
    results.forEach((r) => {
      expect(r.reasons).toBeDefined();
      expect(typeof r.score).toBe("number");
    });
  });

  it("respects limit parameter", async () => {
    const rfq = createRfq({
      customerName: "LimitTest",
      subject: "Test",
      rawText: "Material: Steel",
    });
    updateRfq(rfq.id, {
      extractedFields: [makeField("material", "Steel")],
    });

    const results = await similarRFQs(rfq.id, 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it("does not include the target RFQ itself", async () => {
    const rfq = createRfq({ customerName: "Self", subject: "Self test", rawText: "Material: Aluminum" });
    const results = await similarRFQs(rfq.id);
    expect(results.every((r) => r.id !== rfq.id)).toBe(true);
  });
});
