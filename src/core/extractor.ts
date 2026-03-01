/**
 * extractor.ts — Field extraction adapter.
 *
 * Priority:
 *   1. Gemini (when GEMINI_API_KEY set): clean → structured extraction
 *   2. Anthropic LLM (when ANTHROPIC_API_KEY set and mode=LLM)
 *   3. MOCK — deterministic regex. Demo-safe, no keys required.
 */
import { z } from "zod";
import { ExtractorMode, type ExtractedField, type ExtractionMeta, type RfqCleaning } from "./types";
import { geminiGenerateJSON } from "./gemini";

// ── Prompt version constants ──────────────────────────────────────────────────

const CLEAN_PROMPT_VERSION = "gemini-clean-v1";
const EXTRACT_PROMPT_VERSION = "gemini-extract-v1";

// ── Zod schema for validated LLM output (Anthropic path) ─────────────────────

const ExtractedFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string(),
  confidence: z.number().min(0).max(1),
  sourceSnippet: z.string(),
  sourceRef: z.string(),
});

export const ExtractedRFQSchema = z.object({
  fields: z.array(ExtractedFieldSchema),
});

type ExtractedRFQOutput = z.infer<typeof ExtractedRFQSchema>;

// ── Gemini JSON schemas ───────────────────────────────────────────────────────

const CLEAN_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    cleanedText: { type: "string" },
    removedSections: { type: "array", items: { type: "string" } },
    normalizationNotes: { type: "array", items: { type: "string" } },
    confidence: { type: "number" },
  },
  required: ["cleanedText", "removedSections", "normalizationNotes", "confidence"],
};

const EXTRACT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    fields: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          label: { type: "string" },
          value: { type: "string" },
          confidence: { type: "number" },
          sourceSnippet: { type: "string" },
          sourceRef: { type: "string" },
        },
        required: ["key", "label", "value", "confidence", "sourceSnippet", "sourceRef"],
      },
    },
  },
  required: ["fields"],
};

// ── cleanRfqText (Gemini) ─────────────────────────────────────────────────────

export async function cleanRfqText(rawText: string): Promise<
  | { ok: true; cleaning: RfqCleaning; meta: ExtractionMeta }
  | { ok: false; error: string }
> {
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  const result = await geminiGenerateJSON<{
    cleanedText: string;
    removedSections: string[];
    normalizationNotes: string[];
    confidence: number;
  }>({
    model,
    system: `You are a manufacturing RFQ pre-processor. Clean and normalize the RFQ text by:
- Removing email headers, greetings, signatures, repeated disclaimers, forwarding chains
- Normalizing units and number formats
- Preserving ALL technical specifications (materials, tolerances, quantities, finish, dates, part numbers)
Return the cleaned text and describe what was removed.`,
    user: rawText,
    responseJsonSchema: CLEAN_RESPONSE_SCHEMA,
    temperature: 0.1,
    maxOutputTokens: 2048,
  });

  if (!result.ok) return { ok: false, error: result.error };

  const now = new Date().toISOString();
  const cleaning: RfqCleaning = {
    cleanedText: result.json.cleanedText,
    removedSections: result.json.removedSections,
    normalizationNotes: result.json.normalizationNotes,
    confidence: Math.max(0, Math.min(1, result.json.confidence)),
  };
  const meta: ExtractionMeta = {
    engine: "gemini",
    model: result.model,
    promptVersion: CLEAN_PROMPT_VERSION,
    extractedAt: now,
    cleanedAt: now,
  };

  return { ok: true, cleaning, meta };
}

// ── extractFieldsGemini ───────────────────────────────────────────────────────

export async function extractFieldsGemini(args: {
  rawText: string;
  cleanedText?: string;
}): Promise<{ ok: true; fields: ExtractedField[]; meta: ExtractionMeta } | { ok: false; error: string }> {
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const textToUse = args.cleanedText ?? args.rawText;

  const result = await geminiGenerateJSON<{
    fields: Array<{
      key: string;
      label: string;
      value: string;
      confidence: number;
      sourceSnippet: string;
      sourceRef: string;
    }>;
  }>({
    model,
    system: `You are a manufacturing RFQ parser. Extract structured fields from the RFQ text.
Extract these fields when clearly present: material, quantity, tolerance, finish, dueDate, partNumber, process.
Omit fields not found. Set confidence 0.0–1.0 based on clarity of evidence.
For ambiguous values (e.g. "TBD — likely 25-50") set confidence < 0.5.`,
    user: textToUse,
    responseJsonSchema: EXTRACT_RESPONSE_SCHEMA,
    temperature: 0.1,
    maxOutputTokens: 1024,
  });

  if (!result.ok) return { ok: false, error: result.error };

  const fields: ExtractedField[] = result.json.fields.map((f) => ({
    key: f.key,
    label: f.label,
    value: f.value,
    confidence: Math.max(0, Math.min(1, f.confidence)),
    sourceSnippet: f.sourceSnippet,
    sourceRef: f.sourceRef,
    isConfirmed: f.confidence >= 0.85,
    userOverrideValue: null,
  }));

  const meta: ExtractionMeta = {
    engine: "gemini",
    model: result.model,
    promptVersion: EXTRACT_PROMPT_VERSION,
    extractedAt: new Date().toISOString(),
  };

  return { ok: true, fields, meta };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function extractFields(
  rawText: string,
  mode: ExtractorMode = ExtractorMode.MOCK
): Promise<ExtractedField[]> {
  // Gemini takes priority when key is set
  if (process.env.GEMINI_API_KEY) {
    try {
      const result = await extractFieldsGemini({ rawText });
      if (result.ok) return result.fields;
      console.warn("[extractor] Gemini extraction failed, falling back to MOCK:", result.error);
    } catch (err) {
      console.warn("[extractor] Gemini extraction threw, falling back to MOCK:", err);
    }
  }

  // Anthropic LLM fallback (legacy path)
  if (mode === ExtractorMode.LLM && process.env.ANTHROPIC_API_KEY) {
    try {
      return await extractFieldsLLM(rawText);
    } catch (err) {
      console.warn("[extractor] LLM extraction failed, falling back to MOCK:", err);
    }
  }

  return extractFieldsMock(rawText);
}

// ── LLM extractor (Anthropic Messages API) ────────────────────────────────────

async function extractFieldsLLM(rawText: string): Promise<ExtractedField[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;

  const systemPrompt = `You are a manufacturing RFQ parser. Extract structured fields from the provided RFQ text.
Return ONLY valid JSON matching this exact schema:
{
  "fields": [
    {
      "key": "material",
      "label": "Material",
      "value": "6061-T6 Aluminum",
      "confidence": 0.95,
      "sourceSnippet": "exact text from the RFQ",
      "sourceRef": "Line N"
    }
  ]
}
Extract these fields when clearly present: material, quantity, tolerance, finish, dueDate, partNumber, process.
Omit fields not found. Set confidence 0.0–1.0 based on clarity of evidence in the text.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: rawText }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const result = await response.json() as { content: { text: string }[] };
  const text = result.content[0]?.text ?? "";

  // Extract JSON from response (may contain markdown fences)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in LLM response");

  const parsed = JSON.parse(jsonMatch[0]) as unknown;
  const validated: ExtractedRFQOutput = ExtractedRFQSchema.parse(parsed);

  return validated.fields.map((f) => ({
    ...f,
    isConfirmed: false,
    userOverrideValue: null,
  }));
}

// ── MOCK extractor (deterministic regex) ─────────────────────────────────────

function extractFieldsMock(rawText: string): ExtractedField[] {
  const fields: ExtractedField[] = [];
  const lines = rawText.split("\n");

  function findMatch(
    pattern: RegExp,
    key: string,
    label: string,
    highConfidence: boolean = true
  ): void {
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(pattern);
      if (match) {
        const value = match[1]?.trim() ?? match[0].trim();
        fields.push({
          key,
          label,
          value,
          confidence: highConfidence ? 0.92 : 0.65,
          sourceSnippet: lines[i].trim(),
          sourceRef: `Line ${i + 1}`,
          isConfirmed: false,
          userOverrideValue: null,
        });
        return;
      }
    }
  }

  // Material
  findMatch(/material[:\s]+(.+)/i, "material", "Material", true);
  if (!fields.find((f) => f.key === "material")) {
    const materialKeywords = /\b(aluminum|steel|stainless|titanium|brass|copper|6061|7075|304|316|A36)\b/i;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(materialKeywords);
      if (match) {
        fields.push({
          key: "material",
          label: "Material",
          value: match[1],
          confidence: 0.72,
          sourceSnippet: lines[i].trim(),
          sourceRef: `Line ${i + 1}`,
          isConfirmed: false,
          userOverrideValue: null,
        });
        break;
      }
    }
  }

  // Quantity
  findMatch(/(?:quantity|qty|units)[:\s]*(\d[\d,]*)/i, "quantity", "Quantity", true);
  if (!fields.find((f) => f.key === "quantity")) {
    findMatch(/(\d{2,})\s*(?:pcs|pieces|parts|units|ea)/i, "quantity", "Quantity", false);
  }

  // Tolerance
  findMatch(/tolerance[:\s]*([^\n,]+)/i, "tolerance", "Tolerance", true);
  if (!fields.find((f) => f.key === "tolerance")) {
    findMatch(/(±\s*[\d.]+\s*(?:mm|in|"|thou)?)/i, "tolerance", "Tolerance", false);
  }

  // Finish / Surface
  findMatch(/(?:finish|surface)[:\s]*(.+)/i, "finish", "Surface Finish", true);

  // Due Date / Delivery
  findMatch(/(?:due\s*date|delivery|deadline|needed\s*by|ship\s*by)[:\s]*(.+)/i, "dueDate", "Due Date", true);
  if (!fields.find((f) => f.key === "dueDate")) {
    findMatch(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i, "dueDate", "Due Date", false);
  }

  // Part number
  findMatch(/(?:part\s*(?:no|number|#|num))[:\s]*(.+)/i, "partNumber", "Part Number", true);

  // Process / Method
  findMatch(/(?:process|method|machining)[:\s]*(.+)/i, "process", "Process", false);

  if (fields.length === 0) {
    fields.push({
      key: "material",
      label: "Material",
      value: "Not detected",
      confidence: 0.2,
      sourceSnippet: lines[0]?.trim() ?? "",
      sourceRef: "Line 1",
      isConfirmed: false,
      userOverrideValue: null,
    });
  }

  return fields;
}
