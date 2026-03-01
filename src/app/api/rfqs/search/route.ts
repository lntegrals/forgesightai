import { NextRequest, NextResponse } from "next/server";
import { searchRFQs } from "@/core/query";
import type { QueryFilters } from "@/core/query";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;

  const filters: QueryFilters = {};
  if (p.get("q")) filters.q = p.get("q")!;
  if (p.get("customerName")) filters.customerName = p.get("customerName")!;
  if (p.get("status")) filters.status = p.get("status")!;
  if (p.get("material")) filters.material = p.get("material")!;
  if (p.get("finish")) filters.finish = p.get("finish")!;
  if (p.get("qtyMin")) filters.qtyMin = Number(p.get("qtyMin"));
  if (p.get("qtyMax")) filters.qtyMax = Number(p.get("qtyMax"));
  if (p.get("toleranceMax")) filters.toleranceMax = Number(p.get("toleranceMax"));
  if (p.get("dateFrom")) filters.dateFrom = p.get("dateFrom")!;
  if (p.get("dateTo")) filters.dateTo = p.get("dateTo")!;
  if (p.get("hasActuals")) filters.hasActuals = p.get("hasActuals") === "true";

  const sortBy = (p.get("sortBy") as "createdAt" | "totalQuoted" | "variancePct") ?? "createdAt";
  const sortDir = (p.get("sortDir") as "asc" | "desc") ?? "desc";
  const limit = p.get("limit") ? Number(p.get("limit")) : undefined;

  const result = await searchRFQs(filters, { sortBy, sortDir, limit });
  return NextResponse.json(result);
}
