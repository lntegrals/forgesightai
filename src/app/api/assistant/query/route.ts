import { NextRequest, NextResponse } from "next/server";
import { planQuery, runPlan, summarize } from "@/core/assistant/ask";
import { getRfq, getAllRfqs } from "@/core/store";
import type { QueryPlan } from "@/core/assistant/schema";

// ── Smart local fallback summarizer ──────────────────────────────────────────
// Produces contextual answers using actual data when Gemini is unavailable.

type QuoteLineItem = { type: string; label: string; amount: number };
type EnrichedRow = Record<string, unknown> & {
  customerName?: string;
  subject?: string;
  status?: string;
  material?: string;
  qty?: number;
  totalQuoted?: number;
  hasQuote?: boolean;
  fields?: Record<string, string>;
  quote?: {
    lineItems?: QuoteLineItem[];
    totals?: { subtotal?: number; total?: number; marginAmount?: number; overheadAmount?: number };
  };
};

function fmt$(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildSmartFallback(question: string, enrichedResults: unknown): string {
  const rows = (Array.isArray(enrichedResults) ? enrichedResults : []) as EnrichedRow[];
  const q = question.toLowerCase();

  if (rows.length === 0) {
    return `No RFQs found matching: "${question}"`;
  }

  // ── Total / pipeline value ────────────────────────────────────────────────
  if (/total|pipeline.?value|worth|sum|how much.*pipeline|aggregate|revenue/.test(q)) {
    const quoted = rows.filter((r) => r.totalQuoted != null);
    const total = quoted.reduce((s, r) => s + (Number(r.totalQuoted) || 0), 0);
    const unquoted = rows.filter((r) => r.totalQuoted == null);
    let out = `**Total quoted pipeline: ${fmt$(total)}** across ${quoted.length} quoted RFQ${quoted.length !== 1 ? "s" : ""}.`;
    if (quoted.length > 0) {
      out += "\n\n" + quoted
        .sort((a, b) => (Number(b.totalQuoted) || 0) - (Number(a.totalQuoted) || 0))
        .map((r) => `- **${r.customerName}**: ${r.subject} — **${fmt$(Number(r.totalQuoted))}**`)
        .join("\n");
    }
    if (unquoted.length > 0) {
      out += `\n\n${unquoted.length} RFQ${unquoted.length !== 1 ? "s" : ""} not yet quoted: ${unquoted.map((r) => `**${r.customerName}**`).join(", ")}.`;
    }
    return out;
  }

  // ── Specific quote cost breakdown ─────────────────────────────────────────
  if (/how.*quoted|quote.*breakdown|what.*cost|labor.*cost|material.*cost|machine.*cost/.test(q)) {
    const withQuote = rows.filter((r) => r.quote?.totals);
    if (withQuote.length === 1) {
      const r = withQuote[0];
      const items = r.quote!.lineItems ?? [];
      const li = (type: string) => items.find((i) => i.type === type)?.amount ?? 0;
      return `**${r.customerName}** — ${r.subject}\n\n` +
        `- **Total**: ${fmt$(r.quote!.totals!.total ?? 0)}\n` +
        `- Material: ${fmt$(li("MATERIAL"))}\n` +
        `- Setup: ${fmt$(li("SETUP"))}\n` +
        `- Machine: ${fmt$(li("RUN_TIME"))}\n` +
        `- Labor: ${fmt$(li("LABOR"))}\n` +
        `- Overhead: ${fmt$(r.quote!.totals!.overheadAmount ?? 0)}\n` +
        `- Margin: ${fmt$(r.quote!.totals!.marginAmount ?? 0)}`;
    }
    if (withQuote.length > 1) {
      return withQuote.map((r) => {
        const items = r.quote!.lineItems ?? [];
        const li = (type: string) => items.find((i) => i.type === type)?.amount ?? 0;
        return `- **${r.customerName}**: **${fmt$(r.quote!.totals!.total ?? 0)}** (mat: ${fmt$(li("MATERIAL"))}, labor: ${fmt$(li("LABOR"))}, machine: ${fmt$(li("RUN_TIME"))})`;
      }).join("\n");
    }
  }

  // ── Specific field lookup: material, tolerance, certs, part number, etc. ──
  const fieldWords: [RegExp, string][] = [
    [/material|alloy|grade/, "material"],
    [/tolerance|tol\b/, "tolerance"],
    [/cert|certification/, "certifications"],
    [/part.?number|drawing|dwg/, "partNumber"],
    [/finish|anodize|plate|coating/, "finish"],
    [/thread/, "threads"],
    [/delivery|lead.?time|due.?date/, "deliveryLeadTime"],
    [/process|machining/, "process"],
    [/quantity|how many|qty/, "quantity"],
  ];

  for (const [pattern, fieldKey] of fieldWords) {
    if (pattern.test(q)) {
      const withField = rows.filter((r) => r.fields?.[fieldKey]);
      if (withField.length > 0) {
        if (withField.length === 1) {
          const r = withField[0];
          return `**${r.customerName}** — ${fieldKey}: **${r.fields![fieldKey]}**`;
        }
        return withField.map((r) =>
          `- **${r.customerName}**: ${r.fields![fieldKey] ?? "not specified"}`
        ).join("\n");
      }
    }
  }

  // ── Count ─────────────────────────────────────────────────────────────────
  if (/how many|count/.test(q)) {
    return `There are **${rows.length} RFQ${rows.length !== 1 ? "s" : ""}** in the system.`;
  }

  // ── Status breakdown ──────────────────────────────────────────────────────
  if (/status|breakdown|by status/.test(q)) {
    const groups: Record<string, number> = {};
    for (const r of rows) groups[r.status ?? "UNKNOWN"] = (groups[r.status ?? "UNKNOWN"] ?? 0) + 1;
    return "**RFQ status breakdown:**\n\n" +
      Object.entries(groups).map(([s, n]) => `- \`${s}\`: **${n}**`).join("\n");
  }

  // ── Default: rich list ────────────────────────────────────────────────────
  const lines = rows.slice(0, 10).map((r) => {
    const price = r.totalQuoted != null ? ` · **${fmt$(Number(r.totalQuoted))}**` : "";
    const mat = r.material ? ` · ${r.material}` : "";
    const status = r.status ? ` \`${r.status}\`` : "";
    return `- **${r.customerName}**: ${r.subject ?? "—"}${status}${mat}${price}`;
  });
  const more = rows.length > 10 ? `\n\n_…and ${rows.length - 10} more._` : "";
  return `Found **${rows.length}** RFQ${rows.length !== 1 ? "s" : ""}:\n\n${lines.join("\n")}${more}`;
}

// ── Enrich DerivedRFQ results ─────────────────────────────────────────────────

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
    const { searchText: _st, qtyBucket: _qb, toleranceBand: _tb, toleranceAbs: _ta, ...rest } = r;
    void _st; void _qb; void _tb; void _ta;
    return { ...rest, fields, rawSnippet: full.rawText.slice(0, 800), quote: full.quote ?? undefined };
  });
}

// ── Fallback query plan (keyword search) ─────────────────────────────────────

function buildFallbackPlan(question: string): QueryPlan {
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
  return { intent: "search_rfqs", filters: keyword ? { q: keyword } : {}, limit: 20 };
}

// ── Retry broadening on empty results ────────────────────────────────────────

async function runPlanWithFallback(plan: QueryPlan) {
  const result = await runPlan(plan);
  if (!result.ok) return result;

  if (Array.isArray(result.results) && result.results.length === 0) {
    if (plan.filters?.status) {
      const { status: _s, ...restFilters } = (plan.filters ?? {}) as Record<string, unknown>;
      void _s;
      const broad = await runPlan({ ...plan, filters: restFilters as QueryPlan["filters"] });
      if (broad.ok && Array.isArray(broad.results) && broad.results.length > 0) return broad;
    }
    if (plan.filters?.q) {
      const broad = await runPlan({ intent: "search_rfqs", filters: { q: plan.filters.q }, limit: plan.limit ?? 20 });
      if (broad.ok && Array.isArray(broad.results) && broad.results.length > 0) return broad;
    }
    return await runPlan({ intent: "search_rfqs", filters: {}, limit: plan.limit ?? 20 });
  }

  return result;
}

// ── Route handler ─────────────────────────────────────────────────────────────

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

  // Step 1: Plan
  const planResult = await planQuery(question);
  let plan: QueryPlan;
  let usedFallbackPlan = false;

  if (planResult.ok) {
    plan = planResult.plan;
  } else {
    usedFallbackPlan = true;
    plan = buildFallbackPlan(question);
  }

  // Step 2: Execute with broadening
  const execResult = await runPlanWithFallback(plan);
  if (!execResult.ok) {
    return NextResponse.json({ error: `Executor failed: ${execResult.error}` }, { status: 500 });
  }

  const enrichedResults = enrichResults(execResult.results);

  // Step 3: Summarize — Gemini first, smart local fallback on any failure
  let answerMarkdown: string | null = null;
  let summaryError: string | null = null;

  const sumResult = await summarize(question, enrichedResults, execResult.citations);
  if (sumResult.ok) {
    answerMarkdown = sumResult.answerMarkdown;
  } else {
    summaryError = sumResult.error;
    answerMarkdown = buildSmartFallback(question, enrichedResults);
  }

  if (!answerMarkdown) {
    answerMarkdown = getAllRfqs().length > 0
      ? buildSmartFallback(question, enrichedResults)
      : "No RFQs in the system yet — create one to get started.";
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
