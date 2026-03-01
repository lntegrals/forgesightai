// ── Enums ──────────────────────────────────────────────────────────────────

export enum RFQStatus {
  NEW = "NEW",
  EXTRACTED = "EXTRACTED",
  NEEDS_REVIEW = "NEEDS_REVIEW",
  READY_TO_SEND = "READY_TO_SEND",
  SENT = "SENT",
}

export enum LineItemType {
  MATERIAL = "MATERIAL",
  SETUP = "SETUP",
  RUN_TIME = "RUN_TIME",
  LABOR = "LABOR",
  OVERHEAD = "OVERHEAD",
  MARGIN = "MARGIN",
}

export enum AuditAction {
  RFQ_CREATED = "RFQ_CREATED",
  FIELDS_EXTRACTED = "FIELDS_EXTRACTED",
  FIELD_CONFIRMED = "FIELD_CONFIRMED",
  FIELD_OVERRIDDEN = "FIELD_OVERRIDDEN",
  FIELD_RESET = "FIELD_RESET",
  QUOTE_GENERATED = "QUOTE_GENERATED",
  EMAIL_SENT = "EMAIL_SENT",
  ACTUALS_RECORDED = "ACTUALS_RECORDED",
  WEBHOOK_INGESTED = "WEBHOOK_INGESTED",
  FILE_INGESTED = "FILE_INGESTED",
}

export enum Actor {
  SYSTEM = "SYSTEM",
  USER = "USER",
}

export enum ExtractorMode {
  MOCK = "MOCK",
  LLM = "LLM",
}

export type ExtractionEngine = "gemini" | "mock";

export interface ExtractionMeta {
  engine: ExtractionEngine;
  model?: string;
  promptVersion: string;
  extractedAt: string;   // ISO
  cleanedAt?: string;    // ISO
}

export interface RfqCleaning {
  cleanedText: string;
  removedSections: string[];
  normalizationNotes: string[];
  confidence: number;    // 0..1
}

export interface ClarifierOutput {
  questions: Array<{
    id: string;
    question: string;
    options?: string[];
    required: boolean;
    rationale: string;
    confidence: number;
  }>;
  assumptions: Array<{
    id: string;
    assumption: string;
    appliesToKeys: string[];
    confidence: number;
  }>;
  riskFlags: Array<{
    id: string;
    label: string;
    severity: "low" | "med" | "high";
    evidenceSnippet: string;
  }>;
  generatedAt: string;   // ISO
  engine: ExtractionEngine;
  model?: string;
  promptVersion: string;
}

// ── Interfaces ─────────────────────────────────────────────────────────────

export interface ExtractedField {
  key: string;
  label: string;
  value: string;
  confidence: number; // 0..1
  sourceSnippet: string;
  sourceRef: string;
  isConfirmed: boolean;
  userOverrideValue: string | null;
}

export interface QuoteLineItem {
  type: LineItemType;
  label: string;
  formula: string;
  inputs: Record<string, number>;
  amount: number;
  why: string;
}

export interface QuoteTotals {
  subtotal: number;
  overheadAmount: number;
  overheadPct: number;  // actual rate used, 0..1 — use this for display
  marginPct: number;
  marginAmount: number;
  total: number;
}

export interface Quote {
  lineItems: QuoteLineItem[];
  totals: QuoteTotals;
  assumptions: string[];
}

export interface AuditEvent {
  at: string; // ISO datetime
  actor: Actor;
  action: AuditAction;
  detail: string;
}

// ── Actuals + Variance ──────────────────────────────────────────────────────

export interface Actuals {
  materialCost: number;    // actual total material cost (dollars)
  setupHours: number;
  laborHours: number;
  machineHours: number;
  notes?: string;
  recordedAt: string;      // ISO datetime
}

export interface VarianceLine {
  label: string;
  type: LineItemType;
  estimate: number;
  actual: number;
  delta: number;           // actual - estimate (positive = over budget)
  deltaPct: number;        // delta / estimate * 100
}

export interface VarianceReport {
  lines: VarianceLine[];
  estimateTotal: number;
  actualTotal: number;
  totalDelta: number;
  totalDeltaPct: number;
  estimateMarginPct: number;
  actualMarginPct: number;
  marginDelta: number;
}

// ── RFQ ────────────────────────────────────────────────────────────────────

export interface RFQ {
  id: string;
  createdAt: string;           // ISO datetime
  customerName: string;
  subject: string;
  status: RFQStatus;
  rawText: string;
  extractedFields: ExtractedField[];
  quote: Quote | null;
  audit: AuditEvent[];
  actuals?: Actuals;
  externalId?: string;          // for webhook deduplication
  sourceType?: "manual" | "file" | "webhook";
  attachmentName?: string;      // original filename if file-uploaded
  // ── Gemini AI features ──
  cleaning?: RfqCleaning;
  extractionMeta?: ExtractionMeta;
  clarifier?: ClarifierOutput;
  clarifierAnswers?: Record<string, string>;  // questionId -> answer
  confirmedAssumptions?: string[];            // assumption ids
}

// ── Pricing Inputs ─────────────────────────────────────────────────────────

export interface PricingInputs {
  quantity: number;
  materialCostPerUnit: number;
  materialQty: number;
  setupHours: number;
  laborHours: number;
  machineHours: number;
}

export interface ShopConfig {
  setupRate: number;    // $/hr
  laborRate: number;    // $/hr
  machineRate: number;  // $/hr
  overheadPct: number;  // 0..1
  marginPct: number;    // 0..1
}

export const DEFAULT_SHOP_CONFIG: ShopConfig = {
  setupRate: 85,
  laborRate: 65,
  machineRate: 120,
  overheadPct: 0.15,
  marginPct: 0.20,
};
