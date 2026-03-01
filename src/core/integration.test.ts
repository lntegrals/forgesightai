/**
 * integration.test.ts — End-to-end golden path test.
 *
 * Tests the full lifecycle: create → extract → confirm → quote → PDF → actuals → variance.
 * Uses core functions directly (no HTTP server required).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createRfq, getRfq, updateRfq, recordActuals, resetStore, getAllRfqs, findByExternalId } from "./store";
import { extractFields } from "./extractor";
import { computeQuote } from "./pricing";
import { buildQuotePdf } from "./pdf";
import { computeVariance } from "./variance";
import {
  ExtractorMode,
  RFQStatus,
  AuditAction,
  Actor,
  DEFAULT_SHOP_CONFIG,
  type Actuals,
} from "./types";

const SAMPLE_RFQ_TEXT = `REQUEST FOR QUOTE — CNC Bracket
From: Test Customer Inc.
Subject: Aluminum Bracket — Qty 100

Part Number: TEST-001
Material: Aluminum 6061-T6
Quantity: 100 pieces
Tolerance: ±0.005"
Surface Finish: Anodized Type II
Process: 3-axis CNC milling
Due Date: April 30, 2026

Notes: Standard lead time acceptable.`;

beforeEach(() => {
  resetStore();
});

describe("Integration: Full golden path", () => {
  it("create → extract → confirm → quote → PDF → actuals → variance", async () => {
    // ── Step 1: Create RFQ ───────────────────────────────────────────────────
    const rfq = createRfq({
      customerName: "Test Customer Inc.",
      subject: "Aluminum Bracket — Qty 100",
      rawText: SAMPLE_RFQ_TEXT,
      sourceType: "manual",
    });

    expect(rfq.id).toBeTruthy();
    expect(rfq.status).toBe(RFQStatus.NEW);
    expect(rfq.quote).toBeNull();
    expect(rfq.audit).toHaveLength(1);
    expect(rfq.audit[0].action).toBe(AuditAction.RFQ_CREATED);

    // ── Step 2: Extract fields (MOCK mode — no API key required) ─────────────
    const fields = await extractFields(SAMPLE_RFQ_TEXT, ExtractorMode.MOCK);

    expect(fields.length).toBeGreaterThan(0);

    const materialField = fields.find((f) => f.key === "material");
    expect(materialField).toBeDefined();
    expect(materialField!.value).toMatch(/aluminum|6061/i);
    expect(materialField!.confidence).toBeGreaterThan(0);

    const quantityField = fields.find((f) => f.key === "quantity");
    expect(quantityField).toBeDefined();
    expect(quantityField!.value).toBe("100");

    // All fields should have required properties
    for (const field of fields) {
      expect(field.key).toBeTruthy();
      expect(field.label).toBeTruthy();
      expect(field.value).toBeTruthy();
      expect(field.confidence).toBeGreaterThanOrEqual(0);
      expect(field.confidence).toBeLessThanOrEqual(1);
      expect(field.isConfirmed).toBe(false);
      expect(field.userOverrideValue).toBeNull();
    }

    // ── Step 3: Confirm all fields ───────────────────────────────────────────
    const confirmedFields = fields.map((f) => ({ ...f, isConfirmed: true }));
    updateRfq(rfq.id, {
      extractedFields: confirmedFields,
      status: RFQStatus.NEEDS_REVIEW,
    });

    const afterExtract = getRfq(rfq.id)!;
    expect(afterExtract.extractedFields.every((f) => f.isConfirmed)).toBe(true);

    // ── Step 4: Generate quote (deterministic pricing) ───────────────────────
    const pricingInputs = {
      quantity: 100,
      materialCostPerUnit: 4.75,
      materialQty: 1,
      setupHours: 2,
      laborHours: 5,
      machineHours: 3,
    };

    const quote = computeQuote(pricingInputs, DEFAULT_SHOP_CONFIG);

    expect(quote.lineItems).toHaveLength(6);
    expect(quote.totals.total).toBeGreaterThan(0);
    expect(isNaN(quote.totals.total)).toBe(false);

    // Material: 100 * 4.75 * 1 = 475
    expect(quote.lineItems[0].amount).toBe(475);
    // Setup: 2 * 85 = 170
    expect(quote.lineItems[1].amount).toBe(170);
    // Run Time: 3 * 120 = 360
    expect(quote.lineItems[2].amount).toBe(360);
    // Labor: 5 * 65 = 325
    expect(quote.lineItems[3].amount).toBe(325);
    // Subtotal: 475 + 170 + 360 + 325 = 1330
    expect(quote.totals.subtotal).toBe(1330);

    updateRfq(rfq.id, { quote, status: RFQStatus.READY_TO_SEND });

    const withQuote = getRfq(rfq.id)!;
    expect(withQuote.quote).not.toBeNull();
    expect(withQuote.status).toBe(RFQStatus.READY_TO_SEND);

    // ── Step 5: Generate PDF ─────────────────────────────────────────────────
    const pdfBuffer = await buildQuotePdf(withQuote);

    // Valid PDF: starts with %PDF header
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.slice(0, 4).toString()).toBe("%PDF");

    // ── Step 6: Simulate send ────────────────────────────────────────────────
    updateRfq(rfq.id, { status: RFQStatus.SENT });
    const sent = getRfq(rfq.id)!;
    expect(sent.status).toBe(RFQStatus.SENT);

    // ── Step 7: Record actuals ───────────────────────────────────────────────
    const actuals: Actuals = {
      materialCost: 520,    // over estimate (475)
      setupHours: 2.5,      // slightly over (2 hrs)
      laborHours: 4.0,      // under estimate (5 hrs)
      machineHours: 3.5,    // slightly over (3 hrs)
      notes: "Material cost up due to alloy shortage",
      recordedAt: new Date().toISOString(),
    };

    const withActuals = recordActuals(rfq.id, actuals)!;
    expect(withActuals.actuals).toBeDefined();
    expect(withActuals.actuals!.materialCost).toBe(520);

    // Audit should have ACTUALS_RECORDED
    const actualsEvent = withActuals.audit.find((e) => e.action === AuditAction.ACTUALS_RECORDED);
    expect(actualsEvent).toBeDefined();
    expect(actualsEvent!.actor).toBe(Actor.USER);

    // ── Step 8: Compute variance ─────────────────────────────────────────────
    const report = computeVariance(withActuals.quote!, withActuals.actuals!, DEFAULT_SHOP_CONFIG);

    expect(typeof report.totalDelta).toBe("number");
    expect(isNaN(report.totalDelta)).toBe(false);
    expect(report.lines).toHaveLength(6);

    // Material variance: actual 520 vs estimate 475 → delta = +45
    const matLine = report.lines.find((l) => l.label === "Material Cost");
    expect(matLine).toBeDefined();
    expect(matLine!.actual).toBe(520);
    expect(matLine!.estimate).toBe(475);
    expect(matLine!.delta).toBe(45);
    expect(matLine!.deltaPct).toBeCloseTo(9.47, 1);

    // Labor: actual 4h * $65 = $260 vs estimate $325 → delta = -65
    const laborLine = report.lines.find((l) => l.label === "Labor Cost");
    expect(laborLine).toBeDefined();
    expect(laborLine!.actual).toBe(260);
    expect(laborLine!.estimate).toBe(325);
    expect(laborLine!.delta).toBe(-65);

    // totals are numbers
    expect(report.estimateTotal).toBe(withActuals.quote!.totals.total);
    expect(report.actualTotal).toBeGreaterThan(0);
    expect(report.estimateMarginPct).toBe(DEFAULT_SHOP_CONFIG.marginPct);
    expect(report.actualMarginPct).toBe(DEFAULT_SHOP_CONFIG.marginPct);
  });

  it("LLM mode falls back to MOCK when no API key set", async () => {
    // Ensure no API key in test environment
    const savedKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const fields = await extractFields(SAMPLE_RFQ_TEXT, ExtractorMode.LLM);

    expect(fields.length).toBeGreaterThan(0);
    const mat = fields.find((f) => f.key === "material");
    expect(mat).toBeDefined();

    if (savedKey) process.env.ANTHROPIC_API_KEY = savedKey;
  });

  it("Zod ExtractedRFQSchema validates correct data", async () => {
    const { ExtractedRFQSchema } = await import("./extractor");
    const validPayload = {
      fields: [
        {
          key: "material",
          label: "Material",
          value: "6061-T6",
          confidence: 0.9,
          sourceSnippet: "Material: 6061-T6",
          sourceRef: "Line 5",
        },
      ],
    };
    const result = ExtractedRFQSchema.parse(validPayload);
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0].key).toBe("material");
  });

  it("PDF is valid bytes starting with %PDF", async () => {
    const rfq = createRfq({
      customerName: "PDF Test Corp",
      subject: "Test Quote",
      rawText: SAMPLE_RFQ_TEXT,
    });
    const quote = computeQuote(
      { quantity: 50, materialCostPerUnit: 10, materialQty: 1, setupHours: 1, laborHours: 2, machineHours: 1 },
      DEFAULT_SHOP_CONFIG
    );
    updateRfq(rfq.id, { quote, status: RFQStatus.READY_TO_SEND });
    const withQuote = getRfq(rfq.id)!;

    const buf = await buildQuotePdf(withQuote);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
    expect(buf.length).toBeGreaterThan(500);
  });

  it("resetStore re-seeds with 3 demo RFQs", () => {
    // Add a custom RFQ
    createRfq({ customerName: "Temp", subject: "Temp", rawText: "temp" });
    resetStore();

    const rfqs = getAllRfqs();
    expect(rfqs.length).toBe(4); // 4 seed RFQs
  });

  it("webhook deduplication via externalId", () => {
    const rfq = createRfq({
      customerName: "External Co",
      subject: "Webhook RFQ",
      rawText: "some rfq text",
      externalId: "ext-abc-123",
      sourceType: "webhook",
    });
    const found = findByExternalId("ext-abc-123");
    expect(found).toBeDefined();
    expect(found!.id).toBe(rfq.id);
    expect(findByExternalId("nonexistent")).toBeUndefined();
  });

  it("/api/rfqs/search returns results deterministically (no GEMINI_API_KEY needed)", async () => {
    const { searchRFQs } = await import("./query");
    const { rows: r1 } = await searchRFQs({ q: "reynolds" });
    const { rows: r2 } = await searchRFQs({ q: "reynolds" });
    expect(r1.map((r) => r.id)).toEqual(r2.map((r) => r.id));
  });

  it("quote returns 400 when clarifier exists with unanswered required questions", async () => {
    const { isClarifierComplete } = await import("./clarifier");
    const rfq = createRfq({
      customerName: "Clarifier Test",
      subject: "Gated Quote",
      rawText: SAMPLE_RFQ_TEXT,
    });

    // Inject a clarifier with one required unanswered question
    updateRfq(rfq.id, {
      extractedFields: [
        {
          key: "material", label: "Material", value: "Aluminum", confidence: 0.95,
          sourceSnippet: "Material: Aluminum", sourceRef: "Line 1",
          isConfirmed: true, userOverrideValue: null,
        },
      ],
      clarifier: {
        questions: [
          {
            id: "q1",
            question: "What exact alloy grade is required?",
            required: true,
            rationale: "Affects machinability cost",
            confidence: 0.9,
          },
        ],
        assumptions: [],
        riskFlags: [],
        generatedAt: new Date().toISOString(),
        engine: "gemini",
        model: "gemini-2.5-flash",
        promptVersion: "gemini-clarifier-v1",
      },
    });

    const withClarifier = getRfq(rfq.id)!;
    const { ok, missing } = isClarifierComplete(withClarifier);
    expect(ok).toBe(false);
    expect(missing.length).toBeGreaterThan(0);

    // After answering, should be complete
    updateRfq(rfq.id, { clarifierAnswers: { q1: "6061-T6" } });
    const answered = getRfq(rfq.id)!;
    const { ok: ok2 } = isClarifierComplete(answered);
    expect(ok2).toBe(true);
  });
});
