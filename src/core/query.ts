/**
 * query.ts — Deterministic RFQ search engine.
 * No AI; purely filters/sorts DerivedRFQ rows from the store.
 */
import { getAllRfqs } from "./store";
import { deriveRFQ, type DerivedRFQ } from "./derive";

export type QueryFilters = Partial<{
  q: string;
  customerName: string;
  status: string;
  material: string;
  finish: string;
  qtyMin: number;
  qtyMax: number;
  toleranceMax: number;
  dateFrom: string;
  dateTo: string;
  hasActuals: boolean;
}>;

export async function searchRFQs(
  filters: QueryFilters,
  opts?: {
    sortBy?: "createdAt" | "totalQuoted" | "variancePct";
    sortDir?: "asc" | "desc";
    limit?: number;
  }
): Promise<{ rows: DerivedRFQ[] }> {
  const rfqs = getAllRfqs();
  let rows = rfqs.map(deriveRFQ);

  // ── Filters ──────────────────────────────────────────────────────────────

  if (filters.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter((r) => r.searchText.includes(q));
  }

  if (filters.customerName) {
    const cn = filters.customerName.toLowerCase();
    rows = rows.filter((r) => r.customerName.toLowerCase().includes(cn));
  }

  if (filters.status) {
    rows = rows.filter((r) => r.status === filters.status);
  }

  if (filters.material) {
    const mat = filters.material.toLowerCase();
    rows = rows.filter((r) => r.material?.toLowerCase().includes(mat));
  }

  if (filters.finish) {
    const fin = filters.finish.toLowerCase();
    rows = rows.filter((r) => r.finish?.toLowerCase().includes(fin));
  }

  if (filters.qtyMin !== undefined) {
    rows = rows.filter((r) => r.qty !== undefined && r.qty >= filters.qtyMin!);
  }

  if (filters.qtyMax !== undefined) {
    rows = rows.filter((r) => r.qty !== undefined && r.qty <= filters.qtyMax!);
  }

  if (filters.toleranceMax !== undefined) {
    rows = rows.filter(
      (r) => r.toleranceAbs !== undefined && r.toleranceAbs <= filters.toleranceMax!
    );
  }

  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom).getTime();
    rows = rows.filter((r) => new Date(r.createdAt).getTime() >= from);
  }

  if (filters.dateTo) {
    const to = new Date(filters.dateTo).getTime();
    rows = rows.filter((r) => new Date(r.createdAt).getTime() <= to);
  }

  if (filters.hasActuals !== undefined) {
    rows = rows.filter((r) => r.hasActuals === filters.hasActuals);
  }

  // ── Sort ─────────────────────────────────────────────────────────────────

  const sortBy = opts?.sortBy ?? "createdAt";
  const sortDir = opts?.sortDir ?? "desc";

  rows.sort((a, b) => {
    let aVal: number;
    let bVal: number;
    if (sortBy === "createdAt") {
      aVal = new Date(a.createdAt).getTime();
      bVal = new Date(b.createdAt).getTime();
    } else if (sortBy === "totalQuoted") {
      aVal = a.totalQuoted ?? 0;
      bVal = b.totalQuoted ?? 0;
    } else {
      aVal = a.variancePct ?? 0;
      bVal = b.variancePct ?? 0;
    }
    return sortDir === "asc" ? aVal - bVal : bVal - aVal;
  });

  if (opts?.limit) {
    rows = rows.slice(0, opts.limit);
  }

  return { rows };
}
