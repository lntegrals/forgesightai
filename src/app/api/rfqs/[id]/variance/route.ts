import { NextRequest, NextResponse } from "next/server";
import { getRfq } from "@/core/store";
import { computeVariance } from "@/core/variance";
import { DEFAULT_SHOP_CONFIG } from "@/core/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rfq = getRfq(id);

  if (!rfq) {
    return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
  }
  if (!rfq.quote) {
    return NextResponse.json({ error: "No quote generated yet" }, { status: 400 });
  }
  if (!rfq.actuals) {
    return NextResponse.json({ error: "No actuals recorded yet" }, { status: 400 });
  }

  const report = computeVariance(rfq.quote, rfq.actuals, DEFAULT_SHOP_CONFIG);
  return NextResponse.json(report);
}
