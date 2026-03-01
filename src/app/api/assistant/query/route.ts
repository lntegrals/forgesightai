import { NextRequest, NextResponse } from "next/server";
import { planQuery, runPlan, summarize } from "@/core/assistant/ask";
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

  // Step 3: Summarize — fall back to local summary if Gemini unavailable
  let answerMarkdown: string | null = null;
  let summaryError: string | null = null;

  if (!usedFallbackPlan) {
    const sumResult = await summarize(question, execResult.results, execResult.citations);
    if (sumResult.ok) {
      answerMarkdown = sumResult.answerMarkdown;
    } else {
      summaryError = sumResult.error;
      // Build a local fallback summary from results
      answerMarkdown = buildFallbackSummary(question, execResult.results);
    }
  } else {
    // Planner was rate-limited — use local summary directly
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
