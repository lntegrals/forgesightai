/**
 * clarifier.test.ts — Tests for isClarifierComplete (no Gemini calls).
 * generateClarifier is not tested here as it requires GEMINI_API_KEY.
 */
import { describe, it, expect } from "vitest";
import { isClarifierComplete } from "./clarifier";
import type { RFQ, ClarifierOutput } from "./types";
import { RFQStatus, Actor, AuditAction } from "./types";

function makeRFQ(overrides: Partial<RFQ> = {}): RFQ {
  return {
    id: "test-id",
    createdAt: new Date().toISOString(),
    customerName: "Test Co",
    subject: "Test",
    status: RFQStatus.NEEDS_REVIEW,
    rawText: "test",
    extractedFields: [],
    quote: null,
    audit: [{ at: new Date().toISOString(), actor: Actor.SYSTEM, action: AuditAction.RFQ_CREATED, detail: "test" }],
    ...overrides,
  };
}

function makeClarifier(overrides: Partial<ClarifierOutput> = {}): ClarifierOutput {
  return {
    questions: [],
    assumptions: [],
    riskFlags: [],
    generatedAt: new Date().toISOString(),
    engine: "gemini",
    model: "gemini-2.5-flash",
    promptVersion: "gemini-clarifier-v1",
    ...overrides,
  };
}

describe("isClarifierComplete", () => {
  it("returns ok:true when no clarifier exists (legacy flow)", () => {
    const rfq = makeRFQ();
    const result = isClarifierComplete(rfq);
    expect(result.ok).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("returns ok:true when clarifier has no required questions", () => {
    const rfq = makeRFQ({
      clarifier: makeClarifier({
        questions: [
          {
            id: "q1",
            question: "What is the preferred finish color?",
            required: false,
            rationale: "Optional aesthetic preference",
            confidence: 0.5,
          },
        ],
      }),
    });
    const result = isClarifierComplete(rfq);
    expect(result.ok).toBe(true);
  });

  it("returns ok:false with missing list when required question unanswered", () => {
    const rfq = makeRFQ({
      clarifier: makeClarifier({
        questions: [
          {
            id: "q1",
            question: "What exact material grade is required?",
            required: true,
            rationale: "Grade affects machinability and cost",
            confidence: 0.9,
          },
        ],
      }),
    });
    const result = isClarifierComplete(rfq);
    expect(result.ok).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
    expect(result.missing[0]).toMatch(/material grade/i);
  });

  it("returns ok:true when required question is answered", () => {
    const rfq = makeRFQ({
      clarifier: makeClarifier({
        questions: [
          {
            id: "q1",
            question: "What exact material grade is required?",
            required: true,
            rationale: "Grade affects machinability and cost",
            confidence: 0.9,
          },
        ],
      }),
      clarifierAnswers: { q1: "6061-T6" },
    });
    const result = isClarifierComplete(rfq);
    expect(result.ok).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("returns ok:true when required question is covered by confirmed assumption", () => {
    const rfq = makeRFQ({
      clarifier: makeClarifier({
        questions: [
          {
            id: "q1",
            question: "What finish is required?",
            required: true,
            rationale: "Affects cost",
            confidence: 0.8,
          },
        ],
        assumptions: [
          {
            id: "a1",
            assumption: "Assuming standard anodize Type II finish",
            appliesToKeys: ["q1"],
            confidence: 0.85,
          },
        ],
      }),
      confirmedAssumptions: ["a1"],
    });
    const result = isClarifierComplete(rfq);
    expect(result.ok).toBe(true);
  });

  it("returns ok:false when assumption exists but not confirmed", () => {
    const rfq = makeRFQ({
      clarifier: makeClarifier({
        questions: [
          {
            id: "q1",
            question: "What finish is required?",
            required: true,
            rationale: "Affects cost",
            confidence: 0.8,
          },
        ],
        assumptions: [
          {
            id: "a1",
            assumption: "Assuming standard anodize Type II finish",
            appliesToKeys: ["q1"],
            confidence: 0.85,
          },
        ],
      }),
      // confirmedAssumptions intentionally absent
    });
    const result = isClarifierComplete(rfq);
    expect(result.ok).toBe(false);
  });

  it("handles multiple required questions — all must be addressed", () => {
    const rfq = makeRFQ({
      clarifier: makeClarifier({
        questions: [
          { id: "q1", question: "Material grade?", required: true, rationale: "cost", confidence: 0.9 },
          { id: "q2", question: "Certifications?", required: true, rationale: "compliance", confidence: 0.9 },
        ],
      }),
      clarifierAnswers: { q1: "6061-T6" }, // q2 not answered
    });
    const result = isClarifierComplete(rfq);
    expect(result.ok).toBe(false);
    expect(result.missing.length).toBe(1);
    expect(result.missing[0]).toMatch(/certifications/i);
  });
});
