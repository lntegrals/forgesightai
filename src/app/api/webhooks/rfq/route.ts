/**
 * POST /api/webhooks/rfq
 *
 * JSON webhook endpoint for external system integration.
 * Idempotent: uses externalId to deduplicate.
 *
 * Body: { externalId, customerName, subject, rawText }
 */
import { NextRequest, NextResponse } from "next/server";
import { createRfq, findByExternalId, updateRfq, appendAudit } from "@/core/store";
import { extractFields } from "@/core/extractor";
import { Actor, AuditAction, ExtractorMode, RFQStatus } from "@/core/types";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { externalId, customerName, subject, rawText } = body as {
    externalId?: string;
    customerName?: string;
    subject?: string;
    rawText?: string;
  };

  if (!customerName || !subject || !rawText) {
    return NextResponse.json(
      { error: "Required fields: customerName, subject, rawText" },
      { status: 400 }
    );
  }

  // Idempotency: return existing RFQ if externalId matches
  if (externalId) {
    const existing = findByExternalId(externalId);
    if (existing) {
      return NextResponse.json({ ...existing, deduplicated: true }, { status: 200 });
    }
  }

  const rfq = createRfq({
    customerName,
    subject,
    rawText,
    sourceType: "webhook",
    externalId: externalId,
  });

  appendAudit(rfq.id, {
    at: new Date().toISOString(),
    actor: Actor.SYSTEM,
    action: AuditAction.WEBHOOK_INGESTED,
    detail: `Webhook ingest from external system${externalId ? ` (externalId: ${externalId})` : ""}`,
  });

  // Auto-extract fields
  const mode = process.env.ANTHROPIC_API_KEY ? ExtractorMode.LLM : ExtractorMode.MOCK;
  const fields = await extractFields(rawText, mode);

  updateRfq(rfq.id, {
    extractedFields: fields,
    status: RFQStatus.NEEDS_REVIEW,
  });

  appendAudit(rfq.id, {
    at: new Date().toISOString(),
    actor: Actor.SYSTEM,
    action: AuditAction.FIELDS_EXTRACTED,
    detail: `Extracted ${fields.length} fields from webhook payload (${mode} mode)`,
  });

  const { getRfq } = await import("@/core/store");
  return NextResponse.json(getRfq(rfq.id), { status: 201 });
}
