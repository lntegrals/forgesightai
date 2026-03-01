/**
 * derive.ts — Flatten an RFQ into a queryable DerivedRFQ struct.
 * Pure function, no I/O.
 */
import type { RFQ } from "./types";

export type DerivedRFQ = {
  id: string;
  createdAt: string;
  customerName: string;
  subject: string;
  status: string;
  material?: string;
  finish?: string;
  qty?: number;
  qtyBucket?: string;
  toleranceAbs?: number;
  toleranceBand?: "loose" | "med" | "tight";
  deadlineISO?: string;
  hasQuote: boolean;
  hasActuals: boolean;
  totalQuoted?: number;
  totalActual?: number;
  variancePct?: number;
  searchText: string;
};

export function deriveRFQ(rfq: RFQ): DerivedRFQ {
  const fieldVal = (key: string): string | undefined => {
    const f = rfq.extractedFields.find((f) => f.key === key);
    if (!f) return undefined;
    const v = f.userOverrideValue ?? f.value;
    return v || undefined;
  };

  // Clarifier answers can supplement extracted field values
  const answers = rfq.clarifierAnswers ?? {};

  // Material
  const material = fieldVal("material");

  // Finish
  const finish = fieldVal("finish");

  // Quantity — prefer clarifier answer for "quantity" key if available
  const qtyRaw = answers["quantity"] ?? fieldVal("quantity");
  let qty: number | undefined;
  if (qtyRaw) {
    const match = qtyRaw.match(/\d[\d,]*/);
    if (match) qty = parseInt(match[0].replace(/,/g, ""), 10) || undefined;
  }

  let qtyBucket: string | undefined;
  if (qty !== undefined) {
    if (qty <= 10) qtyBucket = "prototype";
    else if (qty <= 100) qtyBucket = "small";
    else if (qty <= 1000) qtyBucket = "medium";
    else qtyBucket = "large";
  }

  // Tolerance
  const tolRaw = fieldVal("tolerance");
  let toleranceAbs: number | undefined;
  let toleranceBand: "loose" | "med" | "tight" | undefined;

  if (tolRaw) {
    const match = tolRaw.match(/[\d.]+/);
    if (match) {
      const v = parseFloat(match[0]);
      const isMm = /mm/i.test(tolRaw);
      toleranceAbs = v;
      if (!isMm) {
        // Inches
        if (v <= 0.001) toleranceBand = "tight";
        else if (v <= 0.005) toleranceBand = "med";
        else toleranceBand = "loose";
      } else {
        // Millimetres
        if (v <= 0.025) toleranceBand = "tight";
        else if (v <= 0.127) toleranceBand = "med";
        else toleranceBand = "loose";
      }
    }
  }

  // Due date — attempt ISO parse
  const dueDateRaw = fieldVal("dueDate");
  let deadlineISO: string | undefined;
  if (dueDateRaw) {
    const ts = Date.parse(dueDateRaw);
    if (!isNaN(ts)) deadlineISO = new Date(ts).toISOString();
  }

  // Quote totals
  const hasQuote = rfq.quote !== null;
  const totalQuoted = rfq.quote?.totals.total;

  // Actuals
  const hasActuals = rfq.actuals !== undefined;
  // totalActual & variancePct require computeVariance — not called here to avoid circular deps.
  // Callers can enrich if needed.

  // Searchable text blob
  const searchText = [
    rfq.customerName,
    rfq.subject,
    material,
    finish,
    fieldVal("process"),
    fieldVal("partNumber"),
    rfq.sourceType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    id: rfq.id,
    createdAt: rfq.createdAt,
    customerName: rfq.customerName,
    subject: rfq.subject,
    status: rfq.status,
    material,
    finish,
    qty,
    qtyBucket,
    toleranceAbs,
    toleranceBand,
    deadlineISO,
    hasQuote,
    hasActuals,
    totalQuoted,
    totalActual: undefined,
    variancePct: undefined,
    searchText,
  };
}
