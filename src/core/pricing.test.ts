import { describe, it, expect } from "vitest";
import { computeQuote } from "./pricing";
import type { PricingInputs, ShopConfig } from "./types";

const baseConfig: ShopConfig = {
    setupRate: 85,
    laborRate: 65,
    machineRate: 120,
    overheadPct: 0.15,
    marginPct: 0.20,
};

const baseInputs: PricingInputs = {
    quantity: 100,
    materialCostPerUnit: 2.50,
    materialQty: 1,
    setupHours: 2,
    laborHours: 8,
    machineHours: 4,
};

describe("computeQuote", () => {
    it("happy path: standard inputs produce correct totals", () => {
        const quote = computeQuote(baseInputs, baseConfig);

        // Material: 100 * 2.50 * 1 = 250
        expect(quote.lineItems[0].amount).toBe(250);
        // Setup: 2 * 85 = 170
        expect(quote.lineItems[1].amount).toBe(170);
        // Run Time: 4 * 120 = 480
        expect(quote.lineItems[2].amount).toBe(480);
        // Labor: 8 * 65 = 520
        expect(quote.lineItems[3].amount).toBe(520);
        // Subtotal: 250 + 170 + 480 + 520 = 1420
        expect(quote.totals.subtotal).toBe(1420);
        // Overhead: 1420 * 0.15 = 213
        expect(quote.lineItems[4].amount).toBe(213);
        expect(quote.totals.overheadAmount).toBe(213);
        // Margin: (1420 + 213) * 0.20 = 326.60
        expect(quote.lineItems[5].amount).toBe(326.6);
        expect(quote.totals.marginAmount).toBe(326.6);
        // Total: 1420 + 213 + 326.60 = 1959.60
        expect(quote.totals.total).toBe(1959.6);
    });

    it("includes human-readable 'why' explanations for each line item", () => {
        const quote = computeQuote(baseInputs, baseConfig);
        for (const item of quote.lineItems) {
            expect(item.why).toBeTruthy();
            expect(item.why).toContain("$");
        }
    });

    it("zero quantity: material cost is $0, other costs still calculated", () => {
        const inputs = { ...baseInputs, quantity: 0 };
        const quote = computeQuote(inputs, baseConfig);
        expect(quote.lineItems[0].amount).toBe(0); // Material
        expect(quote.lineItems[1].amount).toBe(170); // Setup still applies
        expect(quote.lineItems[3].amount).toBe(520); // Labor still applies
    });

    it("missing/undefined values treated as 0, no NaN", () => {
        const inputs = {
            quantity: undefined,
            materialCostPerUnit: null,
            materialQty: NaN,
            setupHours: 2,
            laborHours: undefined,
            machineHours: undefined,
        } as unknown as PricingInputs;

        const quote = computeQuote(inputs, baseConfig);
        for (const item of quote.lineItems) {
            expect(isNaN(item.amount)).toBe(false);
        }
        expect(isNaN(quote.totals.total)).toBe(false);
        expect(quote.lineItems[0].amount).toBe(0); // no material
        expect(quote.lineItems[1].amount).toBe(170); // setup works
    });

    it("negative rates are clamped to 0", () => {
        const config = { ...baseConfig, laborRate: -50, machineRate: -100 };
        const quote = computeQuote(baseInputs, config);
        expect(quote.lineItems[2].amount).toBe(0); // Run time
        expect(quote.lineItems[3].amount).toBe(0); // Labor
    });

    it("zero margin: margin line is $0, total = subtotal + overhead", () => {
        const config = { ...baseConfig, marginPct: 0 };
        const quote = computeQuote(baseInputs, config);
        expect(quote.lineItems[5].amount).toBe(0);
        expect(quote.totals.marginAmount).toBe(0);
        expect(quote.totals.total).toBe(quote.totals.subtotal + quote.totals.overheadAmount);
    });

    it("100% margin: margin = subtotal + overhead", () => {
        const config = { ...baseConfig, marginPct: 1.0 };
        const quote = computeQuote(baseInputs, config);
        const sub = quote.totals.subtotal + quote.totals.overheadAmount;
        expect(quote.totals.marginAmount).toBe(sub);
    });

    it("overhead applies to subtotal only (not margin)", () => {
        const quote = computeQuote(baseInputs, baseConfig);
        expect(quote.totals.overheadAmount).toBe(
            Math.round(quote.totals.subtotal * baseConfig.overheadPct * 100) / 100
        );
    });

    it("totals.overheadPct reflects the actual config rate used", () => {
        const quote = computeQuote(baseInputs, baseConfig);
        expect(quote.totals.overheadPct).toBe(baseConfig.overheadPct); // 0.15
        expect(Math.round(quote.totals.overheadPct * 100)).toBe(15);

        const customConfig = { ...baseConfig, overheadPct: 0.22 };
        const quote2 = computeQuote(baseInputs, customConfig);
        expect(quote2.totals.overheadPct).toBe(0.22);
        expect(Math.round(quote2.totals.overheadPct * 100)).toBe(22);
    });

    it("returns assumptions reflecting shop config", () => {
        const quote = computeQuote(baseInputs, baseConfig);
        expect(quote.assumptions.length).toBeGreaterThanOrEqual(4);
        expect(quote.assumptions.some(a => a.includes("85"))).toBe(true);
        expect(quote.assumptions.some(a => a.includes("20.0%"))).toBe(true);
    });

    it("handles large values without overflow", () => {
        const inputs = { ...baseInputs, quantity: 1_000_000, materialCostPerUnit: 1000 };
        const quote = computeQuote(inputs, baseConfig);
        expect(quote.totals.total).toBeGreaterThan(0);
        expect(isFinite(quote.totals.total)).toBe(true);
    });
});
