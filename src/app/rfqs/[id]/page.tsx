"use client";

import { useState, useCallback, useEffect, use } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Sparkles,
    CheckCircle2,
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
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DEMO_RFQ, DEMO_EXTRACTED_FIELDS, DEMO_QUOTE } from "@/lib/mock-rfqs";
import { toast } from "sonner";
import type { ExtractedField, ClarifierOutput, Quote } from "@/core/types";

// ── Live RFQ shape (what the API returns) ──────────────────────────────────

interface LiveRFQ {
    id: string;
    customerName: string;
    subject: string;
    status: string;
    rawText: string;
    extractedFields: ExtractedField[];
    clarifier?: ClarifierOutput;
    clarifierAnswers?: Record<string, string>;
    confirmedAssumptions?: string[];
    quote: Quote | null;
    createdAt: string;
}

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

// Map RFQ API status to step index (0-based)
function statusToStep(status: string): number {
    switch (status) {
        case "NEW": return 0;
        case "EXTRACTED":
        case "NEEDS_REVIEW": return 1;
        case "NEEDS_CLARIFICATION": return 2;
        case "READY_TO_SEND": return 3;
        case "SENT": return 4;
        default: return 0;
    }
}

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
                state === "pending" && "opacity-40 cursor-default"
            )}
            disabled={state === "pending"}
        >
            <div className={cn(
                "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                state === "complete" && "border-emerald-500 bg-emerald-500 text-white",
                state === "active" && "border-foreground bg-foreground text-background",
                state === "error" && "border-red-500 bg-red-500 text-white",
                state === "pending" && "border-muted-foreground/30 bg-transparent text-muted-foreground"
            )}>
                {state === "complete" ? (
                    <CheckCircle2 className="h-4 w-4" />
                ) : state === "error" ? (
                    <AlertTriangle className="h-3.5 w-3.5" />
                ) : (
                    <Icon className="h-3.5 w-3.5" />
                )}
            </div>
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
    alreadyExtracted,
    onComplete,
}: {
    rfqId: string;
    alreadyExtracted: boolean;
    onComplete: (updatedRfq: LiveRFQ) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(alreadyExtracted);
    const [log, setLog] = useState<string[]>([]);
    const [engine, setEngine] = useState("mock");

    const handleExtract = async () => {
        setLoading(true);
        setLog([]);
        setDone(false);

        // Animate log lines while waiting for API
        const preflight = [
            "Sending RFQ text to Gemini 2.5 Flash…",
            "Parsing structured fields: material, qty, dimensions…",
            "Assigning confidence scores from source citations…",
        ];
        let logIdx = 0;
        const ticker = setInterval(() => {
            if (logIdx < preflight.length) {
                setLog(prev => [...prev, preflight[logIdx++]]);
            }
        }, 500);

        try {
            const res = await fetch(`/api/rfqs/${rfqId}/extract`, { method: "POST" });
            clearInterval(ticker);

            if (res.ok) {
                const updated: LiveRFQ = await res.json();
                const eng = (updated as unknown as { extractionMeta?: { engine?: string } }).extractionMeta?.engine ?? "mock";
                setEngine(eng);
                const fieldCount = updated.extractedFields?.length ?? 0;
                setLog(prev => [
                    ...prev,
                    `Extraction complete — ${fieldCount} field${fieldCount !== 1 ? "s" : ""} identified (${eng})`,
                ]);
                setDone(true);
                setLoading(false);
                toast.success(`${fieldCount} fields extracted`);
                onComplete(updated);
            } else {
                clearInterval(ticker);
                const err = await res.json().catch(() => ({}));
                setLog(prev => [...prev, `Error: ${(err as { error?: string }).error ?? "extraction failed"}`]);
                toast.error("Extraction failed");
                setLoading(false);
            }
        } catch {
            clearInterval(ticker);
            setLog(prev => [...prev, "Network error — falling back to mock extraction"]);
            setLoading(false);
            toast.error("Could not reach API");
        }
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
                        Engine: <span className="font-mono text-xs">{engine}</span> · Ready to review fields
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
                        Gemini 2.5 Flash reads the raw RFQ text (falls back to mock if no API key)
                    </li>
                    <li className="flex items-start gap-2">
                        <Zap className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                        Returns structured fields with confidence scores + source citations
                    </li>
                    <li className="flex items-start gap-2">
                        <Zap className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                        Also generates clarifying questions (if Gemini available)
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

function ReviewStep({
    rfqId,
    fields: initialFields,
    onComplete,
}: {
    rfqId: string;
    fields: ExtractedField[];
    onComplete: (updated: LiveRFQ) => void;
}) {
    const [fields, setFields] = useState<ExtractedField[]>(
        initialFields.length > 0 ? initialFields : DEMO_EXTRACTED_FIELDS
    );
    const [saving, setSaving] = useState(false);

    // Sync if parent updates fields
    useEffect(() => {
        if (initialFields.length > 0) setFields(initialFields);
    }, [initialFields]);

    const confirmField = (key: string) => {
        setFields(fs => fs.map(f => f.key === key ? { ...f, isConfirmed: true } : f));
    };

    const saveConfirmations = async (confirmedFields: ExtractedField[]) => {
        setSaving(true);
        try {
            const res = await fetch(`/api/rfqs/${rfqId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ extractedFields: confirmedFields }),
            });
            if (res.ok) {
                const updated: LiveRFQ = await res.json();
                return updated;
            }
        } catch { /* network error */ } finally {
            setSaving(false);
        }
        return null;
    };

    const confirmAll = async () => {
        const confirmed = fields.map(f => ({ ...f, isConfirmed: true }));
        setFields(confirmed);
        const updated = await saveConfirmations(confirmed);
        if (updated) {
            toast.success("All fields confirmed");
            onComplete(updated);
        } else {
            toast.error("Failed to save confirmations — check server");
        }
    };

    const lowConf = fields.filter(f => f.confidence < 0.85 && !f.isConfirmed);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                    {fields.filter(f => f.isConfirmed).length} / {fields.length} confirmed
                </span>
                {lowConf.length > 0 && (
                    <Badge variant="outline" className="gap-1 text-amber-600 border-amber-200 text-[10px]">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {lowConf.length} need review
                    </Badge>
                )}
            </div>

            <div className="space-y-2">
                {fields.map((field) => {
                    const pct = Math.round(field.confidence * 100);
                    const needsReview = field.confidence < 0.85 && !field.isConfirmed;
                    return (
                        <div
                            key={field.key}
                            className={cn(
                                "rounded-lg border p-3 transition-colors",
                                field.isConfirmed
                                    ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-950/10"
                                    : needsReview
                                        ? "border-amber-200 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-950/10"
                                        : "border-border"
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
                                    <p className="text-sm font-medium">
                                        {field.userOverrideValue ?? field.value}
                                    </p>
                                    {field.sourceSnippet && (
                                        <p className="mt-0.5 text-[10px] text-muted-foreground/70 truncate">
                                            <span className="text-muted-foreground/50">{field.sourceRef}</span>
                                            {" — "}&ldquo;{field.sourceSnippet}&rdquo;
                                        </p>
                                    )}
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
                                        onClick={() => confirmField(field.key)}
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
            <Button onClick={confirmAll} disabled={saving} className="w-full gap-2">
                {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                ) : (
                    <><CheckCircle2 className="h-4 w-4" /> Confirm All & Continue</>
                )}
            </Button>
        </div>
    );
}

// ── Step 3: Clarify ─────────────────────────────────────────────────────────

function ClarifyStep({
    rfqId,
    clarifier: liveClarifier,
    savedAnswers,
    savedAssumptions,
    onRfqUpdate,
    onComplete,
}: {
    rfqId: string;
    clarifier?: ClarifierOutput;
    savedAnswers?: Record<string, string>;
    savedAssumptions?: string[];
    onRfqUpdate?: (updated: LiveRFQ) => void;
    onComplete: (updated: LiveRFQ) => void;
}) {
    const cl = liveClarifier ?? null;
    const hasClarifier = !!cl;

    const questions = hasClarifier
        ? cl.questions.map(q => ({
            id: q.id,
            text: q.question,
            required: q.required,
            rationale: q.rationale,
            confidence: q.confidence,
            options: q.options as string[] | undefined,
            answer: savedAnswers?.[q.id] ?? null as string | null,
        }))
        : [];

    const assumptions = hasClarifier
        ? cl.assumptions.map(a => ({ id: a.id, text: a.assumption, confidence: a.confidence }))
        : [];

    const riskFlags = hasClarifier
        ? cl.riskFlags.map(r => ({ id: r.id, text: r.label, severity: r.severity, evidenceSnippet: r.evidenceSnippet }))
        : [];

    const [localAnswers, setLocalAnswers] = useState<Record<string, string>>(savedAnswers ?? {});
    const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set(savedAssumptions ?? []));
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);

    const requiredDone = questions.filter(q => q.required).every(
        q => localAnswers[q.id]?.trim()
    );
    const allAssumptionsConfirmed = assumptions.length === 0 || assumptions.every(a => confirmedIds.has(a.id));
    const canProceed = requiredDone && allAssumptionsConfirmed;

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const res = await fetch(`/api/rfqs/${rfqId}/clarify`, { method: "POST" });
            if (res.ok) {
                const updated: LiveRFQ = await res.json();
                toast.success("AI questions generated");
                onRfqUpdate?.(updated);
            } else if (res.status === 429) {
                toast.error("Gemini rate limited — wait ~60 seconds and try again");
            } else {
                const err = await res.json().catch(() => ({}));
                toast.error((err as { error?: string }).error ?? "Failed to generate questions");
            }
        } catch {
            toast.error("Network error");
        } finally {
            setGenerating(false);
        }
    };

    const handleProceed = async () => {
        setSaving(true);
        try {
            const assumptionIds = Array.from(confirmedIds);
            const res = await fetch(`/api/rfqs/${rfqId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clarifierAnswers: localAnswers,
                    confirmedAssumptions: assumptionIds,
                }),
            });
            if (res.ok) {
                const updated: LiveRFQ = await res.json();
                toast.success(hasClarifier ? "Clarifications saved — quote unlocked" : "Proceeding to quote builder");
                onComplete(updated);
            } else {
                toast.error("Failed to save clarifications");
            }
        } catch {
            toast.error("Network error");
        } finally {
            setSaving(false);
        }
    };

    // No real AI clarifier — offer generate + bypass
    if (!hasClarifier) {
        return (
            <div className="space-y-3">
                <div className="rounded-lg border border-violet-200/60 bg-violet-50/30 dark:border-violet-900/30 dark:bg-violet-950/10 p-4">
                    <div className="flex items-start gap-3">
                        <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-500" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">Generate AI clarifying questions</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Gemini will read this specific RFQ and generate targeted questions about tolerances, certifications, delivery terms, and other ambiguous specs that affect pricing.
                            </p>
                        </div>
                    </div>
                </div>
                <Button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="w-full gap-2"
                >
                    {generating ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Gemini is reading the RFQ…</>
                    ) : (
                        <><Sparkles className="h-4 w-4" /> Generate Questions with AI</>
                    )}
                </Button>
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center">
                        <span className="bg-background px-2 text-[10px] text-muted-foreground uppercase tracking-wider">or</span>
                    </div>
                </div>
                <Button variant="outline" onClick={handleProceed} disabled={saving || generating} className="w-full gap-2">
                    {saving ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                    ) : (
                        <><Calculator className="h-4 w-4" /> Skip & Proceed to Quote Builder</>
                    )}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Questions */}
            <div>
                <div className="mb-2 flex items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Questions
                    </p>
                    <Badge variant="outline" className="gap-1 text-[10px] border-violet-200 text-violet-700 dark:border-violet-900/50 dark:text-violet-400">
                        <Sparkles className="h-2.5 w-2.5" />
                        Gemini{cl.model ? ` · ${cl.model.split("-").slice(-2).join("-")}` : ""}
                    </Badge>
                </div>
                <div className="space-y-3">
                    {questions.map((q) => {
                        const answered = !!localAnswers[q.id]?.trim();
                        const confPct = Math.round(q.confidence * 100);
                        return (
                            <div
                                key={q.id}
                                className={cn(
                                    "rounded-lg border p-3",
                                    answered
                                        ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/30 dark:bg-emerald-950/10"
                                        : q.required
                                            ? "border-amber-200 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-950/10"
                                            : "border-border"
                                )}
                            >
                                <div className="flex items-start gap-2 mb-1.5">
                                    <HelpCircle className={cn(
                                        "mt-0.5 h-3.5 w-3.5 flex-shrink-0",
                                        answered ? "text-emerald-500" : q.required ? "text-amber-500" : "text-muted-foreground/50"
                                    )} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm">
                                            {q.text}
                                            {!q.required && (
                                                <span className="ml-1.5 text-[10px] text-muted-foreground">(optional)</span>
                                            )}
                                        </p>
                                        <div className="mt-1 flex items-center gap-2">
                                            {q.confidence > 0 && (
                                                <span className={cn(
                                                    "text-[10px] font-medium",
                                                    confPct >= 85 ? "text-emerald-600 dark:text-emerald-400"
                                                        : confPct >= 65 ? "text-amber-600 dark:text-amber-400"
                                                            : "text-red-600 dark:text-red-400"
                                                )}>
                                                    {confPct}% relevance
                                                </span>
                                            )}
                                            {q.rationale && (
                                                <span className="text-[10px] text-muted-foreground/60 truncate">
                                                    — {q.rationale}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {q.options && q.options.length > 0 ? (
                                    <div className="space-y-1 mt-2">
                                        {q.options.map((opt) => (
                                            <label key={opt} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name={q.id}
                                                    value={opt}
                                                    checked={localAnswers[q.id] === opt}
                                                    onChange={() => setLocalAnswers(prev => ({ ...prev, [q.id]: opt }))}
                                                    className="h-3.5 w-3.5 accent-foreground"
                                                />
                                                <span className="text-sm">{opt}</span>
                                            </label>
                                        ))}
                                        <Input
                                            placeholder="Or type a custom answer…"
                                            value={q.options.includes(localAnswers[q.id] ?? "") ? "" : (localAnswers[q.id] ?? "")}
                                            onChange={(e) => setLocalAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                            className="mt-2 text-sm"
                                        />
                                    </div>
                                ) : (
                                    <Input
                                        placeholder="Your answer…"
                                        value={localAnswers[q.id] ?? ""}
                                        onChange={(e) => setLocalAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                        className="text-sm"
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <Separator />

            {/* Assumptions */}
            {assumptions.length > 0 && (
                <div>
                    <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Assumptions
                        </p>
                        <span className="text-[10px] text-muted-foreground">
                            {assumptions.filter(a => confirmedIds.has(a.id)).length}/{assumptions.length} accepted
                        </span>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border overflow-hidden">
                        {assumptions.map((a) => {
                            const isAccepted = confirmedIds.has(a.id);
                            const toggleAssumption = () => {
                                setConfirmedIds(prev => {
                                    const next = new Set(prev);
                                    if (isAccepted) next.delete(a.id); else next.add(a.id);
                                    return next;
                                });
                            };
                            return (
                                <div
                                    key={a.id}
                                    className={cn(
                                        "flex items-start justify-between gap-3 px-3 py-2.5 transition-colors",
                                        isAccepted && "bg-emerald-50/50 dark:bg-emerald-950/10"
                                    )}
                                >
                                    <div className="flex items-start gap-2 min-w-0">
                                        <Info className={cn(
                                            "mt-0.5 h-3.5 w-3.5 flex-shrink-0",
                                            isAccepted ? "text-emerald-500" : "text-blue-500"
                                        )} />
                                        <span className="text-sm text-muted-foreground">{a.text}</span>
                                    </div>
                                    <button
                                        onClick={toggleAssumption}
                                        className={cn(
                                            "flex-shrink-0 flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors",
                                            isAccepted
                                                ? "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400"
                                                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                                        )}
                                    >
                                        {isAccepted ? (
                                            <><CheckCircle2 className="h-3 w-3" /> Accepted</>
                                        ) : "Accept"}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Risk flags */}
            {riskFlags.length > 0 && (
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Risk Flags
                    </p>
                    <div className="space-y-2">
                        {riskFlags.map((rf) => (
                            <div
                                key={rf.id}
                                className={cn(
                                    "rounded-lg border p-3",
                                    rf.severity === "high"
                                        ? "border-red-200 bg-red-50/30 dark:border-red-900/30 dark:bg-red-950/10"
                                        : "border-amber-200 bg-amber-50/20 dark:border-amber-900/30"
                                )}
                            >
                                <div className="flex items-start gap-2 text-sm">
                                    <AlertTriangle className={cn(
                                        "mt-0.5 h-3.5 w-3.5 flex-shrink-0",
                                        rf.severity === "high" ? "text-red-500" : "text-amber-500"
                                    )} />
                                    <span className="text-muted-foreground">{rf.text}</span>
                                </div>
                                {rf.evidenceSnippet && (
                                    <p className="mt-1.5 ml-5 font-mono text-[10px] text-muted-foreground/60 italic truncate">
                                        &ldquo;{rf.evidenceSnippet}&rdquo;
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Separator />

            <Button onClick={handleProceed} disabled={!canProceed || saving} className="w-full gap-2">
                {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                ) : (
                    <><Calculator className="h-4 w-4" /> Proceed to Quote Builder</>
                )}
            </Button>
            {!canProceed && (
                <p className="text-center text-xs text-muted-foreground">
                    {!requiredDone
                        ? "Answer all required questions to unlock quoting"
                        : "Accept all assumptions to continue"}
                </p>
            )}
        </div>
    );
}

// ── Step 4: Quote Builder ───────────────────────────────────────────────────

function QuoteStep({
    rfqId,
    existingQuote,
    onComplete,
}: {
    rfqId: string;
    existingQuote: Quote | null;
    onComplete: (updated: LiveRFQ) => void;
}) {
    const [generating, setGenerating] = useState(false);
    const [quote, setQuote] = useState<Quote | null>(existingQuote);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        setGenerating(true);
        setError(null);
        try {
            const res = await fetch(`/api/rfqs/${rfqId}/quote`, { method: "POST" });
            if (res.ok) {
                const updated: LiveRFQ = await res.json();
                setQuote(updated.quote);
                toast.success(`Quote: $${updated.quote?.totals.total.toLocaleString()}`);
                onComplete(updated);
            } else {
                const err = await res.json().catch(() => ({}));
                const msg = (err as { error?: string }).error ?? "Quote generation failed";
                setError(msg);
                toast.error(msg);
            }
        } catch {
            setError("Network error — check server");
            toast.error("Network error");
        } finally {
            setGenerating(false);
        }
    };

    const displayQuote = quote ?? DEMO_QUOTE;
    const isReal = !!quote;

    if (!quote) {
        return (
            <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground space-y-2">
                    <p className="flex items-center gap-2 font-medium text-foreground">
                        <Calculator className="h-4 w-4" />
                        Deterministic Pricing Engine
                    </p>
                    <p>
                        All prices computed from your shop config + confirmed field values.
                        Gemini never touches pricing.
                    </p>
                </div>
                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50/30 p-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/10 dark:text-red-400">
                        <AlertTriangle className="mb-1 h-4 w-4" />
                        {error}
                    </div>
                )}
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
            {!isReal && (
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200">
                    Demo data — click Generate to compute real quote
                </Badge>
            )}
            <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/50">
                            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Line Item</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayQuote.lineItems.map((item, i) => (
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
                            <td className="px-3 py-3 font-bold">Total</td>
                            <td className="px-3 py-3 text-right font-mono text-lg font-bold">
                                ${displayQuote.totals.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </td>
                        </tr>
                        <tr>
                            <td colSpan={2} className="px-3 py-1.5 text-xs text-muted-foreground">
                                Margin: {Math.round(displayQuote.totals.marginPct * 100)}%
                                {" · "}Overhead: {Math.round((displayQuote.totals.overheadAmount / displayQuote.totals.subtotal) * 100)}%
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <Button onClick={onComplete.bind(null, {} as LiveRFQ)} className="w-full gap-2">
                <Send className="h-4 w-4" />
                Proceed to Deliver
            </Button>
        </div>
    );
}

// ── Step 5: Deliver ─────────────────────────────────────────────────────────

function DeliverStep({ rfq }: { rfq: LiveRFQ }) {
    const quote = rfq.quote ?? DEMO_QUOTE;
    const total = quote.totals.total;
    const [pdfLoading, setPdfLoading] = useState(false);
    const [sendLoading, setSendLoading] = useState(false);
    const [sent, setSent] = useState(rfq.status === "SENT");
    const [emailTo, setEmailTo] = useState("");
    const [emailCopied, setEmailCopied] = useState(false);
    const [emailDraft, setEmailDraft] = useState(
        `Dear ${rfq.customerName.split(" ")[0]},

Thank you for sending over the RFQ for ${rfq.subject}.

We are pleased to provide the following quotation:

• Total: $${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
• Margin: ${Math.round(quote.totals.marginPct * 100)}%
• Lead Time: TBD

This quote is valid for 30 days. Please see the attached PDF for the full cost breakdown and assumptions.

Best regards,
[Your Name]
ForgeSight Manufacturing`
    );

    const handleSend = async () => {
        setSendLoading(true);
        try {
            const res = await fetch(`/api/rfqs/${rfq.id}/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    to: emailTo.trim() || "(no address)",
                    subject: `Quote — ${rfq.subject}`,
                    body: emailDraft,
                }),
            });
            if (res.ok) {
                setSent(true);
                toast.success("Quote marked as sent — audit log updated");
            } else {
                const err = await res.json().catch(() => ({}));
                toast.error((err as { error?: string }).error ?? "Send failed");
            }
        } catch {
            toast.error("Network error");
        } finally {
            setSendLoading(false);
        }
    };

    const handleDownloadPdf = async () => {
        setPdfLoading(true);
        try {
            const res = await fetch(`/api/rfqs/${rfq.id}/quote/pdf`);
            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `quote-${rfq.id.slice(0, 8).toUpperCase()}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("PDF downloaded");
            } else {
                const err = await res.json().catch(() => ({}));
                toast.error((err as { error?: string }).error ?? "PDF failed — generate quote first");
            }
        } catch {
            toast.error("PDF not available");
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
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Quote ready to deliver</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Total:</span> <span className="font-bold">${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span></div>
                    <div><span className="text-muted-foreground">Margin:</span> <span className="font-bold">{Math.round(quote.totals.marginPct * 100)}%</span></div>
                    <div><span className="text-muted-foreground">Items:</span> {quote.lineItems.length} line items</div>
                    <div><span className="text-muted-foreground">Overhead:</span> ${quote.totals.overheadAmount.toFixed(2)}</div>
                </div>
            </div>

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

            {sent ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-950/20 p-4 text-center">
                    <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-600" />
                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Quote sent</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Status updated to SENT · Audit log recorded</p>
                </div>
            ) : (
                <>
                    <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            To (email address)
                        </Label>
                        <Input
                            className="mt-1 text-sm"
                            placeholder="customer@example.com"
                            value={emailTo}
                            onChange={(e) => setEmailTo(e.target.value)}
                        />
                    </div>

                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Email Draft
                            </Label>
                            <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={copyEmail}>
                                <Copy className="h-3 w-3" />
                                {emailCopied ? "Copied!" : "Copy"}
                            </Button>
                        </div>
                        <Textarea
                            value={emailDraft}
                            onChange={(e) => setEmailDraft(e.target.value)}
                            rows={10}
                            className="resize-none font-mono text-xs"
                        />
                    </div>

                    <Button className="w-full gap-2" onClick={handleSend} disabled={sendLoading}>
                        {sendLoading ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                        ) : (
                            <><Send className="h-4 w-4" /> Mark as Sent</>
                        )}
                    </Button>
                </>
            )}
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
                <Badge variant="outline" className="ml-auto flex-shrink-0 text-[10px]">Raw RFQ</Badge>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/80">
                    {text || "(No document text — paste RFQ content)"}
                </pre>
            </div>
        </div>
    );
}

// ── Similar Jobs Panel ──────────────────────────────────────────────────────

function SimilarJobsPanel({ rfqId }: { rfqId: string }) {
    type SimilarEntry = {
        id: string;
        customerName: string;
        subject: string;
        quote: { lineItems: Array<{ label: string; amount: number; type: string }>; totals: { total: number; marginPct: number } } | null;
        score: number;
        reasons: string[];
    };
    const [similar, setSimilar] = useState<SimilarEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/rfqs/${rfqId}/similar`)
            .then(r => r.ok ? r.json() : null)
            .then(async (data) => {
                if (!data) return;
                // API returns {results: [{id, score, reasons}]}
                const results: Array<{ id: string; score: number; reasons: string[] }> =
                    Array.isArray(data) ? data : (data.results ?? []);
                // Enrich with RFQ data
                const enriched = await Promise.all(
                    results.slice(0, 3).map(async (r) => {
                        try {
                            const rfqRes = await fetch(`/api/rfqs/${r.id}`);
                            const rfq = rfqRes.ok ? await rfqRes.json() : {};
                            return {
                                id: r.id,
                                customerName: rfq.customerName ?? r.id.slice(0, 8),
                                subject: rfq.subject ?? "—",
                                quote: rfq.quote ?? null,
                                score: r.score,
                                reasons: r.reasons ?? [],
                            };
                        } catch {
                            return { id: r.id, customerName: r.id.slice(0, 8), subject: "—", quote: null, score: r.score, reasons: r.reasons ?? [] };
                        }
                    })
                );
                setSimilar(enriched);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [rfqId]);

    return (
        <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Similar Jobs
                </span>
            </div>
            <div className="divide-y divide-border">
                {loading && (
                    <div className="p-2 space-y-1">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                )}
                {!loading && similar.length === 0 && (
                    <p className="px-3 py-3 text-[11px] text-muted-foreground">
                        No similar jobs yet — quote a few RFQs first.
                    </p>
                )}
                {similar.map((s) => {
                    const isExpanded = expandedTemplate === s.id;
                    return (
                        <div key={s.id}>
                            {/* Job row */}
                            <Link
                                href={`/rfqs/${s.id}`}
                                className="flex flex-col gap-0.5 px-3 py-2 hover:bg-accent/40 transition-colors"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-medium truncate">{s.customerName}</p>
                                    <span className="flex-shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">
                                        {s.score}pt
                                    </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground truncate">{s.subject}</p>
                                {s.reasons.length > 0 && (
                                    <p className="text-[10px] text-muted-foreground/60 truncate">
                                        {s.reasons[0]}
                                    </p>
                                )}
                            </Link>

                            {/* Quote total + "Use as template" toggle */}
                            {s.quote && (
                                <div className="flex items-center justify-between gap-2 border-t border-border/50 bg-muted/20 px-3 py-1.5">
                                    <span className="font-mono text-[11px] font-semibold">
                                        ${s.quote.totals.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                    </span>
                                    <button
                                        onClick={() => setExpandedTemplate(isExpanded ? null : s.id)}
                                        className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {isExpanded ? "Hide" : "Use as template"}
                                        <ChevronRight className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")} />
                                    </button>
                                </div>
                            )}

                            {/* Expanded template view */}
                            {isExpanded && s.quote && (
                                <div className="border-t border-border bg-muted/30 px-3 py-2 space-y-1">
                                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        Reference Breakdown
                                    </p>
                                    {s.quote.lineItems.map((item, i) => (
                                        <div key={i} className="flex items-center justify-between gap-2">
                                            <span className="text-[11px] text-muted-foreground truncate">{item.label}</span>
                                            <span className="flex-shrink-0 font-mono text-[11px] font-medium tabular-nums">
                                                ${item.amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-1">
                                        <span className="text-[11px] font-bold">Total</span>
                                        <span className="font-mono text-[11px] font-bold">
                                            ${s.quote.totals.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground/60">
                                        {Math.round(s.quote.totals.marginPct * 100)}% margin · reference only
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function RfqDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);

    const [rfq, setRfq] = useState<LiveRFQ | null>(null);
    const [loadingRfq, setLoadingRfq] = useState(true);
    const [activeStep, setActiveStep] = useState(1);
    const [stepStates, setStepStates] = useState<StepState[]>([
        "active", "pending", "pending", "pending", "pending",
    ]);

    // Load RFQ from API (with mock fallback for demo IDs)
    useEffect(() => {
        const mockRfq = id.startsWith("rfq-")
            ? ({ id, customerName: DEMO_RFQ.customerName, subject: DEMO_RFQ.subject, status: "NEW", rawText: DEMO_RFQ.rawText, extractedFields: [], clarifier: undefined, clarifierAnswers: {}, confirmedAssumptions: [], quote: null, createdAt: new Date().toISOString() } as LiveRFQ)
            : null;

        fetch(`/api/rfqs/${id}`)
            .then(r => r.ok ? r.json() : null)
            .then((data: LiveRFQ | null) => {
                if (data) {
                    setRfq(data);
                    // Determine initial step from status + data
                    const statusStep = statusToStep(data.status);
                    const hasExtracted = data.extractedFields.length > 0;
                    const hasQuote = !!data.quote;
                    let step = statusStep + 1;
                    if (!hasExtracted) step = 1;
                    else if (hasQuote) step = 5;
                    setActiveStep(step);
                    // Mark completed steps
                    setStepStates(prev => {
                        const next = [...prev];
                        for (let i = 0; i < step - 1; i++) next[i] = "complete";
                        if (step - 1 < next.length) next[step - 1] = "active";
                        return next;
                    });
                } else if (mockRfq) {
                    setRfq(mockRfq);
                }
            })
            .catch(() => { if (mockRfq) setRfq(mockRfq); })
            .finally(() => setLoadingRfq(false));
    }, [id]);

    const handleRfqUpdate = useCallback((updated: LiveRFQ) => {
        if (updated?.id) setRfq(updated);
    }, []);

    const completeStep = useCallback((stepIdx: number, updated?: LiveRFQ) => {
        if (updated?.id) setRfq(updated);
        setStepStates(prev => {
            const next = [...prev];
            next[stepIdx] = "complete";
            if (stepIdx + 1 < next.length) {
                next[stepIdx + 1] = "active";
                setActiveStep(stepIdx + 2);
            }
            return next;
        });
    }, []);

    const completedCount = stepStates.filter(s => s === "complete").length;
    const progressPct = (completedCount / STEPS.length) * 100;

    if (loadingRfq || !rfq) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading RFQ…</p>
                </div>
            </div>
        );
    }

    const renderStepContent = () => {
        switch (activeStep) {
            case 1:
                return (
                    <ExtractStep
                        rfqId={rfq.id}
                        alreadyExtracted={rfq.extractedFields.length > 0}
                        onComplete={(updated) => completeStep(0, updated)}
                    />
                );
            case 2:
                return (
                    <ReviewStep
                        rfqId={rfq.id}
                        fields={rfq.extractedFields}
                        onComplete={(updated) => completeStep(1, updated)}
                    />
                );
            case 3:
                return (
                    <ClarifyStep
                        rfqId={rfq.id}
                        clarifier={rfq.clarifier}
                        savedAnswers={rfq.clarifierAnswers}
                        savedAssumptions={rfq.confirmedAssumptions}
                        onRfqUpdate={handleRfqUpdate}
                        onComplete={(updated) => completeStep(2, updated)}
                    />
                );
            case 4:
                return (
                    <QuoteStep
                        rfqId={rfq.id}
                        existingQuote={rfq.quote}
                        onComplete={(updated) => {
                            if (updated?.id) setRfq(updated);
                            completeStep(3, updated);
                        }}
                    />
                );
            case 5:
                return <DeliverStep rfq={rfq} />;
            default:
                return null;
        }
    };

    const riskLevel = rfq.extractedFields.length > 0
        ? (() => {
            const avg = rfq.extractedFields.reduce((s, f) => s + f.confidence, 0) / rfq.extractedFields.length;
            return avg >= 0.85 ? "LOW" : avg >= 0.7 ? "MEDIUM" : "HIGH";
        })()
        : "—";

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
                    {riskLevel !== "—" && (
                        <Badge
                            variant="outline"
                            className={cn(
                                "text-[10px]",
                                riskLevel === "HIGH" ? "border-red-200 text-red-600"
                                    : riskLevel === "MEDIUM" ? "border-amber-200 text-amber-600"
                                        : "border-emerald-200 text-emerald-600"
                            )}
                        >
                            {riskLevel} RISK
                        </Badge>
                    )}
                    <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                        {rfq.status}
                    </Badge>
                </div>
            </header>

            {/* ── Body ── */}
            <div className="flex flex-1 overflow-hidden">
                {/* Document viewer */}
                <div className="hidden w-[42%] border-r border-border lg:flex lg:flex-col">
                    <DocumentViewer
                        text={rfq.rawText}
                        title={`${rfq.customerName} — ${rfq.id.slice(0, 8).toUpperCase()}`}
                    />
                </div>

                {/* Right side: stepper nav + content */}
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
                            <div className="mx-auto max-w-[560px]">
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
                            <SimilarJobsPanel rfqId={rfq.id} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
