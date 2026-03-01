# AGENTS.md — ForgeSight AI

## Quick Setup

```bash
pnpm install && pnpm dev
```

Opens at http://localhost:3000. No API keys required.

## Test

```bash
pnpm vitest run
```

## File Locations

| What | Where |
|------|-------|
| Core business logic | `src/core/` |
| Pricing engine | `src/core/pricing.ts` |
| Field extractor (stub) | `src/core/extractor.ts` |
| Data types | `src/core/types.ts` |
| In-memory store | `src/core/store.ts` |
| Seed data | `src/core/seed.ts` |
| UI components | `src/components/` |
| shadcn/ui primitives | `src/components/ui/` |
| API routes | `src/app/api/rfqs/` |
| Page routes | `src/app/inbox/`, `src/app/rfq/[id]/` |
| Unit tests | `src/core/pricing.test.ts` |

## Architecture Boundaries

- **`src/core/`** — Pure business logic. No React imports. No UI dependencies. Testable in isolation.
- **`src/components/`** — Reusable UI components. Import from `src/core/types.ts` for type safety.
- **`src/app/api/`** — REST API routes. Thin wrappers that call core logic and return JSON.
- **`src/app/*/page.tsx`** — Page components. Fetch from API, render components.

## Key Rules

1. **AI NEVER computes prices** — `computeQuote()` in `pricing.ts` is the only source of truth.
2. **All fields must have evidence** — `sourceSnippet` and `sourceRef` are required on every `ExtractedField`.
3. **Low-confidence fields must be confirmed** — fields with `confidence < 0.85` require user confirmation before quote generation.
4. **Audit trail is append-only** — `AuditEvent[]` is never modified, only appended to.
