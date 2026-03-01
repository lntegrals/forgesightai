/**
 * POST /api/rfqs/ingest
 *
 * Accepts a multipart/form-data with:
 *   - file: .txt or .pdf file
 *   - customerName (optional): override
 *   - subject (optional): override
 *
 * Creates an RFQ, auto-extracts fields, and returns the created RFQ.
 */
import { NextRequest, NextResponse } from "next/server";
import { createRfq, updateRfq, appendAudit } from "@/core/store";
import { extractFields } from "@/core/extractor";
import { Actor, AuditAction, ExtractorMode, RFQStatus } from "@/core/types";

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided (field: 'file')" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext !== "txt" && ext !== "pdf") {
    return NextResponse.json({ error: "Unsupported file type — use .txt or .pdf" }, { status: 400 });
  }

  // Extract text content
  let rawText: string;
  if (ext === "txt") {
    rawText = await file.text();
  } else {
    // Simple PDF text extraction: pull text objects from PDF content stream
    const buffer = Buffer.from(await file.arrayBuffer());
    rawText = extractTextFromPdf(buffer);
  }

  if (!rawText.trim()) {
    return NextResponse.json({ error: "File appears to be empty or unreadable" }, { status: 400 });
  }

  const customerName = (formData.get("customerName") as string | null) || deriveCustomerName(rawText, file.name);
  const subject = (formData.get("subject") as string | null) || deriveSubject(rawText, file.name);

  // Create RFQ
  const rfq = createRfq({
    customerName,
    subject,
    rawText,
    sourceType: "file",
    attachmentName: file.name,
  });

  // Auto-extract fields
  const mode = process.env.ANTHROPIC_API_KEY ? ExtractorMode.LLM : ExtractorMode.MOCK;
  const fields = await extractFields(rawText, mode);

  updateRfq(rfq.id, {
    extractedFields: fields,
    status: RFQStatus.NEEDS_REVIEW,
  });

  appendAudit(rfq.id, {
    at: new Date().toISOString(),
    actor: Actor.SYSTEM,
    action: AuditAction.FILE_INGESTED,
    detail: `Ingested file "${file.name}" (${file.size} bytes); extracted ${fields.length} fields`,
  });

  // Return the updated RFQ
  const { getRfq } = await import("@/core/store");
  return NextResponse.json(getRfq(rfq.id), { status: 201 });
}

/** Naive PDF text extraction without native deps. */
function extractTextFromPdf(buffer: Buffer): string {
  const raw = buffer.toString("latin1");

  // Pull content between BT/ET (text blocks) — standard PDF operators
  const textBlocks = raw.match(/BT[\s\S]*?ET/g) ?? [];
  const lines: string[] = [];

  for (const block of textBlocks) {
    // Tj operator: (text) Tj
    const tjMatches = block.match(/\(([^)]*)\)\s*Tj/g) ?? [];
    for (const match of tjMatches) {
      const content = match.match(/\(([^)]*)\)/)?.[1] ?? "";
      if (content.trim()) lines.push(content.trim());
    }
    // TJ operator: [(text)] TJ
    const tjArrayMatches = block.match(/\[([^\]]*)\]\s*TJ/g) ?? [];
    for (const match of tjArrayMatches) {
      const parts = match.match(/\(([^)]*)\)/g) ?? [];
      const text = parts.map((p) => p.slice(1, -1)).join("").trim();
      if (text) lines.push(text);
    }
  }

  if (lines.length > 0) return lines.join("\n");

  // Fallback: strip binary and return printable chars
  return raw
    .replace(/[^\x20-\x7E\n\r\t]/g, " ")
    .replace(/\s{3,}/g, "\n")
    .slice(0, 8000);
}

function deriveCustomerName(rawText: string, filename: string): string {
  const patterns = [
    /from:\s*([^\n,]+)/i,
    /customer:\s*([^\n]+)/i,
    /company:\s*([^\n]+)/i,
  ];
  for (const p of patterns) {
    const m = rawText.match(p);
    if (m?.[1]?.trim()) return m[1].trim().split(",")[0].trim();
  }
  return filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
}

function deriveSubject(rawText: string, filename: string): string {
  const patterns = [
    /subject:\s*([^\n]+)/i,
    /re:\s*([^\n]+)/i,
    /rfq[:\s]+([^\n]+)/i,
  ];
  for (const p of patterns) {
    const m = rawText.match(p);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  // Use first meaningful line
  const firstLine = rawText.split("\n").find((l) => l.trim().length > 10);
  return firstLine?.trim().slice(0, 80) || `Uploaded from ${filename}`;
}
