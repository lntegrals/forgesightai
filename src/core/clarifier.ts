/**
 * clarifier.ts — Gemini-powered RFQ clarifier.
 *
 * Generates questions, assumptions, and risk flags from extracted RFQ data.
 * Requires GEMINI_API_KEY; returns ok:false if absent.
 */
import { geminiGenerateJSON } from "./gemini";
import type { RFQ, ClarifierOutput, RfqCleaning, ExtractedField } from "./types";

const CLARIFIER_PROMPT_VERSION = "gemini-clarifier-v1";

const CLARIFIER_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          required: { type: "boolean" },
          rationale: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["id", "question", "required", "rationale", "confidence"],
      },
    },
    assumptions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          assumption: { type: "string" },
          appliesToKeys: { type: "array", items: { type: "string" } },
          confidence: { type: "number" },
        },
        required: ["id", "assumption", "appliesToKeys", "confidence"],
      },
    },
    riskFlags: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          severity: { type: "string", enum: ["low", "med", "high"] },
          evidenceSnippet: { type: "string" },
        },
        required: ["id", "label", "severity", "evidenceSnippet"],
      },
    },
  },
  required: ["questions", "assumptions", "riskFlags"],
};

export async function generateClarifier(rfq: {
  rawText: string;
  cleaning?: RfqCleaning;
  extractedFields: ExtractedField[];
}): Promise<{ ok: true; clarifier: ClarifierOutput } | { ok: false; error: string }> {
  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, error: "GEMINI_API_KEY not set" };
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const textToUse = rfq.cleaning?.cleanedText ?? rfq.rawText;

  const fieldsJson = JSON.stringify(
    rfq.extractedFields.map((f) => ({
      key: f.key,
      label: f.label,
      value: f.userOverrideValue ?? f.value,
      confidence: f.confidence,
    }))
  );

  const result = await geminiGenerateJSON<{
    questions: ClarifierOutput["questions"];
    assumptions: ClarifierOutput["assumptions"];
    riskFlags: ClarifierOutput["riskFlags"];
  }>({
    model,
    system: `You are a senior manufacturing quoting engineer reviewing a specific RFQ.
Identify ONLY gaps that block accurate pricing of THIS specific job.

Rules:
1. Questions must reference specific values, part numbers, or specs FROM THIS RFQ — never generic.
   BAD: "What tolerance is required?"
   GOOD: "The OD is specified as ±0.025mm — does this apply to both bearing journals or just the outboard one?"
2. Generate 2–4 required questions ONLY if they materially change price by >10%.
3. Each assumption must state the concrete value you will use to proceed.
4. Risk flags must quote SPECIFIC evidence text from this RFQ.
5. Use IDs: q1, q2... a1, a2... r1, r2...

Ask about (only where THIS RFQ is ambiguous):
- Thread class/fit if threads are mentioned but fit class not specified
- Inspection level (CMM per unit? First article only? SPC sampling rate?)
- Certification package specifics (material traceability level, CoC format)
- Finish details (thickness, color, masking areas, rack marks acceptable?)
- Delivery terms (FOB point, ARO start date, partial shipments allowed?)
- Quantity breaks if prototype + production quantities could both apply`,
    user: `RFQ TEXT:\n${textToUse}\n\nEXTRACTED FIELDS:\n${fieldsJson}`,
    responseJsonSchema: CLARIFIER_RESPONSE_SCHEMA,
    temperature: 0.2,
    maxOutputTokens: 1024,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const clarifier: ClarifierOutput = {
    questions: result.json.questions,
    assumptions: result.json.assumptions,
    riskFlags: result.json.riskFlags,
    generatedAt: new Date().toISOString(),
    engine: "gemini",
    model: result.model,
    promptVersion: CLARIFIER_PROMPT_VERSION,
  };

  return { ok: true, clarifier };
}

export function isClarifierComplete(rfq: RFQ): { ok: boolean; missing: string[] } {
  // No clarifier generated → don't block legacy flow
  if (!rfq.clarifier) return { ok: true, missing: [] };

  const missing: string[] = [];
  const answers = rfq.clarifierAnswers ?? {};
  const confirmedIds = new Set(rfq.confirmedAssumptions ?? []);

  for (const q of rfq.clarifier.questions) {
    if (!q.required) continue;
    if (answers[q.id]) continue; // answered

    // Check if a confirmed assumption explicitly covers this question
    const covered = rfq.clarifier.assumptions.some(
      (a) => confirmedIds.has(a.id) && a.appliesToKeys.includes(q.id)
    );
    if (!covered) {
      missing.push(`Unanswered required question: "${q.question}"`);
    }
  }

  return { ok: missing.length === 0, missing };
}
