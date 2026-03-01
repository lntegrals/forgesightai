import { NextRequest, NextResponse } from "next/server";
import { getRfq, updateRfq, appendAudit } from "@/core/store";
import { Actor, AuditAction } from "@/core/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rfq = getRfq(id);
  if (!rfq) {
    return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
  }
  return NextResponse.json(rfq);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rfq = getRfq(id);
  if (!rfq) {
    return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const {
      extractedFields,
      status,
      clarifierAnswers,
      confirmedAssumptions,
    } = body;

    const patch: Record<string, unknown> = {};

    if (extractedFields !== undefined) patch.extractedFields = extractedFields;
    if (status !== undefined) patch.status = status;

    // Merge clarifier answers (patch, not replace)
    if (clarifierAnswers !== undefined) {
      patch.clarifierAnswers = {
        ...(rfq.clarifierAnswers ?? {}),
        ...(clarifierAnswers as Record<string, string>),
      };
    }

    // Replace confirmed assumption ids list
    if (confirmedAssumptions !== undefined) {
      patch.confirmedAssumptions = confirmedAssumptions as string[];
    }

    const updated = updateRfq(id, patch);

    // Append audit event if requested
    if (body.auditAction) {
      appendAudit(id, {
        at: new Date().toISOString(),
        actor: Actor.USER,
        action: body.auditAction as AuditAction,
        detail: body.auditDetail || "",
      });
    } else if (clarifierAnswers !== undefined || confirmedAssumptions !== undefined) {
      // Auto-audit clarifier updates
      const parts: string[] = [];
      if (clarifierAnswers) parts.push(`answered ${Object.keys(clarifierAnswers).length} question(s)`);
      if (confirmedAssumptions) parts.push(`confirmed ${(confirmedAssumptions as string[]).length} assumption(s)`);
      appendAudit(id, {
        at: new Date().toISOString(),
        actor: Actor.USER,
        action: AuditAction.FIELD_CONFIRMED,
        detail: `Clarifier update: ${parts.join(", ")}`,
      });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
