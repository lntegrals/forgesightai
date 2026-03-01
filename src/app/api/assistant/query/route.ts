import { NextRequest, NextResponse } from "next/server";
import { planQuery, runPlan, summarize } from "@/core/assistant/ask";

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
  if (!planResult.ok) {
    return NextResponse.json(
      { error: `Planner failed: ${planResult.error}` },
      { status: 503 }
    );
  }

  // Step 2: Execute
  const execResult = await runPlan(planResult.plan);
  if (!execResult.ok) {
    return NextResponse.json(
      { error: `Executor failed: ${execResult.error}` },
      { status: 500 }
    );
  }

  // Step 3: Summarize
  const sumResult = await summarize(question, execResult.results, execResult.citations);

  return NextResponse.json({
    plan: planResult.plan,
    results: execResult.results,
    citations: execResult.citations,
    answerMarkdown: sumResult.ok ? sumResult.answerMarkdown : null,
    summaryError: sumResult.ok ? null : sumResult.error,
  });
}
