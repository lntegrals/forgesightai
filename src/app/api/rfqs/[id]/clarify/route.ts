import { NextRequest, NextResponse } from "next/server";
import { getRfq, updateRfq, appendAudit } from "@/core/store";
import { generateClarifier } from "@/core/clarifier";
import { Actor, AuditAction } from "@/core/types";

// Generate (or regenerate) the AI clarifier for an RFQ without re-extracting fields.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rfq = getRfq(id);
  if (!rfq) {
    return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not set — cannot generate clarifier" },
      { status: 503 }
    );
  }

  if (rfq.extractedFields.length === 0) {
    return NextResponse.json(
      { error: "Run extraction first before generating clarifying questions" },
      { status: 400 }
    );
  }

  const result = await generateClarifier({
    rawText: rfq.rawText,
    cleaning: rfq.cleaning,
    extractedFields: rfq.extractedFields,
  });

  if (!result.ok) {
    const is429 = result.error.includes("429");
    return NextResponse.json(
      { error: is429 ? "Gemini rate limited — wait ~60 seconds and try again" : result.error },
      { status: is429 ? 429 : 500 }
    );
  }

  updateRfq(id, { clarifier: result.clarifier });

  appendAudit(id, {
    at: new Date().toISOString(),
    actor: Actor.SYSTEM,
    action: AuditAction.FIELDS_EXTRACTED,
    detail: `Clarifier generated: ${result.clarifier.questions.length} questions, ${result.clarifier.assumptions.length} assumptions, ${result.clarifier.riskFlags.length} risk flags`,
  });

  return NextResponse.json(getRfq(id));
}
