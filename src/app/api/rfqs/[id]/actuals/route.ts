import { NextRequest, NextResponse } from "next/server";
import { getRfq, recordActuals } from "@/core/store";
import type { Actuals } from "@/core/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rfq = getRfq(id);

  if (!rfq) {
    return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
  }
  if (!rfq.quote) {
    return NextResponse.json({ error: "Quote must be generated before recording actuals" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { materialCost, setupHours, laborHours, machineHours, notes } = body as {
    materialCost?: number;
    setupHours?: number;
    laborHours?: number;
    machineHours?: number;
    notes?: string;
  };

  if (
    typeof materialCost !== "number" ||
    typeof setupHours !== "number" ||
    typeof laborHours !== "number" ||
    typeof machineHours !== "number"
  ) {
    return NextResponse.json(
      { error: "Required: materialCost, setupHours, laborHours, machineHours (all numbers)" },
      { status: 400 }
    );
  }

  const actuals: Actuals = {
    materialCost,
    setupHours,
    laborHours,
    machineHours,
    notes: typeof notes === "string" ? notes : undefined,
    recordedAt: new Date().toISOString(),
  };

  const updated = recordActuals(id, actuals);
  return NextResponse.json(updated);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rfq = getRfq(id);

  if (!rfq) {
    return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
  }
  if (!rfq.actuals) {
    return NextResponse.json({ error: "No actuals recorded yet" }, { status: 404 });
  }

  return NextResponse.json(rfq.actuals);
}
