import { NextRequest, NextResponse } from "next/server";
import { getRfq, updateRfq, appendAudit } from "@/core/store";
import { extractFields, cleanRfqText, extractFieldsGemini } from "@/core/extractor";
import { generateClarifier } from "@/core/clarifier";
import { RFQStatus, Actor, AuditAction, ExtractorMode } from "@/core/types";
import type { ExtractionMeta, RfqCleaning } from "@/core/types";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rfq = getRfq(id);
  if (!rfq) {
    return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
  }

  let fields = rfq.extractedFields;
  let cleaning: RfqCleaning | undefined;
  let extractionMeta: ExtractionMeta | undefined;

  if (process.env.GEMINI_API_KEY) {
    // ── Gemini path: clean → extract → clarify ────────────────────────────

    // 1. Clean
    const cleanResult = await cleanRfqText(rfq.rawText);
    if (cleanResult.ok) {
      cleaning = cleanResult.cleaning;
      extractionMeta = cleanResult.meta;
    }

    // 2. Extract (with cleaned text if available)
    const extractResult = await extractFieldsGemini({
      rawText: rfq.rawText,
      cleanedText: cleaning?.cleanedText,
    });

    if (extractResult.ok) {
      fields = extractResult.fields;
      extractionMeta = extractResult.meta;
      if (cleaning) extractionMeta.cleanedAt = cleaning && cleanResult.ok ? cleanResult.meta.cleanedAt : undefined;
    } else {
      // Gemini extraction failed — fall back to MOCK
      console.warn("[extract] Gemini extraction failed, using MOCK:", extractResult.error);
      fields = await extractFields(rfq.rawText, ExtractorMode.MOCK);
      extractionMeta = {
        engine: "mock",
        promptVersion: "mock-v1",
        extractedAt: new Date().toISOString(),
      };
    }
  } else {
    // ── Legacy path (Anthropic LLM or MOCK) ──────────────────────────────
    const mode = process.env.ANTHROPIC_API_KEY ? ExtractorMode.LLM : ExtractorMode.MOCK;
    fields = await extractFields(rfq.rawText, mode);
    extractionMeta = {
      engine: "mock",
      promptVersion: "mock-v1",
      extractedAt: new Date().toISOString(),
    };
  }

  // Persist extraction results
  const patch: Parameters<typeof updateRfq>[1] = {
    extractedFields: fields,
    status: RFQStatus.NEEDS_REVIEW,
    extractionMeta,
    ...(cleaning ? { cleaning } : {}),
  };

  updateRfq(id, patch);

  appendAudit(id, {
    at: new Date().toISOString(),
    actor: Actor.SYSTEM,
    action: AuditAction.FIELDS_EXTRACTED,
    detail: `Extracted ${fields.length} fields (engine: ${extractionMeta?.engine ?? "mock"})`,
  });

  // ── Best-effort clarifier generation (Gemini only) ───────────────────────
  if (process.env.GEMINI_API_KEY) {
    const refreshed = getRfq(id)!;
    const clarResult = await generateClarifier({
      rawText: refreshed.rawText,
      cleaning: refreshed.cleaning,
      extractedFields: refreshed.extractedFields,
    });
    if (clarResult.ok) {
      updateRfq(id, { clarifier: clarResult.clarifier });
    }
  }

  const updated = getRfq(id);
  return NextResponse.json(updated);
}
