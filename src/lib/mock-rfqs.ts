// Mock RFQ data for Phase 1 UI development
// These are replaced by live API calls in Phase 2

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type UiStatus =
    | "needs_review"
    | "needs_answers"
    | "ready_to_quote"
    | "sent"
    | "completed";

export interface MockRFQ {
    id: string;
    customerName: string;
    subject: string;
    status: UiStatus;
    risk: RiskLevel;
    updatedAt: string;
    rawText: string;
    confidence: number; // avg field confidence 0..1
}

export const MOCK_RFQS: MockRFQ[] = [
    {
        id: "rfq-001",
        customerName: "Acme Aerospace",
        subject: "Titanium shaft — 50 units, Qty 50, GD&T per DWG-4401",
        status: "needs_review",
        risk: "HIGH",
        updatedAt: "2 hours ago",
        confidence: 0.62,
        rawText: `Hi,

We need a quote for 50 units of our titanium shaft assembly per drawing DWG-4401 Rev C.

Key specs:
- Material: Ti-6Al-4V (Grade 5)
- OD: 38.1mm ±0.025mm
- Length: 245mm total, 3x M10 threaded ends
- Surface finish: Ra 0.8μm on bearing journals
- Qty: 50 units
- Delivery: 6 weeks ARO

Please confirm material certs (AS9100D) and provide unit price + NRE breakdown.

Best,
Mike Chen
Acme Aerospace — Procurement`,
    },
    {
        id: "rfq-002",
        customerName: "TechFlow Industries",
        subject: "Aluminum bracket assembly — Qty 500",
        status: "needs_review",
        risk: "LOW",
        updatedAt: "5 hours ago",
        confidence: 0.89,
        rawText: `Hello,

We are looking for a supplier for our standard bracket (P/N: TF-B220) in 6061-T6 aluminum.

- Qty: 500 pcs
- Finish: Hard anodize, Type III, black
- Tolerance: ±0.1mm general, ±0.025mm on critical bore
- Lead time: 8 weeks
- Packaging: Individual bags, 25/box

Drawing attached. Please quote FOB our facility.

Thanks,
Sarah Park
TechFlow Industries`,
    },
    {
        id: "rfq-003",
        customerName: "Precision Dynamics",
        subject: "Stainless housing — need clarification on surface finish",
        status: "needs_answers",
        risk: "MEDIUM",
        updatedAt: "1 day ago",
        confidence: 0.71,
        rawText: `Team,

Quote request for 25 pcs of our SS 316L housing assembly.

Dimensions are per DWG PD-7730. We need electropolish but are flexible on Ra spec — can you tell us what Ra you can achieve and at what cost delta vs standard?

Also: are you able to do passivation in-house or is that outsourced?

Rush required — need quote in 48h.

Jim Torres
Precision Dynamics LLC`,
    },
    {
        id: "rfq-004",
        customerName: "MachTec Corp",
        subject: "CNC milled gearbox cover — 10 units prototype",
        status: "ready_to_quote",
        risk: "LOW",
        updatedAt: "2 days ago",
        confidence: 0.94,
        rawText: `Hi,

Please quote 10 prototype units of our gearbox cover in 7075-T651.

All dims per DWG MT-9012 Rev A. Tolerances: ±0.05mm critical, ±0.1mm general.
No special surface finish required — deburr and inspect only.

Delivery: 3 weeks.

Best,
Lisa Chen`,
    },
    {
        id: "rfq-005",
        customerName: "Orbital Systems",
        subject: "Copper heat spreader — 200 units production",
        status: "sent",
        risk: "MEDIUM",
        updatedAt: "3 days ago",
        confidence: 0.81,
        rawText: `Hi Team,

Production order: 200 pcs copper heat spreader per DWG OS-4401.

Material: C110 copper, half-hard
Flatness: 0.05mm TIR
Surface: Nickel plate, 5μm min

Lead time: 10 weeks
Please confirm capacity and provide production price.

Regards,
Alex Kim
Orbital Systems`,
    },
];

// The "golden demo" RFQ — always works, rich data
export const DEMO_RFQ = MOCK_RFQS[0];

export const DEMO_EXTRACTED_FIELDS = [
    {
        key: "material",
        label: "Material",
        value: "Ti-6Al-4V (Grade 5)",
        confidence: 0.97,
        sourceSnippet: "Material: Ti-6Al-4V (Grade 5)",
        sourceRef: "Line 6",
        isConfirmed: true,
        userOverrideValue: null,
    },
    {
        key: "quantity",
        label: "Quantity",
        value: "50 units",
        confidence: 0.99,
        sourceSnippet: "Qty: 50 units",
        sourceRef: "Line 10",
        isConfirmed: true,
        userOverrideValue: null,
    },
    {
        key: "od",
        label: "Outer Diameter",
        value: "38.1mm ±0.025mm",
        confidence: 0.94,
        sourceSnippet: "OD: 38.1mm ±0.025mm",
        sourceRef: "Line 7",
        isConfirmed: false,
        userOverrideValue: null,
    },
    {
        key: "length",
        label: "Length",
        value: "245mm total",
        confidence: 0.91,
        sourceSnippet: "Length: 245mm total, 3x M10 threaded ends",
        sourceRef: "Line 8",
        isConfirmed: false,
        userOverrideValue: null,
    },
    {
        key: "surface_finish",
        label: "Surface Finish",
        value: "Ra 0.8μm on bearing journals",
        confidence: 0.88,
        sourceSnippet: "Surface finish: Ra 0.8μm on bearing journals",
        sourceRef: "Line 9",
        isConfirmed: false,
        userOverrideValue: null,
    },
    {
        key: "delivery",
        label: "Delivery Requirement",
        value: "6 weeks ARO",
        confidence: 0.95,
        sourceSnippet: "Delivery: 6 weeks ARO",
        sourceRef: "Line 11",
        isConfirmed: false,
        userOverrideValue: null,
    },
    {
        key: "certs",
        label: "Certifications",
        value: "AS9100D material certs",
        confidence: 0.61,
        sourceSnippet: "Please confirm material certs (AS9100D)",
        sourceRef: "Line 13",
        isConfirmed: false,
        userOverrideValue: null,
    },
];

export const DEMO_CLARIFIER: {
    questions: { id: string; text: string; required: boolean; answer: string | null }[];
    assumptions: string[];
    riskFlags: string[];
} = {
    questions: [
        {
            id: "q1",
            text: "What thread class is required for the M10 ends — 6H/6g tolerance or tighter?",
            required: true,
            answer: null,
        },
        {
            id: "q2",
            text: "Is a CMM inspection report required per unit, or is SPC data on first article sufficient?",
            required: true,
            answer: null,
        },
        {
            id: "q3",
            text: "Is witness inspection required, or can you accept your own CofC?",
            required: false,
            answer: null,
        },
    ],
    assumptions: [
        "Material certification traceable to heat/lot — standard AS9100D package.",
        "Packaging: VCI poly bag per unit, bulk carton (no individual clamshells).",
        "First article inspection (FAI) included in NRE, recurring units visual + dimensional only.",
    ],
    riskFlags: [
        "Tight OD tolerance (±0.025mm) on Ti-6Al-4V requires precision grinding — verify machine capability.",
        "AS9100D cert requirement: confirm your facility has current certification on file.",
    ],
};

export const DEMO_QUOTE = {
    lineItems: [
        { type: "MATERIAL", label: "Ti-6Al-4V bar stock", formula: "qty × mat_cost", inputs: { qty: 50, mat_cost: 180 }, amount: 9000, why: "Ti-6Al-4V Grade 5 @ $180/unit raw" },
        { type: "SETUP", label: "Setup & Fixturing", formula: "setup_hrs × setup_rate", inputs: { setup_hrs: 8, setup_rate: 85 }, amount: 680, why: "Custom fixture for 4-axis turning" },
        { type: "RUN_TIME", label: "Machining (CNC Lathe)", formula: "qty × run_hrs × machine_rate", inputs: { qty: 50, run_hrs: 1.5, machine_rate: 120 }, amount: 9000, why: "1.5 hrs/part on 4-axis lathe" },
        { type: "LABOR", label: "Grinding (OD journals)", formula: "qty × grind_hrs × labor_rate", inputs: { qty: 50, grind_hrs: 0.75, labor_rate: 65 }, amount: 2437.50, why: "±0.025mm requires cylindrical grinding" },
        { type: "OVERHEAD", label: "Shop Overhead", formula: "subtotal × overhead_pct", inputs: { overhead_pct: 0.15 }, amount: 3167.63, why: "15% applied overhead" },
        { type: "MARGIN", label: "Margin", formula: "subtotal × margin_pct", inputs: { margin_pct: 0.20 }, amount: 4857.02, why: "20% target margin" },
    ],
    totals: {
        subtotal: 21117.50,
        overheadAmount: 3167.63,
        marginPct: 0.20,
        marginAmount: 4857.02,
        total: 29142.15,
    },
    assumptions: [
        "Material at current spot price — valid 30 days",
        "Standard 6H thread tolerance unless otherwise specified",
        "FAI included, recurring units CMM sampling 10%",
    ],
};

export const TAB_FILTERS: Record<string, UiStatus[]> = {
    review: ["needs_review"],
    answers: ["needs_answers"],
    ready: ["ready_to_quote"],
    sent: ["sent"],
    completed: ["completed"],
};
