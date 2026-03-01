# ForgeSight AI — Implementation Plan

## Goal
Build a hackathon-winning Manufacturing Quoting Copilot MVP with 4 screens, deterministic pricing, explainability, and a golden-path demo completable in under 3 minutes.

---

## File Structure

```
forgesight-ai/
├── app/
│   ├── layout.tsx                    # Root layout with sidebar
│   ├── page.tsx                      # Redirect to /inbox
│   ├── globals.css                   # Tailwind + shadcn styles
│   ├── inbox/
│   │   └── page.tsx                  # Screen A: RFQ Inbox
│   ├── rfq/
│   │   └── [id]/
│   │       ├── page.tsx              # Screen B: RFQ Review
│   │       ├── quote/
│   │       │   └── page.tsx          # Screen C: Quote Builder
│   │       └── send/
│   │           └── page.tsx          # Screen D: Send + Audit
│   └── api/
│       └── rfqs/
│           ├── route.ts              # GET /api/rfqs, POST /api/rfqs
│           └── [id]/
│               ├── route.ts          # GET /api/rfqs/[id]
│               ├── extract/
│               │   └── route.ts      # POST /api/rfqs/[id]/extract
│               ├── quote/
│               │   └── route.ts      # POST /api/rfqs/[id]/quote
│               └── send/
│                   └── route.ts      # POST /api/rfqs/[id]/send
├── src/
│   ├── core/
│   │   ├── pricing.ts               # Deterministic pricing engine (pure function)
│   │   ├── pricing.test.ts           # Unit tests for pricing
│   │   ├── extractor.ts             # Stub extractor (+ AI bridge if key exists)
│   │   ├── types.ts                 # All TypeScript types/interfaces
│   │   ├── store.ts                 # In-memory data store (Map-based)
│   │   └── seed.ts                  # Seed data definitions
│   ├── components/
│   │   ├── sidebar.tsx              # App sidebar navigation
│   │   ├── rfq-table.tsx            # Inbox table component
│   │   ├── status-badge.tsx         # Status badge with colors
│   │   ├── confidence-badge.tsx     # Confidence indicator (high/med/low)
│   │   ├── field-row.tsx            # Extracted field row with confirm/edit
│   │   ├── document-viewer.tsx      # Raw text viewer with highlights
│   │   ├── quote-card.tsx           # Cost component card with Why accordion
│   │   ├── shop-config-sheet.tsx    # Editable shop rates side panel
│   │   ├── email-draft.tsx          # Email draft form
│   │   ├── pdf-preview.tsx          # Simplified PDF preview
│   │   ├── audit-timeline.tsx       # Audit event timeline
│   │   ├── new-rfq-dialog.tsx       # Dialog for creating new RFQ
│   │   └── ui/                      # shadcn/ui generated components
│   └── lib/
│       └── utils.ts                 # shadcn utility (cn function)
├── scripts/
│   └── seed.ts                      # Seed script (runs via tsx)
├── docs/
│   ├── spec.md                      # Product specification
│   ├── implementation_plan.md       # This file
│   └── screenshots/                 # Demo screenshots
├── README.md
├── AGENTS.md
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── components.json                  # shadcn config
```

---

## Proposed Changes

### 1. Project Scaffolding

#### [NEW] Next.js project
- Init with `npx -y create-next-app@latest ./ --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-pnpm`
- Init shadcn: `pnpm dlx shadcn@latest init`
- Add components: `pnpm dlx shadcn@latest add button input textarea label card table badge tabs dialog sheet dropdown-menu tooltip separator scroll-area skeleton accordion alert sonner`
- Install extras: `pnpm add react-hook-form @hookform/resolvers zod lucide-react uuid`
- Install dev: `pnpm add -D @types/uuid vitest`

---

### 2. Core Logic (`src/core/`)

#### [NEW] `types.ts`
- All TypeScript interfaces: `RFQ`, `ExtractedField`, `Quote`, `QuoteLineItem`, `AuditEvent`
- Enums: `RFQStatus`, `LineItemType`, `AuditAction`, `Actor`
- Type for `ShopConfig` (rates, overhead%, margin%)
- Type for `PricingInputs`

#### [NEW] `store.ts`
- In-memory `Map<string, RFQ>` singleton
- CRUD helpers: `getAllRfqs()`, `getRfq(id)`, `createRfq(data)`, `updateRfq(id, patch)`
- Auto-seeds on first access if empty

#### [NEW] `pricing.ts`
- `computeQuote(inputs: PricingInputs, config: ShopConfig): Quote`
- Pure deterministic function
- Returns typed line items with `formula`, `inputs` record, `amount`, and `why` string
- Edge case handling: missing values default to 0, negative values clamped to 0

#### [NEW] `pricing.test.ts`
- Happy path: standard inputs → correct totals
- Zero quantity → zero material cost
- Missing values (undefined/null) → treated as 0
- Negative rates → clamped to 0
- Large values → no overflow
- Margin and overhead % calculations

#### [NEW] `extractor.ts`
- `extractFields(rawText: string): ExtractedField[]`
- Stub mode (default): regex + keyword matching to extract plausible fields
- Returns confidence scores: high (>0.85) for obvious matches, medium (0.5–0.85) for fuzzy, low (<0.5) for guesses
- Always includes `sourceSnippet` and `sourceRef`

#### [NEW] `seed.ts`
- 3 RFQs:
  1. Simple: single CNC part, clear specs → mostly high confidence
  2. Medium: multi-part assembly, some ambiguity → mixed confidence
  3. Complex: tight tolerances, missing info → low confidence fields

---

### 3. API Routes (`app/api/`)

#### [NEW] `rfqs/route.ts`
- `GET`: return all RFQs (sorted by createdAt desc)
- `POST`: create RFQ from `{ customerName, subject, rawText }`, set status NEW, append audit

#### [NEW] `rfqs/[id]/route.ts`
- `GET`: return single RFQ by ID

#### [NEW] `rfqs/[id]/extract/route.ts`
- `POST`: run extractor on rawText, store extractedFields, set status NEEDS_REVIEW, append audit

#### [NEW] `rfqs/[id]/quote/route.ts`
- `POST`: read confirmed/overridden fields, map to PricingInputs, call `computeQuote`, store quote, append audit

#### [NEW] `rfqs/[id]/send/route.ts`
- `POST`: accept email draft, simulate send, set status SENT, append audit with email + PDF data

---

### 4. UI Components (`src/components/`)

#### [NEW] `sidebar.tsx`
- Vertical nav: Inbox, Settings (placeholder), Audit
- Active state highlighting, lucide icons
- App logo/name at top

#### [NEW] `status-badge.tsx`
- Color-coded badges: NEW (blue), EXTRACTED (purple), NEEDS_REVIEW (amber), READY_TO_SEND (green), SENT (gray)

#### [NEW] `confidence-badge.tsx`
- High (≥0.85): green with checkmark
- Medium (0.5–0.85): amber with alert
- Low (<0.5): red with warning — requires review

#### [NEW] `field-row.tsx`
- Displays: label, value (editable), confidence badge, source link, confirm toggle
- Source link scrolls to snippet in document viewer
- Edit mode: inline text input, saves override, appends audit

#### [NEW] `document-viewer.tsx`
- Renders raw text with highlighted snippets (mark tags)
- Scroll-to function for source links

#### [NEW] `quote-card.tsx`
- Card with line item type icon, label, amount
- "Why?" accordion showing formula, inputs table, explanation text

#### [NEW] `shop-config-sheet.tsx`
- Sheet (slide-out panel) with editable rates
- Form: setup rate, labor rate, machine rate, overhead%, margin%
- Defaults from shop config, saves to state

#### [NEW] `audit-timeline.tsx`
- Vertical timeline of AuditEvents
- Icon per action type, timestamp, actor badge, detail text

---

### 5. Screens (Pages)

#### [NEW] Screen A: `app/inbox/page.tsx`
- Fetch all RFQs via API
- Render in table: customer, subject, status badge, date
- Search input filters by customer/subject
- "New RFQ" button opens dialog
- Row click → router.push to `/rfq/[id]`

#### [NEW] Screen B: `app/rfq/[id]/page.tsx`
- Fetch RFQ by ID
- Two-column: DocumentViewer (left) + Fields panel (right)
- Auto-extract if status is NEW (call extract API)
- Banner: "X of Y fields need review"
- "Generate Quote" button disabled until all required confirmed
- On generate → call quote API → navigate to `/rfq/[id]/quote`

#### [NEW] Screen C: `app/rfq/[id]/quote/page.tsx`
- Fetch RFQ (must have quote)
- Grid of QuoteCards for each line item
- Totals summary card
- Shop config button → opens ShopConfigSheet
- "Ready to Send" → navigate to `/rfq/[id]/send`

#### [NEW] Screen D: `app/rfq/[id]/send/page.tsx`
- Email draft form (pre-filled from RFQ data)
- PDF preview panel (text-based quote summary)
- "Send Quote" button → call send API → toast + status update
- Audit timeline below

---

### 6. Documentation

#### [NEW] `README.md`
- What: Manufacturing Quoting Copilot
- Why: Time savings, explainability, audit trail
- Quick start: 3 commands to run
- Screenshots
- Architecture overview

#### [NEW] `AGENTS.md`
- Single-command setup: `pnpm install && pnpm dev`
- Test command: `pnpm test`
- File locations: core logic, UI, API routes
- Architecture boundaries

---

## Verification Plan

### Automated Tests

**Pricing Engine Unit Tests** (`src/core/pricing.test.ts` — run with `pnpm vitest run`):

1. **Happy path**: Standard inputs (qty=100, materialCost=2.50, setupHours=2, etc.) → verify each line item amount and total
2. **Zero quantity**: qty=0 → material cost = 0, other costs still computed
3. **Missing values**: undefined inputs → treated as 0, no NaN
4. **Negative rates**: negative laborRate → clamped to 0
5. **Zero margin**: marginPct=0 → margin line item is $0, total = subtotal + overhead
6. **100% margin**: marginPct=1.0 → margin = subtotal + overhead
7. **Overhead calculation**: overhead applies to subtotal only

Run: `cd C:\Users\carte\.gemini\antigravity\scratch\forgesight-ai && pnpm vitest run`

### Manual Demo Verification (Golden Path — <3 minutes)

1. **Start the app**: `pnpm dev` → opens at `http://localhost:3000`
2. **Inbox loads**: See 3 seeded RFQs with status badges in table
3. **Click first RFQ**: Navigate to Review screen
4. **Verify extraction**: Fields shown with confidence badges and source snippets
5. **Confirm fields**: Toggle confirm on any low-confidence fields
6. **Generate Quote**: Button becomes enabled → click → navigates to Quote Builder
7. **Check Why?**: Expand accordion on any line item → formula and inputs shown
8. **Ready to Send**: Click → navigates to Send screen
9. **Send Quote**: Fill/edit email → click Send → toast appears → status shows SENT
10. **Check Audit**: Scroll down → see all events in timeline

> [!IMPORTANT]
> The manual demo is the primary judging criteria. All 10 steps must work smoothly.
