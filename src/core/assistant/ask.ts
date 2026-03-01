/**
 * ask.ts — Ask ForgeSight: plan → execute → summarize.
 *
 * Pipeline:
 *   1. planQuery   — Gemini produces a structured QueryPlan JSON
 *   2. runPlan     — deterministic execution against the local store
 *   3. summarize   — Gemini writes a Markdown answer using only results data
 */
import { geminiGenerateJSON } from "../gemini";
import { QueryPlanSchema, QUERY_PLAN_JSON_SCHEMA, type QueryPlan } from "./schema";
import { searchRFQs } from "../query";
import { similarRFQs } from "../similarity";
import type { DerivedRFQ } from "../derive";

// ── 1. Planner ────────────────────────────────────────────────────────────────

export async function planQuery(
  question: string
): Promise<{ ok: true; plan: QueryPlan } | { ok: false; error: string }> {
  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, error: "GEMINI_API_KEY not set" };
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

  const result = await geminiGenerateJSON<QueryPlan>({
    model,
    system: `You are a query planner for ForgeSight AI, a manufacturing quoting system.
Given a natural language question, produce a structured QueryPlan JSON.

Available intents:
- search_rfqs: filter RFQs by customer, material, status, quantity, date, finish, actuals
- similar_rfqs: find RFQs similar to a given rfqId (put rfqId in filters.rfqId)
- variance_report: search RFQs that have actuals (set hasActuals:true) to analyze cost variances
- analytics: aggregate data by groupBy with metrics

Valid RFQ status values (use EXACT strings, no other values):
  NEW             - just created, not yet extracted
  EXTRACTED       - AI has extracted fields, awaiting review
  NEEDS_REVIEW    - flagged for human review
  READY_TO_SEND   - quote ready to send
  SENT            - quote has been sent to customer

CRITICAL — status filter rules:
  "needs review" / "inbox" / "unreviewed" → OMIT status filter entirely (return all)
  "ready to quote" / "quoted" / "has a quote" → status: READY_TO_SEND
  "sent" / "delivered" / "completed" → status: SENT
  "pipeline" / "all" / "show me" / "list" / general questions → OMIT status filter
  If ANY doubt about status, OMIT the status filter — the fallback will broaden automatically.

For general questions like "show all RFQs", "what's in the pipeline", "total value" → use intent: search_rfqs with NO filters.
For material questions like "titanium jobs" → use filters.q: "titanium" with NO status filter.
For customer questions → use filters.q: "<customer name>" with NO status filter.

Dates in filters must be ISO 8601 strings (e.g. "2026-01-01").
Limit defaults to 20 if not specified; max 50.`,
    user: question,
    responseJsonSchema: QUERY_PLAN_JSON_SCHEMA,
    temperature: 0.1,
    maxOutputTokens: 512,
  });

  if (!result.ok) return { ok: false, error: result.error };

  try {
    const plan = QueryPlanSchema.parse(result.json);
    return { ok: true, plan };
  } catch (e) {
    return { ok: false, error: `Invalid plan schema: ${e}` };
  }
}

// ── 2. Executor ───────────────────────────────────────────────────────────────

export async function runPlan(
  plan: QueryPlan
): Promise<{ ok: true; results: unknown; citations: string[] } | { ok: false; error: string }> {
  try {
    // similar_rfqs intent
    if (plan.intent === "similar_rfqs") {
      const rfqId = (plan.filters as Record<string, unknown>)?.rfqId as string | undefined;
      if (!rfqId) {
        return { ok: false, error: "similar_rfqs intent requires filters.rfqId" };
      }
      const results = await similarRFQs(rfqId, plan.limit ?? 5);
      return { ok: true, results, citations: results.map((r) => r.id) };
    }

    // All other intents use searchRFQs
    const { rows } = await searchRFQs(plan.filters ?? {}, {
      sortBy: plan.sort?.by,
      sortDir: plan.sort?.dir,
      limit: plan.limit ?? 20,
    });

    const citations = rows.map((r) => r.id);

    // Plain search / variance report — return rows directly
    if (plan.intent === "search_rfqs" || plan.intent === "variance_report") {
      return { ok: true, results: rows, citations };
    }

    // Analytics — aggregate by groupBy
    if (plan.intent === "analytics") {
      if (!plan.groupBy) {
        return { ok: true, results: { total: rows.length, rows }, citations };
      }

      const grouped: Record<string, DerivedRFQ[]> = {};
      for (const row of rows) {
        let key: string;
        if (plan.groupBy === "month") {
          key = row.createdAt.slice(0, 7); // "YYYY-MM"
        } else {
          key = (row[plan.groupBy] as string | undefined) ?? "unknown";
        }
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(row);
      }

      const metrics = plan.metrics ?? ["count"];
      const aggregated: Record<string, Record<string, unknown>> = {};
      for (const [k, items] of Object.entries(grouped)) {
        const agg: Record<string, unknown> = {};
        if (metrics.includes("count")) agg.count = items.length;
        if (metrics.includes("avgTotalQuoted")) {
          const vals = items.map((i) => i.totalQuoted ?? 0);
          agg.avgTotalQuoted = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
        }
        if (metrics.includes("avgVariancePct")) {
          const vals = items.map((i) => i.variancePct ?? 0);
          agg.avgVariancePct = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
        }
        aggregated[k] = agg;
      }
      return { ok: true, results: aggregated, citations };
    }

    return { ok: false, error: `Unknown intent: ${plan.intent}` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── 3. Summarizer ─────────────────────────────────────────────────────────────

export async function summarize(
  question: string,
  results: unknown,
  citations: string[]
): Promise<{ ok: true; answerMarkdown: string } | { ok: false; error: string }> {
  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, error: "GEMINI_API_KEY not set" };
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

  const result = await geminiGenerateJSON<{ answerMarkdown: string }>({
    model,
    system: `You are ForgeSight AI, the intelligent assistant for a precision CNC manufacturing quoting shop.
Answer questions about RFQs using ONLY the RESULTS JSON provided. Never invent data.

Data structure per result:
- Top-level: id, customerName, subject, status, material, qty, totalQuoted, hasQuote
- \`fields\` object: all AI-extracted values — material, quantity, partNumber, tolerance, surfaceFinish, threads, finish, certifications, deliveryLeadTime, process, notes, etc.
- \`quote\` object (if present): totals.total, totals.materialCost, totals.laborCost, totals.machineCost, totals.margin, inputs.setupHours, inputs.laborHours, inputs.machineHours, inputs.materialCostPerUnit, inputs.quantity
- \`rawSnippet\`: first 800 chars of the original RFQ text

Rules:
- Use **bold** for customer names, dollar amounts, part numbers, and key specs
- Use bullet lists when listing multiple RFQs or items
- Be specific — quote EXACT values from the data (e.g. "$12,450.00", "Ti-6Al-4V Grade 5", "±0.025mm")
- For financial/quote questions: use quote.totals.* values — these are the authoritative numbers
- If a field wasn't extracted and isn't in rawSnippet, say "not specified"
- Do NOT say "based on the data" — just answer directly
- Keep responses concise and direct`,
    user: `QUESTION: ${question}

RESULTS DATA:
${JSON.stringify(results, null, 2)}

Answer the question using exact values from the data above.`,
    responseJsonSchema: {
      type: "object",
      properties: { answerMarkdown: { type: "string" } },
      required: ["answerMarkdown"],
    },
    temperature: 0.3,
    maxOutputTokens: 1024,
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, answerMarkdown: result.json.answerMarkdown };
}
