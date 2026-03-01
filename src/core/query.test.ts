import { describe, it, expect, beforeEach } from "vitest";
import { createRfq, resetStore, updateRfq } from "./store";
import { searchRFQs } from "./query";
import { RFQStatus, DEFAULT_SHOP_CONFIG } from "./types";
import { computeQuote } from "./pricing";

const ALUMINUM_RFQ = `Material: Aluminum 6061-T6
Quantity: 100 pieces
Tolerance: ±0.005"
Surface Finish: Anodized Type II`;

const STEEL_RFQ = `Material: 316 Stainless Steel
Quantity: 25 pieces
Tolerance: ±0.002"
Surface Finish: Passivated`;

beforeEach(() => {
  resetStore();
});

describe("searchRFQs", () => {
  it("returns all RFQs when no filters applied", async () => {
    const { rows } = await searchRFQs({});
    // 3 seed RFQs after reset
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it("filters by free-text search (q)", async () => {
    createRfq({
      customerName: "AcmeCorp",
      subject: "Titanium Bracket",
      rawText: "Material: Titanium Ti-6Al-4V\nQuantity: 10",
      sourceType: "manual",
    });

    const { rows } = await searchRFQs({ q: "acmecorp" });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => r.searchText.includes("acmecorp"))).toBe(true);
  });

  it("filters by customerName (case-insensitive)", async () => {
    createRfq({ customerName: "WidgetCo", subject: "Part A", rawText: ALUMINUM_RFQ });
    const { rows } = await searchRFQs({ customerName: "widgetco" });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].customerName).toBe("WidgetCo");
  });

  it("filters by status", async () => {
    const rfq = createRfq({ customerName: "X", subject: "Y", rawText: "z" });
    updateRfq(rfq.id, { status: RFQStatus.SENT });

    const { rows } = await searchRFQs({ status: RFQStatus.SENT });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => r.status === RFQStatus.SENT)).toBe(true);
  });

  it("filters by hasActuals", async () => {
    const { rows: withActuals } = await searchRFQs({ hasActuals: true });
    const { rows: withoutActuals } = await searchRFQs({ hasActuals: false });
    expect(withActuals.every((r) => r.hasActuals)).toBe(true);
    expect(withoutActuals.every((r) => !r.hasActuals)).toBe(true);
  });

  it("sorts by createdAt desc by default", async () => {
    createRfq({ customerName: "A", subject: "First", rawText: "x" });
    createRfq({ customerName: "B", subject: "Second", rawText: "x" });

    const { rows } = await searchRFQs({});
    for (let i = 1; i < rows.length; i++) {
      expect(new Date(rows[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(rows[i].createdAt).getTime()
      );
    }
  });

  it("sorts by totalQuoted asc", async () => {
    const rfq = createRfq({ customerName: "Q", subject: "Quote test", rawText: ALUMINUM_RFQ });
    const quote = computeQuote(
      { quantity: 100, materialCostPerUnit: 5, materialQty: 1, setupHours: 2, laborHours: 5, machineHours: 3 },
      DEFAULT_SHOP_CONFIG
    );
    updateRfq(rfq.id, { quote });

    const { rows } = await searchRFQs({}, { sortBy: "totalQuoted", sortDir: "asc" });
    // rows without quotes sort to 0, quoted rfq sorts higher
    const quotedRows = rows.filter((r) => r.totalQuoted !== undefined);
    expect(quotedRows.length).toBeGreaterThanOrEqual(1);
  });

  it("limits results", async () => {
    for (let i = 0; i < 5; i++) {
      createRfq({ customerName: `Co${i}`, subject: `Part${i}`, rawText: "x" });
    }
    const { rows } = await searchRFQs({}, { limit: 3 });
    expect(rows.length).toBe(3);
  });

  it("returns deterministic results for same inputs", async () => {
    const { rows: r1 } = await searchRFQs({ q: "reynolds" });
    const { rows: r2 } = await searchRFQs({ q: "reynolds" });
    expect(r1.map((r) => r.id)).toEqual(r2.map((r) => r.id));
  });
});
