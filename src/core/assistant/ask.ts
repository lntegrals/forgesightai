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

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  const result = await geminiGenerateJSON<QueryPlan>({
    model,
    system: `You are a query planner for ForgeSight AI, a manufacturing quoting system.
Given a natural language question, produce a structured QueryPlan JSON.

Available intents:
- search_rfqs: filter RFQs by customer, material, status, quantity, date, finish, actuals
- similar_rfqs: find RFQs similar to a given rfqId (put rfqId in filters.rfqId)
- variance_report: search RFQs that have actuals (set hasActuals:true) to analyze cost variances
- analytics: aggregate data by groupBy with metrics

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

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  const result = await geminiGenerateJSON<{ answerMarkdown: string }>({
    model,
    system: `You are ForgeSight AI assistant for a manufacturing shop. Answer questions about RFQs and quotes using ONLY the data provided in the RESULTS JSON. Do not invent numbers or facts not present in the data. Use Markdown formatting. Cite RFQ IDs inline using the format [rfq-id].`,
    user: `QUESTION: ${question}

RESULTS JSON:
${JSON.stringify(results, null, 2)}

AVAILABLE CITATION IDs: ${citations.length > 0 ? citations.join(", ") : "(none)"}

Write a concise Markdown answer using only the data above. Cite relevant RFQ IDs inline.`,
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
