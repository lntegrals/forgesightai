import { NextRequest, NextResponse } from "next/server";
import { getRfq, updateRfq, appendAudit } from "@/core/store";
import { generateClarifier } from "@/core/clarifier";
import { Actor, AuditAction } from "@/core/types";
import type { ClarifierOutput, ExtractedField } from "@/core/types";

// ── Rule-based clarifier fallback (no Gemini required) ────────────────────────
// Generates targeted questions and assumptions based on extracted fields.

function buildLocalClarifier(rawText: string, fields: ExtractedField[]): ClarifierOutput {
  const fv = (key: string) => {
    const f = fields.find((f) => f.key === key);
    return f ? (f.userOverrideValue ?? f.value) : null;
  };

  const material = fv("material") ?? "";
  const finish = fv("finish") ?? "";
  const threads = fv("threads") ?? "";
  const certifications = fv("certifications") ?? "";
  const tolerance = fv("tolerance") ?? "";
  const deliveryLeadTime = fv("deliveryLeadTime") ?? "";
  const qty = fv("quantity") ?? "";
  const process = fv("process") ?? "";
  const partNumber = fv("partNumber") ?? "";

  const questions: ClarifierOutput["questions"] = [];
  const assumptions: ClarifierOutput["assumptions"] = [];
  const riskFlags: ClarifierOutput["riskFlags"] = [];

  let qIdx = 1, aIdx = 1, rIdx = 1;
  const qId = () => `q${qIdx++}`;
  const aId = () => `a${aIdx++}`;
  const rId = () => `r${rIdx++}`;

  // ── Thread class / fit ────────────────────────────────────────────────────
  if (threads && !/6h|6g|2a|2b|3a|3b|class/i.test(threads)) {
    questions.push({
      id: qId(),
      question: `The threads are specified as "${threads}" — what thread fit class is required (e.g. 6H/6g for metric, 2A/2B for UNC)?`,
      options: ["6H/6g (standard metric)", "4H/6g (close metric)", "2A/2B (standard unified)", "3A/3B (close unified)"],
      required: true,
      rationale: "Thread class affects tool selection, cycle time, and whether grinding is required.",
      confidence: 0.9,
    });
  }

  // ── Inspection / first article ────────────────────────────────────────────
  if (tolerance && /0\.0[0-2][0-9]/i.test(tolerance)) {
    questions.push({
      id: qId(),
      question: `With tolerances at ${tolerance}, what inspection level is required — CMM per unit, first-article only, or SPC sampling?`,
      options: ["First article inspection (FAI) only", "CMM on every unit", "Statistical sampling (SPC)", "Certificate of conformance only"],
      required: true,
      rationale: "Tight tolerance inspection requirement significantly impacts per-unit cost and lead time.",
      confidence: 0.95,
    });
  }

  // ── Certification package ────────────────────────────────────────────────
  if (/titanium|inconel|nickel|aerospace|medical|implant|astm f136|as9100/i.test(material + certifications + rawText.slice(0, 300))) {
    if (!certifications || certifications.length < 5) {
      questions.push({
        id: qId(),
        question: `What certification package is required for this job? (e.g. material traceability certs, CoC, AS9100D, DFARS compliance, ITAR)`,
        options: ["Material cert + CoC only", "AS9100D full traceability", "DFARS-compliant + traceability", "ITAR-controlled + full package"],
        required: true,
        rationale: "Certification requirements affect material sourcing, documentation overhead, and pricing.",
        confidence: 0.85,
      });
    }
  }

  // ── Anodize / finish details ──────────────────────────────────────────────
  if (/anodize|anodized|anodising/i.test(finish)) {
    if (!/color|colour|black|clear|natural|class 2|class 1/i.test(finish)) {
      questions.push({
        id: qId(),
        question: `Anodize finish is specified — what color and class are needed (e.g. Type II clear, Type III black hard coat)? Are rack marks acceptable?`,
        options: ["Type II clear (Class 1)", "Type II black (Class 2)", "Type III hard anodize clear", "Type III hard anodize black"],
        required: false,
        rationale: "Color and class affect anodize vendor selection and masking requirements.",
        confidence: 0.75,
      });
    }
  }

  // ── Delivery terms ────────────────────────────────────────────────────────
  if (!deliveryLeadTime || deliveryLeadTime.length < 3) {
    questions.push({
      id: qId(),
      question: `No delivery lead time is specified in the RFQ. What is the required delivery date or ARO lead time? Are partial shipments acceptable?`,
      options: ["4 weeks ARO", "6 weeks ARO", "8 weeks ARO", "Hard ship date (specify in notes)"],
      required: true,
      rationale: "Lead time determines whether expedite fees, overtime, or subcontractor sourcing are needed.",
      confidence: 0.9,
    });
  }

  // ── Quantity break / prototype vs production ──────────────────────────────
  const qtyNum = parseInt(qty.replace(/[^0-9]/g, "") || "0", 10);
  if (qtyNum > 0 && qtyNum <= 25) {
    questions.push({
      id: qId(),
      question: `Quantity is ${qty} — is this a prototype run, or are follow-on production quantities expected? A blanket order would significantly reduce per-unit cost.`,
      options: ["Prototype only", "Prototype + production PO to follow", "Recurring blanket order", "One-time order only"],
      required: false,
      rationale: "Blanket order potential affects tooling amortization and pricing strategy.",
      confidence: 0.7,
    });
  }

  // ── Assumptions ──────────────────────────────────────────────────────────
  if (material) {
    assumptions.push({
      id: aId(),
      assumption: `Material is ${material} per standard commercial specification unless customer-furnished material (CFM) is indicated.`,
      appliesToKeys: ["material"],
      confidence: 0.9,
    });
  }

  if (process) {
    assumptions.push({
      id: aId(),
      assumption: `Primary process is ${process}. Quoting from billet/bar stock unless drawing indicates near-net forging or casting.`,
      appliesToKeys: ["process"],
      confidence: 0.85,
    });
  }

  if (partNumber) {
    assumptions.push({
      id: aId(),
      assumption: `Quoting to ${partNumber} revision as submitted. Any future ECO/revision changes will require requote.`,
      appliesToKeys: ["partNumber"],
      confidence: 0.95,
    });
  }

  // ── Risk flags ────────────────────────────────────────────────────────────
  if (/titanium|ti-6|ti6|astm f136/i.test(material)) {
    riskFlags.push({
      id: rId(),
      label: "Titanium machining — extended cycle time risk",
      severity: "high",
      evidenceSnippet: material,
    });
  }

  if (tolerance && /0\.0[01][0-9]/i.test(tolerance)) {
    riskFlags.push({
      id: rId(),
      label: `Tight tolerance ${tolerance} — grinding or EDM may be required`,
      severity: "high",
      evidenceSnippet: tolerance,
    });
  }

  if (/implant|medical|class iii|astm f/i.test(rawText.slice(0, 500))) {
    riskFlags.push({
      id: rId(),
      label: "Medical/implant-grade part — FDA traceability and biocompatibility documentation required",
      severity: "high",
      evidenceSnippet: rawText.slice(0, 100),
    });
  }

  if (!deliveryLeadTime) {
    riskFlags.push({
      id: rId(),
      label: "No delivery date specified — schedule risk if customer has undisclosed deadline",
      severity: "med",
      evidenceSnippet: "No delivery lead time found in RFQ",
    });
  }

  return {
    questions,
    assumptions,
    riskFlags,
    generatedAt: new Date().toISOString(),
    engine: "rules",
    model: "local-rules-v1",
    promptVersion: "local-clarifier-v1",
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rfq = getRfq(id);
  if (!rfq) {
    return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
  }

  if (rfq.extractedFields.length === 0) {
    return NextResponse.json(
      { error: "Run extraction first before generating clarifying questions" },
      { status: 400 }
    );
  }

  // Try Gemini first; fall through to local rules on any failure
  if (process.env.GEMINI_API_KEY) {
    const result = await generateClarifier({
      rawText: rfq.rawText,
      cleaning: rfq.cleaning,
      extractedFields: rfq.extractedFields,
    });

    if (result.ok) {
      updateRfq(id, { clarifier: result.clarifier });
      appendAudit(id, {
        at: new Date().toISOString(),
        actor: Actor.SYSTEM,
        action: AuditAction.FIELDS_EXTRACTED,
        detail: `Clarifier generated (Gemini): ${result.clarifier.questions.length} questions, ${result.clarifier.assumptions.length} assumptions, ${result.clarifier.riskFlags.length} risk flags`,
      });
      return NextResponse.json(getRfq(id));
    }

    // Log the Gemini error but continue to local fallback
    console.warn("[clarify] Gemini failed, using local rules:", result.error);
  }

  // Local rule-based clarifier — always works, no API required
  const clarifier = buildLocalClarifier(rfq.rawText, rfq.extractedFields);

  updateRfq(id, { clarifier });
  appendAudit(id, {
    at: new Date().toISOString(),
    actor: Actor.SYSTEM,
    action: AuditAction.FIELDS_EXTRACTED,
    detail: `Clarifier generated (local rules): ${clarifier.questions.length} questions, ${clarifier.assumptions.length} assumptions, ${clarifier.riskFlags.length} risk flags`,
  });

  return NextResponse.json(getRfq(id));
}
