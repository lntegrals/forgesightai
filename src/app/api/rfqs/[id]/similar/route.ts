import { NextRequest, NextResponse } from "next/server";
import { similarRFQs } from "@/core/similarity";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const limit = request.nextUrl.searchParams.get("limit")
    ? Number(request.nextUrl.searchParams.get("limit"))
    : 5;

  const results = await similarRFQs(id, limit);
  return NextResponse.json({ results });
}
