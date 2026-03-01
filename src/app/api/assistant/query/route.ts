import { NextRequest, NextResponse } from "next/server";
import { planQuery, runPlan, summarize } from "@/core/assistant/ask";
import { getRfq, getAllRfqs } from "@/core/store";
import type { QueryPlan } from "@/core/assistant/schema";

// Build a clean non-AI summary when Gemini is unavailable
function buildFallbackSummary(question: string, results: unknown): string {
  if (!Array.isArray(results) || results.length === 0) {
    return `No RFQs found matching: "${question}"`;
  }
  const lines = results.slice(0, 8).map((r: Record<string, unknown>) => {
    const total = r.totalQuoted != null
      ? ` · **$${Number(r.totalQuoted).toLocaleString("en-US", { minimumFractionDigits: 2 })}**`
      : "";
    const mat = (r as Record<string, unknown>).material;
    const matStr = mat ? ` · ${mat}` : "";
    return `- **${r.customerName ?? r.id}**: ${r.subject ?? "—"} \`${r.status ?? ""}\`${matStr}${total}`;
  });
  const more = results.length > 8 ? `\n\n_…and ${results.length - 8} more._` : "";
  return `Found **${results.length}** RFQ${results.length !== 1 ? "s" : ""}:\n\n${lines.join("\n")}${more}`;
}

// Enrich DerivedRFQ results with all extracted field values so Gemini can answer
// questions about part numbers, certifications, threads, delivery dates, etc.
function enrichResults(results: unknown): unknown {
  if (!Array.isArray(results)) return results;
  return results.map((r: Record<string, unknown>) => {
    const id = r.id as string | undefined;
    if (!id) return r;
    const full = getRfq(id);
    if (!full) return r;
    const fields: Record<string, string> = {};
    for (const f of full.extractedFields) {
      fields[f.key] = f.userOverrideValue ?? f.value;
    }
    // Strip noisy internal fields before sending to Gemini
    const { searchText: _st, qtyBucket: _qb, toleranceBand: _tb, toleranceAbs: _ta, ...rest } = r;
    void _st; void _qb; void _tb; void _ta;
    return { ...rest, fields, rawSnippet: full.rawText.slice(0, 800), quote: full.quote ?? undefined };
  });
}

// If a filtered plan returns 0 results, retry with a broader search
async function runPlanWithFallback(plan: QueryPlan) {
  const result = await runPlan(plan);
  if (!result.ok) return result;

  // If narrow filters return nothing, broaden the search
  if (Array.isArray(result.results) && result.results.length === 0) {
    // Try without status filter first
    if (plan.filters?.status) {
      const { status: _s, ...restFilters } = (plan.filters ?? {}) as Record<string, unknown>;
      void _s;
      const broadResult = await runPlan({ ...plan, filters: restFilters as QueryPlan["filters"] });
      if (broadResult.ok && Array.isArray(broadResult.results) && broadResult.results.length > 0) {
        return broadResult;
      }
    }
    // Try with just a text search if there are other filters
    if (plan.filters?.q) {
      const broadResult = await runPlan({ intent: "search_rfqs", filters: { q: plan.filters.q }, limit: plan.limit ?? 20 });
      if (broadResult.ok && Array.isArray(broadResult.results) && broadResult.results.length > 0) {
        return broadResult;
      }
    }
    // Last resort: return all RFQs
    const allResult = await runPlan({ intent: "search_rfqs", filters: {}, limit: plan.limit ?? 20 });
    return allResult;
  }

  return result;
}

export async function POST(request: NextRequest) {
  let body: { question?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  // Step 1: Plan — fall back to keyword search if Gemini is unavailable / rate-limited
  const planResult = await planQuery(question);
  let plan: QueryPlan;
  let usedFallbackPlan = false;

  if (planResult.ok) {
    plan = planResult.plan;
  } else {
    usedFallbackPlan = true;

    const STOP = new Set([
      "show", "list", "find", "get", "give", "tell", "me", "all", "the", "a",
      "an", "my", "our", "any", "which", "what", "are", "is", "in", "of",
      "for", "to", "with", "have", "has", "do", "does", "need", "needs",
      "rfq", "rfqs", "pipeline", "quote", "quotes", "jobs", "job",
    ]);
    const keyword = question
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .slice(0, 2)
      .join(" ");

    plan = {
      intent: "search_rfqs",
      filters: keyword ? { q: keyword } : {},
      limit: 20,
    };
  }

  // Step 2: Execute with automatic broadening if narrow plan returns nothing
  const execResult = await runPlanWithFallback(plan);
  if (!execResult.ok) {
    return NextResponse.json(
      { error: `Executor failed: ${execResult.error}` },
      { status: 500 }
    );
  }

  // Enrich results with extracted field data + raw text snippet
  const enrichedResults = enrichResults(execResult.results);

  // Step 3: Summarize — always try Gemini; fall back to local summary only on failure
  let answerMarkdown: string | null = null;
  let summaryError: string | null = null;

  const sumResult = await summarize(question, enrichedResults, execResult.citations);
  if (sumResult.ok) {
    answerMarkdown = sumResult.answerMarkdown;
  } else {
    summaryError = sumResult.error;
    answerMarkdown = buildFallbackSummary(question, execResult.results);
  }

  // Final safety net: ensure we always have some answer text
  if (!answerMarkdown) {
    const total = getAllRfqs().length;
    answerMarkdown = total > 0
      ? buildFallbackSummary(question, execResult.results)
      : `No RFQs in the system yet — create one to get started.`;
  }

  return NextResponse.json({
    plan,
    usedFallbackPlan,
    results: execResult.results,
    citations: execResult.citations,
    answerMarkdown,
    summaryError,
  });
}
