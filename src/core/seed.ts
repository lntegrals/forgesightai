import { v4 as uuidv4 } from "uuid";
import { AuditAction, Actor, RFQStatus, DEFAULT_SHOP_CONFIG, type RFQ, type AuditEvent, type ExtractedField } from "./types";
import { computeQuote } from "./pricing";

// ── Seed RFQ definitions ───────────────────────────────────────────────────

function now(): string {
    return new Date().toISOString();
}

function auditCreated(): AuditEvent {
    return { at: now(), actor: Actor.SYSTEM, action: AuditAction.RFQ_CREATED, detail: "RFQ imported and ready for review" };
}

// ── RFQ 1: Simple CNC Part ────────────────────────────────────────────────

const rfq1RawText = `REQUEST FOR QUOTE — Precision CNC Part

From: Mike Reynolds, Reynolds Manufacturing
Date: February 25, 2026
Subject: CNC Bracket — Qty 250

Part Number: BRK-4420-A
Material: Aluminum 6061-T6
Quantity: 250 pieces
Tolerance: ±0.005"
Surface Finish: Anodized, Type II, Class 1 (clear)

Process: 3-axis CNC milling

Dimensions: 4.5" x 2.75" x 0.625"
Features: 6 through-holes (0.250" dia), 2 counterbored holes, 1 pocket (2.0" x 1.0" x 0.375" deep)

Due Date: March 20, 2026
Delivery: FOB shipping point

Notes:
- Material cert required (mill certs acceptable)
- First article inspection required
- Deburr all edges

Please provide quote within 5 business days.
Contact: mike@reynoldsmfg.com | (555) 234-5678`;

const rfq1Fields: ExtractedField[] = [
    { key: "material", label: "Material", value: "Aluminum 6061-T6", confidence: 0.95, sourceSnippet: "Material: Aluminum 6061-T6", sourceRef: "Line 7", isConfirmed: false, userOverrideValue: null },
    { key: "quantity", label: "Quantity", value: "250", confidence: 0.97, sourceSnippet: "Quantity: 250 pieces", sourceRef: "Line 8", isConfirmed: false, userOverrideValue: null },
    { key: "tolerance", label: "Tolerance", value: "±0.005\"", confidence: 0.94, sourceSnippet: "Tolerance: ±0.005\"", sourceRef: "Line 9", isConfirmed: false, userOverrideValue: null },
    { key: "finish", label: "Surface Finish", value: "Anodized, Type II, Class 1 (clear)", confidence: 0.93, sourceSnippet: "Surface Finish: Anodized, Type II, Class 1 (clear)", sourceRef: "Line 10", isConfirmed: false, userOverrideValue: null },
    { key: "dueDate", label: "Due Date", value: "March 20, 2026", confidence: 0.96, sourceSnippet: "Due Date: March 20, 2026", sourceRef: "Line 14", isConfirmed: false, userOverrideValue: null },
    { key: "partNumber", label: "Part Number", value: "BRK-4420-A", confidence: 0.98, sourceSnippet: "Part Number: BRK-4420-A", sourceRef: "Line 6", isConfirmed: false, userOverrideValue: null },
    { key: "process", label: "Process", value: "3-axis CNC milling", confidence: 0.91, sourceSnippet: "Process: 3-axis CNC milling", sourceRef: "Line 12", isConfirmed: false, userOverrideValue: null },
];

// ── RFQ 2: Multi-Part Assembly ────────────────────────────────────────────

const rfq2RawText = `RFQ: Multi-Part Hydraulic Manifold Assembly

Customer: Sarah Chen, AquaDynamic Systems
Date: 2/26/2026

Hello,

We need a quote for a hydraulic manifold assembly consisting of 3 machined components:

1. Main Body Block
   - Material: 316 Stainless Steel
   - Qty: 75 units
   - 5-axis machining required
   - Internal passages (cross-drilled, 0.375" dia)
   - Tolerance on bore centers: ±0.002"

2. End Cap (x2 per assembly = 150 pcs)
   - Material: 316 SS (same as body)
   - O-ring groove per AS568 standard
   - Surface finish: 32 Ra or better on sealing surfaces

3. Mounting Bracket
   - Material: A36 Carbon Steel, zinc plated
   - Qty: 75
   - Simple 3-axis work

Delivery needed by April 15, 2026 — this is firm.
Tolerances unless noted: ±0.010"

We may need expedited delivery if schedule slips. Please include expedite pricing for 2-week turnaround.

Contact: sarah.chen@aquadynamic.com
Phone: (555) 891-2345`;

const rfq2Fields: ExtractedField[] = [
    { key: "material", label: "Material", value: "316 Stainless Steel", confidence: 0.88, sourceSnippet: "Material: 316 Stainless Steel", sourceRef: "Line 10", isConfirmed: false, userOverrideValue: null },
    { key: "quantity", label: "Quantity", value: "75", confidence: 0.78, sourceSnippet: "Qty: 75 units", sourceRef: "Line 11", isConfirmed: false, userOverrideValue: null },
    { key: "tolerance", label: "Tolerance", value: "±0.002\"", confidence: 0.71, sourceSnippet: "Tolerance on bore centers: ±0.002\"", sourceRef: "Line 14", isConfirmed: false, userOverrideValue: null },
    { key: "finish", label: "Surface Finish", value: "32 Ra or better on sealing surfaces", confidence: 0.67, sourceSnippet: "Surface finish: 32 Ra or better on sealing surfaces", sourceRef: "Line 19", isConfirmed: false, userOverrideValue: null },
    { key: "dueDate", label: "Due Date", value: "April 15, 2026", confidence: 0.93, sourceSnippet: "Delivery needed by April 15, 2026 — this is firm.", sourceRef: "Line 26", isConfirmed: false, userOverrideValue: null },
    { key: "process", label: "Process", value: "5-axis machining", confidence: 0.62, sourceSnippet: "5-axis machining required", sourceRef: "Line 12", isConfirmed: false, userOverrideValue: null },
];

// ── RFQ 3: Complex / Ambiguous ────────────────────────────────────────────

const rfq3RawText = `FW: Quote request — tight tolerance aerospace bracket

Hi team,

Forwarding this from our customer. They need quotes ASAP.

---

Original message from: James Okonkwo, AeroVance Corp.

We have an upcoming requirement for a precision aerospace bracket. Details below:

Part: AV-X7 flight bracket (no drawing attached yet — will follow)
Material: Titanium Ti-6Al-4V (Grade 5) or approved equivalent
Quantity: TBD — likely 25-50 units, quote both quantities

Critical requirements:
- Positional tolerance: ±0.001" on all mounting holes
- Profile tolerance: 0.002" on aero surfaces
- Surface finish: 16 Ra on all aero surfaces, 63 Ra elsewhere
- All machining per AMS 2759 heat treat standard

Certifications needed:
- AS9100 compliance
- Full material traceability (heat/lot numbers)
- FAIR (First Article Inspection Report) per AS9102

Target delivery: 6-8 weeks ARO
Budget: Competitive with our incumbent supplier (previous quotes ~$850–$1,200/unit)

Note: This is a new program, potential for recurring orders of 200+/year if quality and delivery are acceptable.

Please advise on lead time and NRE charges.

James Okonkwo | Senior Buyer
AeroVance Corp. | Aerospace Division
james.okonkwo@aerovance.com | (555) 667-8901`;

const rfq3Fields: ExtractedField[] = [
    { key: "material", label: "Material", value: "Titanium Ti-6Al-4V (Grade 5)", confidence: 0.89, sourceSnippet: "Material: Titanium Ti-6Al-4V (Grade 5) or approved equivalent", sourceRef: "Line 12", isConfirmed: false, userOverrideValue: null },
    { key: "quantity", label: "Quantity", value: "25-50", confidence: 0.45, sourceSnippet: "Quantity: TBD — likely 25-50 units, quote both quantities", sourceRef: "Line 13", isConfirmed: false, userOverrideValue: null },
    { key: "tolerance", label: "Tolerance", value: "±0.001\"", confidence: 0.87, sourceSnippet: "Positional tolerance: ±0.001\" on all mounting holes", sourceRef: "Line 16", isConfirmed: false, userOverrideValue: null },
    { key: "finish", label: "Surface Finish", value: "16 Ra on aero surfaces, 63 Ra elsewhere", confidence: 0.82, sourceSnippet: "Surface finish: 16 Ra on all aero surfaces, 63 Ra elsewhere", sourceRef: "Line 18", isConfirmed: false, userOverrideValue: null },
    { key: "dueDate", label: "Due Date", value: "6-8 weeks ARO", confidence: 0.38, sourceSnippet: "Target delivery: 6-8 weeks ARO", sourceRef: "Line 24", isConfirmed: false, userOverrideValue: null },
    { key: "partNumber", label: "Part Number", value: "AV-X7", confidence: 0.55, sourceSnippet: "Part: AV-X7 flight bracket (no drawing attached yet — will follow)", sourceRef: "Line 11", isConfirmed: false, userOverrideValue: null },
];

// ── RFQ 4: Executive Demo — Medical-Grade Titanium (Edge-Case Ambiguity) ──

const rfq4RawText = `FW: FW: Urgent quote request — implantable device component

Hi,

Forwarding from our procurement team. Please prioritize — customer is evaluating three shops.

---
From: Dr. Priya Ramachandran, Nexus Medical Devices
Engineering Procurement | Boston, MA

We are seeking a precision machining partner for an implantable orthopedic component. Details:

COMPONENT: Bone Anchor Housing — NMD-HA-991
Material: Titanium ASTM F136 (implant-grade, NOT commercial grade)
          Alternative: Ti-6Al-4V ELI (low interstitial, biocompatibility critical)
          Material certs and full traceability required per 21 CFR Part 820.

Quantity: Initial production run — approximately 50–100 units.
          If quality/delivery acceptable, follow-on PO of 500–1,000 units per quarter is expected.

Critical Dimensions (partial — full drawing package to follow):
  - OD: 12.5 mm ± 0.005 mm (tight, non-negotiable)
  - Thread: M8 × 1.0 ISO 6g tolerance (thread gauge verification required)
  - Surface finish: Ra ≤ 0.4 μm on sealing bore (electropolish acceptable)
  - All other surfaces: Ra ≤ 1.6 μm

Process: 5-axis CNC turning/milling + thread milling
Special: Ultrasonic cleaning per ASTM F86, passivation per ASTM F86

Quality Requirements:
  - ISO 13485:2016 certification required (or documented path to compliance)
  - Full FAI (First Article Inspection) per AS9102 equivalent
  - CMM report on all critical dimensions
  - Lot traceability to raw material heat number

Lead time target: 6 weeks ARO (preferred); 8 weeks acceptable
Packaging: Individual cleanroom bags, labeled per UDI-DI requirements

Budget context: Previous supplier quoted $185–$220/unit at qty 100.
               We expect competitive pricing given your capabilities.

Please confirm capability and provide quote by end of week.

Dr. Priya Ramachandran, Ph.D.
Director of Procurement Engineering
Nexus Medical Devices | Boston, MA 02110
p.ramachandran@nexusmedical.com | +1 (617) 555-0182`;

const rfq4Fields: ExtractedField[] = [
    { key: "material", label: "Material", value: "Titanium ASTM F136 (implant-grade)", confidence: 0.91, sourceSnippet: "Material: Titanium ASTM F136 (implant-grade, NOT commercial grade)", sourceRef: "Line 11", isConfirmed: false, userOverrideValue: null },
    { key: "quantity", label: "Quantity", value: "50–100 units", confidence: 0.44, sourceSnippet: "approximately 50–100 units", sourceRef: "Line 16", isConfirmed: false, userOverrideValue: null },
    { key: "tolerance", label: "Tolerance", value: "±0.005 mm (OD critical)", confidence: 0.88, sourceSnippet: "OD: 12.5 mm ± 0.005 mm (tight, non-negotiable)", sourceRef: "Line 22", isConfirmed: false, userOverrideValue: null },
    { key: "finish", label: "Surface Finish", value: "Ra ≤ 0.4 μm (sealing bore)", confidence: 0.85, sourceSnippet: "Surface finish: Ra ≤ 0.4 μm on sealing bore (electropolish acceptable)", sourceRef: "Line 25", isConfirmed: false, userOverrideValue: null },
    { key: "dueDate", label: "Due Date", value: "6 weeks ARO", confidence: 0.42, sourceSnippet: "Lead time target: 6 weeks ARO (preferred); 8 weeks acceptable", sourceRef: "Line 33", isConfirmed: false, userOverrideValue: null },
    { key: "partNumber", label: "Part Number", value: "NMD-HA-991", confidence: 0.97, sourceSnippet: "COMPONENT: Bone Anchor Housing — NMD-HA-991", sourceRef: "Line 10", isConfirmed: false, userOverrideValue: null },
    { key: "process", label: "Process", value: "5-axis CNC turning/milling + thread milling", confidence: 0.93, sourceSnippet: "Process: 5-axis CNC turning/milling + thread milling", sourceRef: "Line 27", isConfirmed: false, userOverrideValue: null },
];

// ── Export seed factory ──────────────────────────────────────────────────

export interface SeedRFQ {
    id: string;
    customerName: string;
    subject: string;
    rawText: string;
    extractedFields: ExtractedField[];
}

export function getSeedRFQs(): RFQ[] {
    // Pre-compute quotes for RFQ 1 + 2 so Ask ForgeSight has real pricing data out-of-the-box
    const rfq1Quote = computeQuote(
        { quantity: 250, materialCostPerUnit: 6, materialQty: 1.3, setupHours: 8, laborHours: 37.5, machineHours: 75 },
        DEFAULT_SHOP_CONFIG
    );
    const rfq2Quote = computeQuote(
        { quantity: 75, materialCostPerUnit: 25, materialQty: 1.3, setupHours: 5, laborHours: 22.5, machineHours: 56.3 },
        DEFAULT_SHOP_CONFIG
    );

    const seeds: (SeedRFQ & { quote: ReturnType<typeof computeQuote> | null; status: RFQStatus })[] = [
        {
            id: uuidv4(),
            customerName: "Reynolds Manufacturing",
            subject: "CNC Bracket — Qty 250",
            rawText: rfq1RawText,
            extractedFields: rfq1Fields,
            quote: rfq1Quote,
            status: RFQStatus.READY_TO_SEND,
        },
        {
            id: uuidv4(),
            customerName: "AquaDynamic Systems",
            subject: "Hydraulic Manifold Assembly — Multi-part",
            rawText: rfq2RawText,
            extractedFields: rfq2Fields,
            quote: rfq2Quote,
            status: RFQStatus.READY_TO_SEND,
        },
        {
            id: uuidv4(),
            customerName: "AeroVance Corp.",
            subject: "Aerospace Bracket — Tight Tolerance Ti-6Al-4V",
            rawText: rfq3RawText,
            extractedFields: rfq3Fields,
            quote: null,
            status: RFQStatus.NEEDS_REVIEW,
        },
        {
            id: uuidv4(),
            customerName: "Nexus Medical Devices",
            subject: "Implant-Grade Ti Bone Anchor Housing — NMD-HA-991",
            rawText: rfq4RawText,
            extractedFields: rfq4Fields,
            quote: null,
            status: RFQStatus.NEEDS_REVIEW,
        },
    ];

    return seeds.map((s) => ({
        id: s.id,
        createdAt: now(),
        customerName: s.customerName,
        subject: s.subject,
        status: s.status,
        rawText: s.rawText,
        extractedFields: s.extractedFields,
        quote: s.quote,
        audit: [
            auditCreated(),
            { at: now(), actor: Actor.SYSTEM, action: AuditAction.FIELDS_EXTRACTED, detail: `Extracted ${s.extractedFields.length} fields from RFQ text` },
            ...(s.quote ? [{ at: now(), actor: Actor.SYSTEM, action: AuditAction.QUOTE_GENERATED, detail: `Quote $${s.quote.totals.total.toFixed(2)} pre-computed from seed data` }] : []),
        ],
    }));
}
