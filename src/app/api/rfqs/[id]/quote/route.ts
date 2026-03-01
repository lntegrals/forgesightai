import { NextRequest, NextResponse } from "next/server";
import { getRfq, updateRfq, appendAudit } from "@/core/store";
import { getShopConfig } from "@/core/config";
import { computeQuote } from "@/core/pricing";
import { isClarifierComplete } from "@/core/clarifier";
import { geminiGenerateJSON } from "@/core/gemini";
import { RFQStatus, Actor, AuditAction, DEFAULT_SHOP_CONFIG } from "@/core/types";
import type { PricingInputs, ShopConfig, ExtractedField } from "@/core/types";

// ── Gemini-derived pricing inputs ─────────────────────────────────────────────
// Gemini estimates hours & raw material cost only.
// computeQuote() applies shop rates + margin — Gemini never touches final prices.

const DERIVE_SCHEMA = {
  type: "object",
  properties: {
    materialCostPerUnit: { type: "number" },
    materialQty: { type: "number" },
    setupHours: { type: "number" },
    laborHours: { type: "number" },
    machineHours: { type: "number" },
    rationale: { type: "string" },
  },
  required: ["materialCostPerUnit", "materialQty", "setupHours", "laborHours", "machineHours", "rationale"],
};

async function derivePricingInputsAI(
  fields: ExtractedField[],
  quantity: number
): Promise<PricingInputs | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";
  const fieldSummary = fields
    .map((f) => `${f.label}: ${f.userOverrideValue ?? f.value}`)
    .join("\n");

  const result = await geminiGenerateJSON<{
    materialCostPerUnit: number;
    materialQty: number;
    setupHours: number;
    laborHours: number;
    machineHours: number;
    rationale: string;
  }>({
    model,
    system: `You are a manufacturing cost estimator. Given extracted RFQ fields, estimate the RAW INPUTS for a pricing formula. You are NOT computing final prices — only estimating hours and raw material cost.

Output fields (numbers only, no $ signs):
- materialCostPerUnit: raw material cost per piece in USD
  Typical ranges: aluminum $3–10, carbon steel $5–15, stainless $15–35, copper/brass $20–50, titanium $80–300, inconel $150–400
- materialQty: waste multiplier for bar stock cutoff/scrap (bar: 1.2–1.5, plate/sheet: 1.05–1.15, near-net: 1.0–1.1)
- setupHours: ONE-TIME batch setup hours (programming, fixturing, first-article) — NOT per piece
- laborHours: TOTAL operator + inspection hours for the ENTIRE batch
- machineHours: TOTAL CNC/grinding/machine cycle hours for the ENTIRE batch

Scaling guidance:
- Tight tolerance (≤±0.025mm): 2–3× more machine time, may require grinding pass
- Hard material (Ti, Inconel): 1.5–2× longer cycle vs aluminum
- High quantity (>100 pcs): setup amortized, per-piece machine time drops 20–40%
- Surface finish (anodize, plate, grind): add 0.1–0.3 hr/pc to labor
- Complex threads, multiple ops: add 20–40% to machine hours

rationale: One sentence explaining the key cost drivers for this specific job.`,
    user: `QUANTITY: ${quantity} pieces\n\nEXTRACTED FIELDS:\n${fieldSummary}`,
    responseJsonSchema: DERIVE_SCHEMA,
    temperature: 0.1,
    maxOutputTokens: 512,
  });

  if (!result.ok) return null;

  const r = result.json;
  return {
    quantity,
    materialCostPerUnit: Math.max(0.01, r.materialCostPerUnit),
    materialQty: Math.max(1, r.materialQty),
    setupHours: Math.max(0.5, r.setupHours),
    laborHours: Math.max(0.25, r.laborHours),
    machineHours: Math.max(0.25, r.machineHours),
  };
}

// ── Rules-based fallback (no Gemini) ─────────────────────────────────────────

function derivePricingInputsFallback(fields: ExtractedField[], quantity: number): PricingInputs {
  const fv = (key: string) => {
    const f = fields.find((f) => f.key === key);
    return f ? (f.userOverrideValue ?? f.value).toLowerCase() : "";
  };

  const material = fv("material");
  const tolerance = fv("tolerance");
  const finish = fv("finish") || fv("surfaceFinish");
  const process = fv("process");

  // Material cost per unit
  let matCost = 8;
  if (/titanium|ti-6|ti6/i.test(material)) matCost = 160;
  else if (/inconel|nickel/i.test(material)) matCost = 220;
  else if (/stainless|316|304|17-4/i.test(material)) matCost = 25;
  else if (/aluminum|aluminium|6061|7075|2024/i.test(material)) matCost = 6;
  else if (/copper|c110|brass/i.test(material)) matCost = 20;
  else if (/steel|a36|4140|4340/i.test(material)) matCost = 9;

  const matQty = /sheet|plate/i.test(process) ? 1.1 : 1.3;

  // Setup hours (batch)
  let setupHrs = 3;
  if (quantity <= 5) setupHrs = 2;
  else if (quantity >= 100) setupHrs = 8;
  else if (quantity >= 50) setupHrs = 5;

  const tight = /±\s*0\.0[0-2][0-9]/i.test(tolerance);

  // Machine hours (total batch)
  let machineHrs = Math.max(1, quantity * (tight ? 0.75 : 0.3));
  if (/grinding|grind/i.test(process || finish)) machineHrs *= 1.5;

  // Labor hours (total batch)
  let laborHrs = Math.max(1, quantity * (tight ? 0.4 : 0.15));
  if (/anodize|plat|passiv|electropolish/i.test(finish)) laborHrs += quantity * 0.1;

  return {
    quantity,
    materialCostPerUnit: matCost,
    materialQty: matQty,
    setupHours: Math.round(setupHrs * 10) / 10,
    laborHours: Math.round(laborHrs * 10) / 10,
    machineHours: Math.round(machineHrs * 10) / 10,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rfq = getRfq(id);
  if (!rfq) {
    return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
  }

  // Gate 1: all low-confidence fields confirmed
  const unconfirmed = rfq.extractedFields.filter(
    (f) => f.confidence < 0.85 && !f.isConfirmed
  );
  if (unconfirmed.length > 0) {
    return NextResponse.json(
      { error: `${unconfirmed.length} field(s) need review before generating a quote` },
      { status: 400 }
    );
  }

  // Gate 2: clarifier complete (if generated)
  const clarCheck = isClarifierComplete(rfq);
  if (!clarCheck.ok) {
    return NextResponse.json(
      { error: "Clarifier incomplete", missing: clarCheck.missing },
      { status: 400 }
    );
  }

  // Shop config: persisted → body override → defaults
  let shopConfig: ShopConfig = DEFAULT_SHOP_CONFIG;
  try {
    const saved = getShopConfig();
    if (saved) shopConfig = saved;
  } catch { /* ignore */ }
  try {
    const body = await request.json();
    if (body.shopConfig) shopConfig = { ...shopConfig, ...body.shopConfig };
  } catch { /* no body */ }

  // Parse quantity
  const qtyField = rfq.extractedFields.find((f) => f.key === "quantity");
  const parseNum = (v: string) => {
    const m = v.match(/[\d,]+/);
    return m ? parseFloat(m[0].replace(/,/g, "")) || 1 : 1;
  };
  const qty = Math.max(1, parseNum(qtyField ? (qtyField.userOverrideValue ?? qtyField.value) : "1"));

  // Derive pricing inputs — Gemini first, rules fallback
  let pricingInputs: PricingInputs;
  let derivedByAI = false;

  const aiInputs = await derivePricingInputsAI(rfq.extractedFields, qty);
  if (aiInputs) {
    pricingInputs = aiInputs;
    derivedByAI = true;
  } else {
    pricingInputs = derivePricingInputsFallback(rfq.extractedFields, qty);
  }

  const quote = computeQuote(pricingInputs, shopConfig);

  updateRfq(id, { quote, status: RFQStatus.READY_TO_SEND });

  appendAudit(id, {
    at: new Date().toISOString(),
    actor: Actor.SYSTEM,
    action: AuditAction.QUOTE_GENERATED,
    detail: `Quote $${quote.totals.total.toFixed(2)} · inputs by ${derivedByAI ? "Gemini AI" : "rules engine"} · qty=${qty}`,
  });

  return NextResponse.json({ ...getRfq(id), derivedByAI });
}
