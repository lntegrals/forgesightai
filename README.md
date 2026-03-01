# ForgeSight AI — Manufacturing Quoting Copilot

> AI-assisted RFQ processing with deterministic pricing and full explainability.

## What It Is

ForgeSight AI transforms manual RFQ (Request for Quote) processing into a guided, explainable workflow. It extracts structured data from raw RFQ text, computes deterministic pricing, and produces auditable quotes — all with full transparency into how every number was derived.

## Why It Matters

- **80% of small manufacturers** still process quotes in spreadsheets, losing 4–8 hours per quote.
- ForgeSight reduces quoting to **under 15 minutes** with AI-assisted extraction + deterministic math.
- Every output is **explainable**: source snippets, confidence scores, and "Why?" breakdowns prevent black-box pricing errors.

## Quick Start (3 minutes)

```bash
# Install dependencies
pnpm install

# Start the dev server
pnpm dev

# Open http://localhost:3000
```

The app auto-seeds with 3 demo RFQs. No API keys needed.

## Demo Walkthrough

1. **Inbox** — See 3 seeded RFQs with status badges. Search or create new ones.
2. **Click any RFQ** → Fields are shown with confidence badges and source snippets.
3. **Confirm fields** — Toggle confirm on low-confidence fields (amber/red badges).
4. **Generate Quote** — Button enables once all fields are confirmed.
5. **Quote Builder** — See cost breakdown with "Why?" accordions. Adjust shop rates.
6. **Send** — Edit email draft, preview PDF, click "Send Quote" → audit log updates.

## Architecture

```
src/
├── core/               # Business logic (zero UI dependencies)
│   ├── types.ts        # All TypeScript interfaces/enums
│   ├── pricing.ts      # Deterministic pricing engine (pure function)
│   ├── extractor.ts    # Stub field extractor (regex-based)
│   ├── store.ts        # In-memory data store
│   └── seed.ts         # 3 demo RFQs
├── components/         # Reusable UI components
│   ├── ui/             # shadcn/ui primitives
│   └── *.tsx           # App-specific components
└── app/
    ├── inbox/          # Screen A: RFQ Inbox
    ├── rfq/[id]/       # Screen B: RFQ Review
    ├── rfq/[id]/quote/ # Screen C: Quote Builder
    ├── rfq/[id]/send/  # Screen D: Send + Audit
    └── api/rfqs/       # REST API routes
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (CLI-installed) |
| Icons | lucide-react |
| Forms | react-hook-form + zod |
| Persistence | In-memory store (auto-seeds) |
| Testing | Vitest |

## Testing

```bash
# Run unit tests
pnpm vitest run
```

10 tests covering the deterministic pricing engine (happy path, edge cases, explainability).

## Key Design Principles

- **AI never computes prices** — deterministic TypeScript functions only
- **Every output is explainable** — source snippets, confidence scores, "Why?" panels
- **Knowledge limits** — low-confidence fields require explicit confirmation
- **Immutable audit trail** — every action logged with timestamp and actor
