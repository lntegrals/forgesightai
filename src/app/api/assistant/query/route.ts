import { NextRequest, NextResponse } from "next/server";
import { planQuery, runPlan, summarize } from "@/core/assistant/ask";
import { getRfq } from "@/core/store";
import type { QueryPlan } from "@/core/assistant/schema";

// Build a simple non-AI summary when Gemini is unavailable
function buildFallbackSummary(question: string, results: unknown): string {
  if (!Array.isArray(results) || results.length === 0) {
    return `No RFQs found for: "${question}"`;
  }
  const lines = results.slice(0, 6).map((r: Record<string, unknown>) => {
    const total = r.totalQuoted != null
      ? ` — $${Number(r.totalQuoted).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
      : "";
    return `- **${r.customerName ?? r.id}**: ${r.subject ?? "—"} \`${r.status ?? ""}\`${total}`;
  });
  const more = results.length > 6 ? `\n\n_…and ${results.length - 6} more._` : "";
  return `Found **${results.length}** RFQ${results.length !== 1 ? "s" : ""}:\n\n${lines.join("\n")}${more}`;
}

// Enrich DerivedRFQ results with extracted field values so Gemini can answer
// questions about part numbers, certifications, threads, etc.
function enrichResults(results: unknown): unknown {
  if (!Array.isArray(results)) return results;
  return results.map((r: Record<string, unknown>) => {
    const id = r.id as string | undefined;
    if (!id) return r;
    const full = getRfq(id);
    if (!full) return r;
    // Flatten extractedFields into a key→value map for easy reading by Gemini
    const fields: Record<string, string> = {};
    for (const f of full.extractedFields) {
      fields[f.key] = f.userOverrideValue ?? f.value;
    }
    // Include raw RFQ subject, customer, and fields — omit noisy internal props
    const { searchText: _st, qtyBucket: _qb, toleranceBand: _tb, ...rest } = r as Record<string, unknown>;
    void _st; void _qb; void _tb;
    return { ...rest, fields };
  });
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
    // Rate-limited or no API key — keyword search fallback
    usedFallbackPlan = true;

    // Strip common filler words; use remaining as the search keyword
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

  // Step 2: Execute (always deterministic — no AI here)
  const execResult = await runPlan(plan);
  if (!execResult.ok) {
    return NextResponse.json(
      { error: `Executor failed: ${execResult.error}` },
      { status: 500 }
    );
  }

  // Enrich results with extracted field data so Gemini can answer specific questions
  const enrichedResults = enrichResults(execResult.results);

  // Step 3: Summarize — fall back to local summary if Gemini unavailable
  let answerMarkdown: string | null = null;
  let summaryError: string | null = null;

  if (!usedFallbackPlan) {
    const sumResult = await summarize(question, enrichedResults, execResult.citations);
    if (sumResult.ok) {
      answerMarkdown = sumResult.answerMarkdown;
    } else {
      summaryError = sumResult.error;
      answerMarkdown = buildFallbackSummary(question, execResult.results);
    }
  } else {
    answerMarkdown = buildFallbackSummary(question, execResult.results);
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
