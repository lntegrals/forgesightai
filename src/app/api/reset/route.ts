/**
 * POST /api/reset
 *
 * Resets the in-memory store and re-seeds with demo data.
 * Useful for demo resets and testing.
 */
import { NextResponse } from "next/server";
import { resetStore, getAllRfqs } from "@/core/store";

export async function POST() {
  resetStore();
  const rfqs = getAllRfqs(); // triggers re-seed
  return NextResponse.json({
    message: "Store reset and re-seeded with demo data",
    count: rfqs.length,
  });
}
