# ForgeSight AI — Product Specification

## Vision
ForgeSight AI is a **Manufacturing Quoting Copilot** that transforms manual RFQ (Request for Quote) processing into a guided, explainable workflow. It extracts structured data from raw RFQ text, computes deterministic pricing, and produces auditable quotes — all with full transparency into how every number was derived.

## Why It Matters
- **80% of small manufacturers** still process quotes in spreadsheets, losing 4–8 hours per quote.
- ForgeSight reduces quoting to **under 15 minutes** with AI-assisted extraction + deterministic math.
- Every output is **explainable**: source snippets, confidence scores, and "Why?" breakdowns prevent black-box pricing errors.

---

## Core Workflow (Golden Path)

```
1. Upload/paste RFQ → NEW
2. Extract fields (AI or stub) → EXTRACTED → NEEDS_REVIEW
3. Confirm/override low-confidence fields → READY (all confirmed)
4. Generate deterministic quote → Quote Builder
5. Draft email + PDF preview → Send
6. Simulate send → SENT + Audit log entry
```

---

## Data Model

### RFQ
| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Unique identifier |
| createdAt | ISO datetime | Creation timestamp |
| customerName | string | Customer/company name |
| subject | string | RFQ subject line |
| status | enum | NEW, EXTRACTED, NEEDS_REVIEW, READY_TO_SEND, SENT |
| rawText | string | Full RFQ text content |
| extractedFields | ExtractedField[] | AI/stub-extracted fields |
| quote | Quote | null | Generated quote |
| audit | AuditEvent[] | Immutable audit trail |

### ExtractedField
| Field | Type | Description |
|-------|------|-------------|
| key | string | Field identifier (material, quantity, etc.) |
| label | string | Human-readable label |
| value | string | Extracted value |
| confidence | number (0–1) | Extraction confidence |
| sourceSnippet | string | Source text evidence |
| sourceRef | string | Page/line reference |
| isConfirmed | boolean | User confirmed? |
| userOverrideValue | string | null | Override if changed |

### Quote
| Field | Type | Description |
|-------|------|-------------|
| lineItems | QuoteLineItem[] | Cost breakdown |
| totals | object | subtotal, marginPct, marginAmount, total |
| assumptions | string[] | Stated assumptions |

### QuoteLineItem
| Field | Type | Description |
|-------|------|-------------|
| type | enum | MATERIAL, SETUP, RUN_TIME, LABOR, OVERHEAD, MARGIN |
| label | string | Display name |
| formula | string | Human-readable formula |
| inputs | Record<string, number> | Named inputs |
| amount | number | Computed dollar amount |
| why | string | Plain-English explanation |

### AuditEvent
| Field | Type | Description |
|-------|------|-------------|
| at | ISO datetime | Event timestamp |
| actor | enum | SYSTEM, USER |
| action | string | Event type (constants) |
| detail | string | JSON or human-readable |

---

## Screens

### A) RFQ Inbox
- Sidebar: Inbox (active), Settings, Audit
- Searchable/filterable table: customer, subject, status badge, last updated
- "New RFQ" CTA → dialog to paste/type RFQ text
- Row click → navigates to RFQ Review

### B) RFQ Review
- Two-column layout:
  - **Left**: Document panel — raw text with highlighted source snippets
  - **Right**: Extracted fields table — value, confidence badge, source link, confirm toggle, inline edit
- Banner: "X fields need review" (yellow for >0, green for all confirmed)
- CTA: "Generate Quote" — disabled until all required fields are confirmed

### C) Quote Builder
- Cost breakdown cards: Material, Setup, Run Time, Labor, Overhead, Margin
- Each card: amount + "Why?" accordion → formula, inputs, explanation
- Side panel (Sheet): editable shop config (rates, overhead%, margin%)
- CTA: "Ready to Send" → navigates to Send screen

### D) Send + Audit
- Email draft: editable To, Subject, Body (pre-filled)
- PDF preview panel (simplified text-based render)
- "Send Quote" CTA → simulated send + toast + status → SENT
- Audit log timeline below: every event with timestamp, actor, action

---

## Deterministic Pricing Engine
- **Pure function**: `computeQuote(inputs, shopConfig) → Quote`
- **No LLM/AI math**. Ever.
- Line items computed from explicit formulas:
  - Material: `quantity × materialCostPerUnit × materialQty`
  - Setup: `setupHours × setupRate`
  - Run Time: `machineHours × machineRate`
  - Labor: `laborHours × laborRate`
  - Overhead: `subtotal × overheadPct`
  - Margin: `(subtotal + overhead) × marginPct`

---

## Demo Mode
- **No external API keys required** for basic usage
- Stub extractor returns plausible fields with varying confidence scores
- 3 seed RFQs with varying complexity (simple part, multi-part assembly, tight-tolerance)

---

## Tech Stack
| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Components | shadcn/ui (CLI-installed) |
| Icons | lucide-react |
| Forms | react-hook-form + zod |
| Persistence | In-memory store (Map-based, server-side) |
| PDF | Text-based preview (simplified) |

---

## Acceptance Criteria
1. Create RFQ → appears in Inbox as NEW
2. Extract → fields show confidence + source snippets
3. Confirm low-confidence fields → "Generate Quote" enables
4. Generate Quote → deterministic breakdown with "Why?" for each line
5. Send → status SENT + audit log updated + email draft shown
6. All completable in <3 minutes demo
