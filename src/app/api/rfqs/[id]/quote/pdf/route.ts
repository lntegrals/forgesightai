import { NextRequest, NextResponse } from "next/server";
import { getRfq } from "@/core/store";
import { buildQuotePdf } from "@/core/pdf";

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

  const pdfBuffer = await buildQuotePdf(rfq);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="quote-${rfq.id.slice(0, 8).toUpperCase()}.pdf"`,
      "Content-Length": pdfBuffer.length.toString(),
    },
  });
}
