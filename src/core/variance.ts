/**
 * variance.ts — Pure deterministic variance computation.
 * Compares estimated quote against recorded actuals.
 * AI never touches this math. Ever.
 */

import {
  LineItemType,
  type Actuals,
  type Quote,
  type ShopConfig,
  type VarianceLine,
  type VarianceReport,
} from "./types";

function safe(v: number | undefined | null): number {
  if (v === undefined || v === null || isNaN(v as number)) return 0;
  return Math.max(0, v as number);
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function deltaPct(estimate: number, actual: number): number {
  if (estimate === 0) return 0;
  return round(((actual - estimate) / estimate) * 100);
}

/**
 * computeVariance — Pure function. Takes an estimate (Quote) and actuals,
 * returns a structured variance report with per-line and total deltas.
 */
export function computeVariance(
  quote: Quote,
  actuals: Actuals,
  config: ShopConfig
): VarianceReport {
  const setupRate = safe(config.setupRate);
  const laborRate = safe(config.laborRate);
  const machineRate = safe(config.machineRate);
  const overheadPct = safe(config.overheadPct);
  const marginPct = safe(config.marginPct);

  // --- Extract estimates from quote line items ---
  const estMaterial = quote.lineItems.find((l) => l.type === LineItemType.MATERIAL)?.amount ?? 0;
  const estSetup = quote.lineItems.find((l) => l.type === LineItemType.SETUP)?.amount ?? 0;
  const estRunTime = quote.lineItems.find((l) => l.type === LineItemType.RUN_TIME)?.amount ?? 0;
  const estLabor = quote.lineItems.find((l) => l.type === LineItemType.LABOR)?.amount ?? 0;
  const estOverhead = quote.lineItems.find((l) => l.type === LineItemType.OVERHEAD)?.amount ?? 0;
  const estMargin = quote.lineItems.find((l) => l.type === LineItemType.MARGIN)?.amount ?? 0;

  // --- Compute actual costs using same rate structure as pricing engine ---
  const actMaterial = round(safe(actuals.materialCost));
  const actSetup = round(safe(actuals.setupHours) * setupRate);
  const actRunTime = round(safe(actuals.machineHours) * machineRate);
  const actLabor = round(safe(actuals.laborHours) * laborRate);
  const actSubtotal = round(actMaterial + actSetup + actRunTime + actLabor);
  const actOverhead = round(actSubtotal * overheadPct);
  const actPreMargin = round(actSubtotal + actOverhead);
  const actMargin = round(actPreMargin * marginPct);
  const actTotal = round(actPreMargin + actMargin);

  const lines: VarianceLine[] = [
    {
      label: "Material Cost",
      type: LineItemType.MATERIAL,
      estimate: estMaterial,
      actual: actMaterial,
      delta: round(actMaterial - estMaterial),
      deltaPct: deltaPct(estMaterial, actMaterial),
    },
    {
      label: "Setup Cost",
      type: LineItemType.SETUP,
      estimate: estSetup,
      actual: actSetup,
      delta: round(actSetup - estSetup),
      deltaPct: deltaPct(estSetup, actSetup),
    },
    {
      label: "Run Time (Machine)",
      type: LineItemType.RUN_TIME,
      estimate: estRunTime,
      actual: actRunTime,
      delta: round(actRunTime - estRunTime),
      deltaPct: deltaPct(estRunTime, actRunTime),
    },
    {
      label: "Labor Cost",
      type: LineItemType.LABOR,
      estimate: estLabor,
      actual: actLabor,
      delta: round(actLabor - estLabor),
      deltaPct: deltaPct(estLabor, actLabor),
    },
    {
      label: "Overhead",
      type: LineItemType.OVERHEAD,
      estimate: estOverhead,
      actual: actOverhead,
      delta: round(actOverhead - estOverhead),
      deltaPct: deltaPct(estOverhead, actOverhead),
    },
    {
      label: "Profit Margin",
      type: LineItemType.MARGIN,
      estimate: estMargin,
      actual: actMargin,
      delta: round(actMargin - estMargin),
      deltaPct: deltaPct(estMargin, actMargin),
    },
  ];

  const estimateTotal = quote.totals.total;

  return {
    lines,
    estimateTotal,
    actualTotal: actTotal,
    totalDelta: round(actTotal - estimateTotal),
    totalDeltaPct: deltaPct(estimateTotal, actTotal),
    estimateMarginPct: quote.totals.marginPct,
    actualMarginPct: marginPct,
    marginDelta: round(actMargin - estMargin),
  };
}
