import { LineItemType, type PricingInputs, type Quote, type QuoteLineItem, type QuoteTotals, type ShopConfig } from "./types";

/**
 * Clamp a value to be non-negative. Missing/NaN values become 0.
 */
function safe(v: number | undefined | null): number {
    if (v === undefined || v === null || isNaN(v)) return 0;
    return Math.max(0, v);
}

/**
 * computeQuote — Pure deterministic pricing function.
 *
 * AI must NEVER compute prices. This function is the single source of truth.
 * All line items include a human-readable `formula`, `inputs` record, and `why` explanation.
 */
export function computeQuote(inputs: PricingInputs, config: ShopConfig): Quote {
    const qty = safe(inputs.quantity);
    const matCostPerUnit = safe(inputs.materialCostPerUnit);
    const matQty = safe(inputs.materialQty);
    const setupHrs = safe(inputs.setupHours);
    const laborHrs = safe(inputs.laborHours);
    const machineHrs = safe(inputs.machineHours);

    const setupRate = safe(config.setupRate);
    const laborRate = safe(config.laborRate);
    const machineRate = safe(config.machineRate);
    const overheadPct = safe(config.overheadPct);
    const marginPct = safe(config.marginPct);

    // ── Line items ───────────────────────────────────────────────────────

    const materialAmount = qty * matCostPerUnit * matQty;
    const materialItem: QuoteLineItem = {
        type: LineItemType.MATERIAL,
        label: "Material Cost",
        formula: "quantity × costPerUnit × materialQty",
        inputs: { quantity: qty, costPerUnit: matCostPerUnit, materialQty: matQty },
        amount: round(materialAmount),
        why: `${qty} units × $${matCostPerUnit.toFixed(2)}/unit × ${matQty} material qty = $${round(materialAmount).toFixed(2)}`,
    };

    const setupAmount = setupHrs * setupRate;
    const setupItem: QuoteLineItem = {
        type: LineItemType.SETUP,
        label: "Setup Cost",
        formula: "setupHours × setupRate",
        inputs: { setupHours: setupHrs, setupRate },
        amount: round(setupAmount),
        why: `${setupHrs} hours × $${setupRate.toFixed(2)}/hr = $${round(setupAmount).toFixed(2)}`,
    };

    const runTimeAmount = machineHrs * machineRate;
    const runTimeItem: QuoteLineItem = {
        type: LineItemType.RUN_TIME,
        label: "Run Time (Machine)",
        formula: "machineHours × machineRate",
        inputs: { machineHours: machineHrs, machineRate },
        amount: round(runTimeAmount),
        why: `${machineHrs} machine hours × $${machineRate.toFixed(2)}/hr = $${round(runTimeAmount).toFixed(2)}`,
    };

    const laborAmount = laborHrs * laborRate;
    const laborItem: QuoteLineItem = {
        type: LineItemType.LABOR,
        label: "Labor Cost",
        formula: "laborHours × laborRate",
        inputs: { laborHours: laborHrs, laborRate },
        amount: round(laborAmount),
        why: `${laborHrs} labor hours × $${laborRate.toFixed(2)}/hr = $${round(laborAmount).toFixed(2)}`,
    };

    const subtotal = round(materialAmount + setupAmount + runTimeAmount + laborAmount);

    const overheadAmount = subtotal * overheadPct;
    const overheadItem: QuoteLineItem = {
        type: LineItemType.OVERHEAD,
        label: "Overhead",
        formula: "subtotal × overheadPct",
        inputs: { subtotal, overheadPct },
        amount: round(overheadAmount),
        why: `$${subtotal.toFixed(2)} subtotal × ${(overheadPct * 100).toFixed(1)}% overhead = $${round(overheadAmount).toFixed(2)}`,
    };

    const preMarginTotal = subtotal + round(overheadAmount);
    const marginAmount = preMarginTotal * marginPct;
    const marginItem: QuoteLineItem = {
        type: LineItemType.MARGIN,
        label: "Profit Margin",
        formula: "(subtotal + overhead) × marginPct",
        inputs: { subtotalPlusOverhead: preMarginTotal, marginPct },
        amount: round(marginAmount),
        why: `$${preMarginTotal.toFixed(2)} (subtotal + overhead) × ${(marginPct * 100).toFixed(1)}% margin = $${round(marginAmount).toFixed(2)}`,
    };

    const lineItems = [materialItem, setupItem, runTimeItem, laborItem, overheadItem, marginItem];

    const totals: QuoteTotals = {
        subtotal,
        overheadAmount: round(overheadAmount),
        overheadPct,
        marginPct,
        marginAmount: round(marginAmount),
        total: round(preMarginTotal + round(marginAmount)),
    };

    const assumptions: string[] = [
        `Shop setup rate: $${setupRate.toFixed(2)}/hr`,
        `Shop labor rate: $${laborRate.toFixed(2)}/hr`,
        `Shop machine rate: $${machineRate.toFixed(2)}/hr`,
        `Overhead: ${(overheadPct * 100).toFixed(1)}% of subtotal`,
        `Profit margin: ${(marginPct * 100).toFixed(1)}%`,
    ];

    return { lineItems, totals, assumptions };
}

/** Round to 2 decimal places */
function round(v: number): number {
    return Math.round(v * 100) / 100;
}
