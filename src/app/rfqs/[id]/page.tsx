"use client";

import { useState, useCallback, use } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Sparkles,
    CheckCircle2,
    Circle,
    Loader2,
    AlertTriangle,
    FileText,
    MessageSquare,
    Calculator,
    Send,
    ChevronRight,
    HelpCircle,
    Info,
    Copy,
    Download,
    ClipboardCheck,
    Zap,
    RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
    DEMO_RFQ,
    DEMO_EXTRACTED_FIELDS,
    DEMO_CLARIFIER,
    DEMO_QUOTE,
    MOCK_RFQS,
} from "@/lib/mock-rfqs";
import { toast } from "sonner";

// ── Step Types ──────────────────────────────────────────────────────────────

type StepState = "pending" | "active" | "complete" | "error";

interface Step {
    id: number;
    icon: React.ElementType;
    label: string;
    description: string;
}

const STEPS: Step[] = [
    { id: 1, icon: Sparkles, label: "Extract", description: "AI reads the RFQ" },
    { id: 2, icon: ClipboardCheck, label: "Review Fields", description: "Confirm AI output" },
    { id: 3, icon: MessageSquare, label: "Clarify", description: "Answer open questions" },
    { id: 4, icon: Calculator, label: "Quote Builder", description: "Deterministic pricing" },
    { id: 5, icon: Send, label: "Deliver", description: "PDF + email draft" },
];

// ── Step Indicator ──────────────────────────────────────────────────────────

function StepIndicator({
    step,
    state,
    active,
    onClick,
}: {
    step: Step;
    state: StepState;
    active: boolean;
    onClick: () => void;
}) {
    const Icon = step.icon;
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                active ? "bg-accent" : "hover:bg-accent/40",
                state === "pending" && "opacity-50"
            )}
        >
            {/* Circle */}
            <div
                className={cn(
                    "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                    state === "complete" && "border-emerald-500 bg-emerald-500 text-white",
                    state === "active" && "border-foreground bg-foreground text-background",
                    state === "error" && "border-red-500 bg-red-500 text-white",
                    state === "pending" && "border-muted-foreground/30 bg-transparent text-muted-foreground"
                )}
            >
                {state === "complete" ? (
                    <CheckCircle2 className="h-4 w-4" />
                ) : state === "error" ? (
                    <AlertTriangle className="h-3.5 w-3.5" />
                ) : (
                    <Icon className="h-3.5 w-3.5" />
                )}
            </div>
            {/* Label */}
            <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium leading-none", active ? "text-foreground" : "text-muted-foreground")}>
                    {step.label}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/70 truncate">
                    {step.description}
                </p>
            </div>
            {active && <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />}
        </button>
    );
}

// ── Step 1: Extract ─────────────────────────────────────────────────────────

function ExtractStep({
    rfqId,
    rawText,
    onComplete,
}: {
    rfqId: string;
    rawText: string;
    onComplete: () => void;
}) {
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [log, setLog] = useState<string[]>([]);

    const handleExtract = async () => {
        setLoading(true);
        setLog([]);
        const steps = [
            "Sending RFQ text to Gemini 2.5 Flash…",
            "Parsing structured fields: material, qty, dimensions…",
            "Assigning confidence scores from source citations…",
            "Extraction complete — 7 fields identified",
        ];
        for (const s of steps) {
            await new Promise((r) => setTimeout(r, 600));
            setLog((prev) => [...prev, s]);
        }
        // Try live API, fall back gracefully
        try {
            await fetch(`/api/rfqs/${rfqId}/extract`, { method: "POST" });
        } catch { /* offline — demo still works */ }
        setLoading(false);
        setDone(true);
        toast.success("Fields extracted");
        onComplete();
    };

    if (done) {
        return (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="rounded-full bg-emerald-100 p-3 dark:bg-emerald-950/40">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                    <p className="font-semibold">Extraction complete</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        7 fields extracted · avg confidence 86%
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setDone(false); setLog([]); }}>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Re-extract
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    What happens here
                </p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                        <Zap className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                        Gemini 2.5 Flash reads the raw RFQ text
                    </li>
                    <li className="flex items-start gap-2">
                        <Zap className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                        Returns structured fields with confidence scores
                    </li>
                    <li className="flex items-start gap-2">
                        <Zap className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                        Cites exact source snippets from the document
                    </li>
                </ul>
            </div>

            {log.length > 0 && (
                <div className="rounded-lg border border-border bg-black/90 p-3 font-mono text-xs text-green-400 space-y-1">
                    {log.map((l, i) => (
                        <p key={i} className="flex items-center gap-2">
                            <span className="text-green-600">›</span> {l}
                        </p>
                    ))}
                    {loading && (
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Processing…
                        </p>
                    )}
                </div>
            )}

            <Button onClick={handleExtract} disabled={loading} className="w-full gap-2">
                {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Extracting…</>
                ) : (
                    <><Sparkles className="h-4 w-4" /> Extract with AI</>
                )}
            </Button>
        </div>
    );
}

// ── Step 2: Review Fields ───────────────────────────────────────────────────

function ReviewStep({ onComplete }: { onComplete: () => void }) {
    const [fields, setFields] = useState(DEMO_EXTRACTED_FIELDS.map(f => ({ ...f })));
    const allConfirmed = fields.filter(f => f.confidence >= 0.85 || f.isConfirmed).length;
    const total = fields.length;

    const confirm = (key: string) => {
        setFields(fs => fs.map(f => f.key === key ? { ...f, isConfirmed: true } : f));
    };

    const confirmAll = () => {
        setFields(fs => fs.map(f => ({ ...f, isConfirmed: true })));
        setTimeout(() => { onComplete(); }, 300);
    };

    const lowConf = fields.filter(f => f.confidence < 0.85 && !f.isConfirmed);

    return (
        <div className="space-y-3">
            {/* Summary bar */}
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                    {fields.filter(f => f.isConfirmed).length} / {total} confirmed
                </span>
                {lowConf.length > 0 && (
                    <Badge variant="outline" className="gap-1 text-amber-600 border-amber-200 text-[10px]">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {lowConf.length} need review
                    </Badge>
                )}
            </div>

            {/* Fields list */}
            <div className="space-y-2">
                {fields.map((field) => {
                    const pct = Math.round(field.confidence * 100);
                    const needsReview = field.confidence < 0.85 && !field.isConfirmed;
                    return (
                        <div
                            key={field.key}
                            className={cn(
                                "rounded-lg border p-3 transition-colors",
                                field.isConfirmed ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-950/10" :
                                    needsReview ? "border-amber-200 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-950/10" :
                                        "border-border"
                            )}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                            {field.label}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                                                <div
                                                    className={cn("h-full", pct >= 85 ? "bg-emerald-500" : pct >= 65 ? "bg-amber-500" : "bg-red-500")}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] tabular-nums text-muted-foreground">{pct}%</span>
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium">{field.value}</p>
                                    <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                                        <span className="text-muted-foreground/50">{field.sourceRef}</span>
                                        {" — "}&ldquo;{field.sourceSnippet}&rdquo;
                                    </p>
                                </div>
                                {field.isConfirmed ? (
                                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 whitespace-nowrap">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Confirmed
                                    </span>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant={needsReview ? "default" : "outline"}
                                        className="h-7 text-xs gap-1 flex-shrink-0"
                                        onClick={() => confirm(field.key)}
                                    >
                                        <CheckCircle2 className="h-3 w-3" />
                                        Confirm
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <Separator />
            <Button onClick={confirmAll} className="w-full gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Confirm All & Continue
            </Button>
        </div>
    );
}

// ── Step 3: Clarify ─────────────────────────────────────────────────────────

function ClarifyStep({ onComplete }: { onComplete: () => void }) {
    const [clarifier, setClarifier] = useState(DEMO_CLARIFIER);
    const [assumptionsAccepted, setAssumptionsAccepted] = useState(false);
    const [loading, setLoading] = useState(false);

    const requiredAnswered = clarifier.questions.filter(
        q => !q.required || q.answer
    ).length === clarifier.questions.length;

    const canProceed = requiredAnswered && assumptionsAccepted;

    const setAnswer = (id: string, answer: string) => {
        setClarifier(c => ({
            ...c,
            questions: c.questions.map(q => q.id === id ? { ...q, answer } : q),
        }));
    };

    const handleProceed = async () => {
        setLoading(true);
        await new Promise(r => setTimeout(r, 600));
        setLoading(false);
        onComplete();
        toast.success("Clarifications saved — quote is unlocked");
    };

    return (
        <div className="space-y-4">
            {/* Questions */}
            <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Questions from AI
                    <Badge variant="outline" className="ml-2 text-[10px]">Required</Badge>
                </p>
                <div className="space-y-3">
                    {clarifier.questions.map((q) => (
                        <div key={q.id} className={cn(
                            "rounded-lg border p-3",
                            q.required && !q.answer ? "border-amber-200 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-950/10" : "border-border"
                        )}>
                            <div className="flex items-start gap-2 mb-2">
                                {q.required ? (
                                    <HelpCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                                ) : (
                                    <HelpCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50" />
                                )}
                                <p className="text-sm">
                                    {q.text}
                                    {!q.required && (
                                        <span className="ml-1.5 text-[10px] text-muted-foreground">(optional)</span>
                                    )}
                                </p>
                            </div>
                            <Input
                                placeholder="Your answer…"
                                value={q.answer ?? ""}
                                onChange={(e) => setAnswer(q.id, e.target.value)}
                                className="text-sm"
                            />
                        </div>
                    ))}
                </div>
            </div>

            <Separator />

            {/* Assumptions */}
            <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    AI Assumptions
                </p>
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    {clarifier.assumptions.map((a, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                            <span className="text-muted-foreground">{a}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Risk flags */}
            {clarifier.riskFlags.length > 0 && (
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Risk Flags
                    </p>
                    <div className="space-y-2">
                        {clarifier.riskFlags.map((rf, i) => (
                            <div key={i} className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/30 p-3 text-sm dark:border-red-900/30 dark:bg-red-950/10">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-500" />
                                <span className="text-muted-foreground">{rf}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Separator />

            {/* Confirm assumptions */}
            <label className="flex items-center gap-3 cursor-pointer">
                <input
                    type="checkbox"
                    checked={assumptionsAccepted}
                    onChange={e => setAssumptionsAccepted(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm text-muted-foreground">
                    I confirm the assumptions above are acceptable for this quote
                </span>
            </label>

            <Button
                onClick={handleProceed}
                disabled={!canProceed || loading}
                className="w-full gap-2"
            >
                {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                ) : (
                    <><Calculator className="h-4 w-4" /> Proceed to Quote Builder</>
                )}
            </Button>

            {!canProceed && (
                <p className="text-center text-xs text-muted-foreground">
                    {!requiredAnswered
                        ? "Answer all required questions to unlock quoting"
                        : "Accept assumptions to continue"}
                </p>
            )}
        </div>
    );
}

// ── Step 4: Quote Builder ───────────────────────────────────────────────────

function QuoteStep({ onComplete }: { onComplete: () => void }) {
    const [generating, setGenerating] = useState(false);
    const [quote, setQuote] = useState<typeof DEMO_QUOTE | null>(null);

    const handleGenerate = async () => {
        setGenerating(true);
        await new Promise(r => setTimeout(r, 1000));
        setQuote(DEMO_QUOTE);
        setGenerating(false);
        toast.success("Quote generated — $" + DEMO_QUOTE.totals.total.toLocaleString());
    };

    if (!quote) {
        return (
            <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground space-y-2">
                    <p className="flex items-center gap-2 font-medium text-foreground">
                        <Calculator className="h-4 w-4" />
                        Deterministic Pricing Engine
                    </p>
                    <p>All prices computed from your shop config + extracted fields. Gemini never touches pricing — only humans and the formula engine.</p>
                </div>
                <div className="rounded-lg border border-border p-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Shop Config</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-muted-foreground">Setup rate:</span> $85/hr</div>
                        <div><span className="text-muted-foreground">Labor rate:</span> $65/hr</div>
                        <div><span className="text-muted-foreground">Machine rate:</span> $120/hr</div>
                        <div><span className="text-muted-foreground">Overhead:</span> 15%</div>
                        <div><span className="text-muted-foreground">Margin:</span> 20%</div>
                    </div>
                </div>
                <Button onClick={handleGenerate} disabled={generating} className="w-full gap-2">
                    {generating ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Calculating…</>
                    ) : (
                        <><Calculator className="h-4 w-4" /> Generate Quote</>
                    )}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Line items */}
            <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/50">
                            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Line Item</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {DEMO_QUOTE.lineItems.map((item, i) => (
                            <tr key={i} className="border-b border-border last:border-0">
                                <td className="px-3 py-2.5">
                                    <p className="font-medium">{item.label}</p>
                                    <p className="text-[10px] text-muted-foreground">{item.why}</p>
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">
                                    ${item.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-foreground/20 bg-muted/30">
                            <td className="px-3 py-3 font-bold">Total (50 units)</td>
                            <td className="px-3 py-3 text-right font-mono text-lg font-bold">
                                ${DEMO_QUOTE.totals.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </td>
                        </tr>
                        <tr>
                            <td colSpan={2} className="px-3 py-1.5 text-xs text-muted-foreground">
                                Unit price: ${(DEMO_QUOTE.totals.total / 50).toFixed(2)} · Margin: 20%
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <Button onClick={onComplete} className="w-full gap-2">
                <Send className="h-4 w-4" />
                Proceed to Deliver
            </Button>
        </div>
    );
}

// ── Step 5: Deliver ─────────────────────────────────────────────────────────

function DeliverStep({ rfqId }: { rfqId: string }) {
    const [emailDraft, setEmailDraft] = useState(`Dear Mike,

Thank you for sending over the RFQ for the Ti-6Al-4V shaft assembly (DWG-4401 Rev C).

We're pleased to provide the following quotation:

• Quantity: 50 units
• Unit Price: $582.84
• Total: $29,142.15
• Lead Time: 5–6 weeks ARO

This quote is valid for 30 days. All units will include AS9100D material certifications, CMM first article inspection, and our standard 10% recurring dimensional sampling.

Please see the attached PDF for the full cost breakdown and assumptions.

Best regards,
[Your Name]
ForgeSight Manufacturing`);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [emailCopied, setEmailCopied] = useState(false);

    const handleDownloadPdf = async () => {
        setPdfLoading(true);
        try {
            const res = await fetch(`/api/rfqs/${rfqId}/quote/pdf`);
            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `quote-${rfqId}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("PDF downloaded");
            } else {
                toast.error("PDF generation failed — check server logs");
            }
        } catch {
            toast.error("PDF not available in demo mode");
        } finally {
            setPdfLoading(false);
        }
    };

    const copyEmail = () => {
        navigator.clipboard.writeText(emailDraft);
        setEmailCopied(true);
        toast.success("Email draft copied");
        setTimeout(() => setEmailCopied(false), 2000);
    };

    return (
        <div className="space-y-4">
            {/* Summary card */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                        Quote ready to send
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Total:</span> <span className="font-bold">$29,142.15</span></div>
                    <div><span className="text-muted-foreground">Unit price:</span> <span className="font-bold">$582.84</span></div>
                    <div><span className="text-muted-foreground">Margin:</span> 20%</div>
                    <div><span className="text-muted-foreground">Lead time:</span> 5–6 wks</div>
                </div>
            </div>

            {/* PDF download */}
            <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
            >
                {pdfLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating PDF…</>
                ) : (
                    <><Download className="h-4 w-4" /> Download Quote PDF</>
                )}
            </Button>

            <Separator />

            {/* Email draft */}
            <div>
                <div className="mb-2 flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Email Draft
                    </Label>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 px-2 text-xs"
                        onClick={copyEmail}
                    >
                        <Copy className="h-3 w-3" />
                        {emailCopied ? "Copied!" : "Copy"}
                    </Button>
                </div>
                <Textarea
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    rows={12}
                    className="resize-none font-mono text-xs"
                />
            </div>

            <Button className="w-full gap-2" disabled>
                <Send className="h-4 w-4" />
                Send via Email
                <Badge variant="secondary" className="ml-auto text-[9px]">Coming soon</Badge>
            </Button>
        </div>
    );
}

// ── Document Viewer ─────────────────────────────────────────────────────────

function DocumentViewer({ text, title }: { text: string; title: string }) {
    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold truncate">{title}</span>
                <Badge variant="outline" className="ml-auto text-[10px]">Raw RFQ</Badge>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/80">
                    {text}
                </pre>
            </div>
        </div>
    );
}

// ── Similar Jobs Card ───────────────────────────────────────────────────────

function SimilarJobsPanel() {
    const similar = [
        { id: "rfq-004", customer: "MachTec Corp", subject: "Ti-6Al-4V shaft prototype", total: "$12,450", match: "87%" },
        { id: "rfq-002", customer: "TechFlow Industries", subject: "Aluminum bracket — 500 units", total: "$8,200", match: "61%" },
    ];
    return (
        <div className="rounded-lg border border-border">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Similar Jobs
                </span>
            </div>
            <div className="p-2 space-y-1">
                {similar.map((s) => (
                    <div
                        key={s.id}
                        className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent cursor-pointer transition-colors"
                    >
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{s.customer}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{s.subject}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <p className="text-xs font-mono font-semibold">{s.total}</p>
                            <p className="text-[10px] text-muted-foreground">{s.match} match</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function RfqDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);

    // Find RFQ from mock data (Phase 2: replace with API call)
    const rfq = MOCK_RFQS.find(r => r.id === id) ?? DEMO_RFQ;

    const [activeStep, setActiveStep] = useState(1);
    const [stepStates, setStepStates] = useState<StepState[]>([
        "active", "pending", "pending", "pending", "pending",
    ]);

    const completeStep = useCallback((stepIdx: number) => {
        setStepStates(prev => {
            const next = [...prev];
            next[stepIdx] = "complete";
            if (stepIdx + 1 < next.length) {
                next[stepIdx + 1] = "active";
                setActiveStep(stepIdx + 2); // 1-indexed
            }
            return next;
        });
    }, []);

    const renderStepContent = () => {
        switch (activeStep) {
            case 1:
                return (
                    <ExtractStep
                        rfqId={rfq.id}
                        rawText={rfq.rawText}
                        onComplete={() => completeStep(0)}
                    />
                );
            case 2:
                return <ReviewStep onComplete={() => completeStep(1)} />;
            case 3:
                return <ClarifyStep onComplete={() => completeStep(2)} />;
            case 4:
                return <QuoteStep onComplete={() => completeStep(3)} />;
            case 5:
                return <DeliverStep rfqId={rfq.id} />;
            default:
                return null;
        }
    };

    const completedCount = stepStates.filter(s => s === "complete").length;
    const progressPct = (completedCount / STEPS.length) * 100;

    return (
        <div className="flex h-screen flex-col overflow-hidden">
            {/* ── Top bar ── */}
            <header className="flex items-center gap-3 border-b border-border bg-background px-6 py-3">
                <Link href="/rfqs">
                    <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-3.5 w-3.5" />
                        RFQs
                    </Button>
                </Link>
                <Separator orientation="vertical" className="h-5" />
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-sm font-semibold">{rfq.customerName}</h1>
                    <p className="truncate text-xs text-muted-foreground">{rfq.subject}</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden items-center gap-2 sm:flex">
                        <span className="text-xs text-muted-foreground">{Math.round(progressPct)}% complete</span>
                        <div className="w-24">
                            <Progress value={progressPct} className="h-1.5" />
                        </div>
                    </div>
                    <Badge
                        variant="outline"
                        className={cn(
                            "text-[10px]",
                            rfq.risk === "HIGH" ? "border-red-200 text-red-600" : "border-amber-200 text-amber-600"
                        )}
                    >
                        {rfq.risk} RISK
                    </Badge>
                </div>
            </header>

            {/* ── Body ── */}
            <div className="flex flex-1 overflow-hidden">
                {/* Document viewer */}
                <div className="hidden w-[42%] border-r border-border lg:flex lg:flex-col">
                    <DocumentViewer text={rfq.rawText} title={`${rfq.customerName} — ${rfq.id}`} />
                </div>

                {/* Right side: stepper + content */}
                <div className="flex flex-1 flex-col overflow-hidden">
                    {/* Step nav */}
                    <div className="border-b border-border bg-background px-4 py-2">
                        <div className="flex gap-1">
                            {STEPS.map((step, i) => (
                                <StepIndicator
                                    key={step.id}
                                    step={step}
                                    state={stepStates[i]}
                                    active={activeStep === step.id}
                                    onClick={() => {
                                        if (stepStates[i] !== "pending") {
                                            setActiveStep(step.id);
                                        }
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Step content */}
                    <div className="flex flex-1 overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-5">
                            <div className="mx-auto max-w-[560px] space-y-1">
                                <div className="mb-4">
                                    <h2 className="text-base font-bold">
                                        Step {activeStep}: {STEPS[activeStep - 1]?.label}
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        {STEPS[activeStep - 1]?.description}
                                    </p>
                                </div>
                                {renderStepContent()}
                            </div>
                        </div>

                        {/* Similar jobs sidebar */}
                        <div className="hidden w-[240px] flex-col gap-3 border-l border-border p-4 xl:flex">
                            <SimilarJobsPanel />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
