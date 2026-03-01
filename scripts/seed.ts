#!/usr/bin/env node

/**
 * Seed script — creates 3 demo RFQs.
 *
 * The app auto-seeds on first API access, so this script is provided
 * for documentation purposes and as a reference for the seed data.
 *
 * Usage: npx tsx scripts/seed.ts
 */

import { getSeedRFQs } from "../src/core/seed";

const rfqs = getSeedRFQs();

console.log("=== ForgeSight AI — Seed Data ===\n");
console.log(`Created ${rfqs.length} demo RFQs:\n`);

for (const rfq of rfqs) {
    console.log(`  [${rfq.status}] ${rfq.customerName}`);
    console.log(`    Subject: ${rfq.subject}`);
    console.log(`    Fields:  ${rfq.extractedFields.length} extracted`);
    console.log(`    ID:      ${rfq.id}`);
    console.log("");
}

console.log("✓ The app auto-seeds these RFQs on first API access.");
console.log("  Start the dev server with: pnpm dev");
