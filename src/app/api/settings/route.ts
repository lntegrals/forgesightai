import { NextRequest, NextResponse } from "next/server";
import { getShopConfig, saveShopConfig } from "@/core/config";
import type { ShopConfig } from "@/core/types";

export async function GET() {
  return NextResponse.json(getShopConfig());
}

export async function POST(request: NextRequest) {
  let body: Partial<ShopConfig>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const current = getShopConfig();
  const updated: ShopConfig = {
    setupRate: typeof body.setupRate === "number" ? body.setupRate : current.setupRate,
    laborRate: typeof body.laborRate === "number" ? body.laborRate : current.laborRate,
    machineRate: typeof body.machineRate === "number" ? body.machineRate : current.machineRate,
    overheadPct: typeof body.overheadPct === "number" ? body.overheadPct : current.overheadPct,
    marginPct: typeof body.marginPct === "number" ? body.marginPct : current.marginPct,
  };

  // Basic validation — all rates must be non-negative
  if (Object.values(updated).some((v) => v < 0)) {
    return NextResponse.json({ error: "All rates must be non-negative" }, { status: 400 });
  }

  saveShopConfig(updated);
  return NextResponse.json(updated);
}
