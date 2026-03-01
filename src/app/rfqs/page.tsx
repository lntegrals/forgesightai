"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Plus,
    Upload,
    Sparkles,
    Search,
    ArrowRight,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Circle,
    Zap,
    MessageSquare,
    Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MOCK_RFQS, DEMO_RFQ, TAB_FILTERS, type MockRFQ, type UiStatus } from "@/lib/mock-rfqs";
import { toast } from "sonner";

// ── Risk Badge ──────────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: MockRFQ["risk"] }) {
    const config = {
        LOW: { label: "Low", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
        MEDIUM: { label: "Medium", className: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
        HIGH: { label: "High", className: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
        CRITICAL: { label: "Critical", className: "bg-red-200 text-red-800 dark:bg-red-950/60 dark:text-red-300" },
    }[level];

    return (
        <Badge variant="secondary" className={cn("border-0 text-[10px] font-semibold uppercase tracking-wide", config.className)}>
            {level === "HIGH" || level === "CRITICAL" ? (
                <AlertTriangle className="mr-1 h-2.5 w-2.5" />
            ) : (
                <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
            )}
            {config.label}
        </Badge>
    );
}

// ── Status Badge ────────────────────────────────────────────────────────────

function UiStatusBadge({ status }: { status: UiStatus }) {
    const config: Record<UiStatus, { label: string; className: string; icon: React.ElementType }> = {
        needs_review: { label: "Needs Review", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400", icon: AlertTriangle },
        needs_answers: { label: "Needs Answers", className: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400", icon: MessageSquare },
        ready_to_quote: { label: "Ready to Quote", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400", icon: CheckCircle2 },
        sent: { label: "Sent", className: "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400", icon: ArrowRight },
        completed: { label: "Completed", className: "bg-gray-100 text-gray-500 dark:bg-gray-800/40 dark:text-gray-500", icon: Circle },
    };
    const { label, className, icon: Icon } = config[status];
    return (
        <Badge variant="secondary" className={cn("border-0 text-[10px] font-semibold gap-1", className)}>
            <Icon className="h-2.5 w-2.5" />
            {label}
        </Badge>
    );
}

// ── Confidence Bar ──────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
    const pct = Math.round(value * 100);
    const color = pct >= 85 ? "bg-emerald-500" : pct >= 65 ? "bg-amber-500" : "bg-red-500";
    return (
        <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full transition-all", color)} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
        </div>
    );
}

// ── New RFQ Dialog ──────────────────────────────────────────────────────────

function NewRfqDialog({ onCreated }: { onCreated: () => void }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ customerName: "", subject: "", rawText: "" });
    const [loading, setLoading] = useState(false);

    const valid = form.customerName.trim() && form.subject.trim() && form.rawText.trim();

    const handleSubmit = async () => {
        if (!valid) return;
        setLoading(true);
        try {
            const res = await fetch("/api/rfqs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                toast.success("RFQ created");
                setForm({ customerName: "", subject: "", rawText: "" });
                setOpen(false);
                onCreated();
            } else {
                toast.error("Failed to create RFQ");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    New RFQ
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>Create New RFQ</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    <div>
                        <Label htmlFor="customer" className="text-xs">Customer Name</Label>
                        <Input
                            id="customer"
                            placeholder="Acme Manufacturing"
                            value={form.customerName}
                            onChange={(e) => setForm(f => ({ ...f, customerName: e.target.value }))}
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <Label htmlFor="subject" className="text-xs">Subject</Label>
                        <Input
                            id="subject"
                            placeholder="CNC Shaft — Qty 50, Ti-6Al-4V"
                            value={form.subject}
                            onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <Label htmlFor="rawText" className="text-xs">
                            RFQ Text <span className="text-muted-foreground">(paste email or document)</span>
                        </Label>
                        <Textarea
                            id="rawText"
                            rows={8}
                            placeholder="Paste your RFQ here…"
                            value={form.rawText}
                            onChange={(e) => setForm(f => ({ ...f, rawText: e.target.value }))}
                            className="mt-1 resize-none"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={!valid || loading}>
                            {loading ? "Creating…" : "Create RFQ"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Ask ForgeSight Panel ────────────────────────────────────────────────────

// ── Ask Result type ──────────────────────────────────────────────────────────

interface AskResult {
    answerMarkdown: string | null;
    summaryError: string | null;
    usedFallbackPlan?: boolean;
    citations: string[];
    results: Array<{ id: string; customerName: string; subject: string; status: string; totalQuoted?: number }>;
}

function AskPanel() {
    const [query, setQuery] = useState("");
    const [result, setResult] = useState<AskResult | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleAsk = async (q?: string) => {
        const question = (q ?? query).trim();
        if (!question) return;
        if (q) setQuery(q);
        setLoading(true);
        setResult(null);
        setErrorMsg(null);
        try {
            const res = await fetch("/api/assistant/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question }),
            });
            const data = await res.json();
            if (!res.ok) {
                const msg = (data as { error?: string }).error ?? "AI assistant error";
                const is429 = msg.includes("429");
                setErrorMsg(is429
                    ? "Gemini is rate-limited — wait a few seconds and try again."
                    : msg);
                return;
            }
            setResult({
                answerMarkdown: data.answerMarkdown ?? null,
                summaryError: data.summaryError ?? null,
                usedFallbackPlan: data.usedFallbackPlan ?? false,
                citations: data.citations ?? [],
                results: data.results ?? [],
            });
        } catch {
            setErrorMsg("Connection error — is the dev server running?");
        } finally {
            setLoading(false);
        }
    };

    const SUGGESTIONS = [
        "Show all RFQs in the pipeline",
        "Which RFQs have a quote ready?",
        "List sent quotes",
        "What's quoted for aluminum parts?",
    ];

    const hasResults = (result?.results?.length ?? 0) > 0;
    const is429Summary = result?.summaryError?.includes("429");

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Sparkles className="h-4 w-4 text-violet-500" />
                <span className="text-sm font-semibold">Ask ForgeSight</span>
                <Badge variant="outline" className="ml-auto text-[9px] border-violet-200 text-violet-600 dark:border-violet-900/50 dark:text-violet-400">
                    Gemini
                </Badge>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {/* Suggestions */}
                {!result && !errorMsg && !loading && (
                    <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Try asking</p>
                        {SUGGESTIONS.map((s) => (
                            <button
                                key={s}
                                onClick={() => handleAsk(s)}
                                className="w-full rounded-lg border border-border px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Gemini is thinking…
                        </div>
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-4/5" />
                        <Skeleton className="h-3 w-3/4" />
                    </div>
                )}

                {/* Error */}
                {errorMsg && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20 p-3">
                        <p className="text-xs text-amber-700 dark:text-amber-400">{errorMsg}</p>
                        <button onClick={() => { setErrorMsg(null); setResult(null); }} className="mt-2 text-[11px] text-muted-foreground hover:text-foreground underline">
                            Clear
                        </button>
                    </div>
                )}

                {/* AI answer */}
                {result?.answerMarkdown && (
                    <div className={cn(
                        "rounded-lg border p-3",
                        result.usedFallbackPlan
                            ? "border-border bg-muted/40"
                            : "border-violet-200/60 bg-violet-50/40 dark:border-violet-900/30 dark:bg-violet-950/10"
                    )}>
                        <div className="mb-1.5 flex items-center gap-1.5">
                            <Sparkles className={cn("h-3 w-3", result.usedFallbackPlan ? "text-muted-foreground" : "text-violet-500")} />
                            <span className={cn("text-[10px] font-semibold uppercase tracking-wider", result.usedFallbackPlan ? "text-muted-foreground" : "text-violet-600 dark:text-violet-400")}>
                                {result.usedFallbackPlan ? "Search Results" : "Gemini Answer"}
                            </span>
                        </div>
                        <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                            {result.answerMarkdown}
                        </p>
                    </div>
                )}

                {/* Rate-limit fallback: show raw results */}
                {result && !result.answerMarkdown && is429Summary && hasResults && (
                    <div className="rounded-lg border border-amber-200/60 bg-amber-50/30 dark:border-amber-900/30 p-2">
                        <p className="mb-1.5 text-[10px] text-amber-600 dark:text-amber-400">Summarizer rate-limited — showing raw results:</p>
                    </div>
                )}

                {/* Result rows (always shown when present) */}
                {hasResults && (
                    <div className="space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                            {result!.results.length} result{result!.results.length !== 1 ? "s" : ""}
                        </p>
                        {result!.results.slice(0, 5).map((r) => (
                            <Link
                                key={r.id}
                                href={`/rfqs/${r.id}`}
                                className="flex flex-col gap-0.5 rounded-md border border-border px-2.5 py-2 hover:bg-accent transition-colors"
                            >
                                <p className="truncate text-xs font-medium">{r.customerName}</p>
                                <p className="truncate text-[10px] text-muted-foreground">{r.subject}</p>
                                <div className="flex items-center gap-2">
                                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-mono font-semibold text-muted-foreground">{r.status}</span>
                                    {r.totalQuoted != null && (
                                        <span className="text-[10px] font-mono font-semibold">
                                            ${r.totalQuoted.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                        </span>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* No results */}
                {result && !hasResults && !result.answerMarkdown && !is429Summary && (
                    <p className="text-xs text-muted-foreground">No matching RFQs found.</p>
                )}

                {/* Reset link */}
                {(result || errorMsg) && (
                    <button onClick={() => { setResult(null); setErrorMsg(null); setQuery(""); }} className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground underline">
                        Ask another question
                    </button>
                )}
            </div>
            <div className="border-t border-border p-3">
                <div className="flex gap-2">
                    <Input
                        placeholder="Ask anything about your RFQs…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                        className="text-xs"
                    />
                    <Button size="sm" onClick={() => handleAsk()} disabled={!query.trim() || loading}>
                        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ── Tab Config ──────────────────────────────────────────────────────────────

const TABS = [
    { id: "review", label: "Needs Review" },
    { id: "answers", label: "Needs Answers" },
    { id: "ready", label: "Ready to Quote" },
    { id: "sent", label: "Sent" },
    { id: "completed", label: "Completed" },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Main Page ───────────────────────────────────────────────────────────────

export default function RfqsPage() {
    const router = useRouter();
    const [tab, setTab] = useState<TabId>("review");
    const [search, setSearch] = useState("");
    const [rfqs, setRfqs] = useState<MockRFQ[]>(MOCK_RFQS);
    const [loadingDemo, setLoadingDemo] = useState(false);

    // Auto-load from live API on mount
    useEffect(() => { refreshFromApi(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const filtered = useMemo(() => {
        const statuses = TAB_FILTERS[tab] ?? [];
        return rfqs.filter((r) => {
            const matchesTab = statuses.includes(r.status);
            const matchesSearch =
                !search ||
                r.customerName.toLowerCase().includes(search.toLowerCase()) ||
                r.subject.toLowerCase().includes(search.toLowerCase());
            return matchesTab && matchesSearch;
        });
    }, [rfqs, tab, search]);

    const counts = useMemo(() => {
        const map: Record<string, number> = {};
        for (const t of TABS) {
            map[t.id] = rfqs.filter((r) => TAB_FILTERS[t.id]?.includes(r.status)).length;
        }
        return map;
    }, [rfqs]);

    const refreshFromApi = async () => {
        try {
            const res = await fetch("/api/rfqs");
            if (!res.ok) return;
            const data = await res.json();
            if (!Array.isArray(data)) return;
            const mapped: MockRFQ[] = data.map((r: {
                id: string; customerName: string; subject: string;
                status: string; rawText?: string; extractedFields?: Array<{ confidence: number }>;
                createdAt?: string;
            }) => ({
                id: r.id,
                customerName: r.customerName,
                subject: r.subject,
                status: mapApiStatus(r.status),
                risk: computeRisk(r.extractedFields ?? []),
                updatedAt: r.createdAt ? timeAgo(r.createdAt) : "just now",
                confidence: avgConfidence(r.extractedFields ?? []),
                rawText: r.rawText ?? "",
            }));
            setRfqs(mapped.length > 0 ? mapped : MOCK_RFQS);
        } catch {
            setRfqs(MOCK_RFQS);
        }
    };

    const handleLoadDemo = async () => {
        setLoadingDemo(true);
        try {
            // Create a fresh demo RFQ via the API and navigate to it
            const res = await fetch("/api/rfqs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerName: DEMO_RFQ.customerName,
                    subject: DEMO_RFQ.subject,
                    rawText: DEMO_RFQ.rawText,
                }),
            });
            if (res.ok) {
                const created = await res.json();
                toast.success("Demo RFQ created — opening stepper");
                await refreshFromApi();
                router.push(`/rfqs/${created.id}`);
                return;
            }
        } catch { /* fall through */ }
        // Offline fallback: just show mocks in the list
        setRfqs(MOCK_RFQS);
        toast.success("Loaded 5 demo RFQs (offline mode)");
        setLoadingDemo(false);
    };

    return (
        <div className="flex h-screen flex-col overflow-hidden">
            {/* ── Header ── */}
            <header className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">RFQs</h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        {rfqs.length} quote request{rfqs.length !== 1 ? "s" : ""} in pipeline
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-muted-foreground"
                        onClick={handleLoadDemo}
                        disabled={loadingDemo}
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        {loadingDemo ? "Loading…" : "Load Demo RFQ"}
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 text-muted-foreground" disabled>
                        <Upload className="h-3.5 w-3.5" />
                        Upload RFQ
                    </Button>
                    <NewRfqDialog onCreated={refreshFromApi} />
                </div>
            </header>

            {/* ── Body ── */}
            <div className="flex flex-1 overflow-hidden">
                {/* Main content */}
                <div className="flex flex-1 flex-col overflow-hidden">
                    {/* Search */}
                    <div className="border-b border-border bg-background px-6 py-3">
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search customer, subject…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 text-sm"
                            />
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="border-b border-border bg-background px-6">
                        <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
                            <TabsList className="h-auto bg-transparent p-0 gap-0">
                                {TABS.map((t) => (
                                    <TabsTrigger
                                        key={t.id}
                                        value={t.id}
                                        className={cn(
                                            "relative rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium text-muted-foreground transition-colors",
                                            "hover:text-foreground",
                                            "data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none",
                                            "data-[state=active]:bg-transparent"
                                        )}
                                    >
                                        {t.label}
                                        {counts[t.id] > 0 && (
                                            <span className={cn(
                                                "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                                                tab === t.id
                                                    ? "bg-foreground text-background"
                                                    : "bg-muted text-muted-foreground"
                                            )}>
                                                {counts[t.id]}
                                            </span>
                                        )}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                                <div className="rounded-full bg-muted p-4">
                                    <Clock className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="font-semibold text-foreground">No RFQs here</p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {search
                                            ? `No results for "${search}"`
                                            : "Nothing in this queue yet."}
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleLoadDemo}
                                >
                                    Load Demo RFQs
                                </Button>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="w-[180px] text-xs font-semibold text-muted-foreground">Customer</TableHead>
                                        <TableHead className="text-xs font-semibold text-muted-foreground">Subject</TableHead>
                                        <TableHead className="w-[160px] text-xs font-semibold text-muted-foreground">Status</TableHead>
                                        <TableHead className="w-[100px] text-xs font-semibold text-muted-foreground">Risk</TableHead>
                                        <TableHead className="w-[120px] text-xs font-semibold text-muted-foreground">AI Confidence</TableHead>
                                        <TableHead className="w-[100px] text-xs font-semibold text-muted-foreground">Updated</TableHead>
                                        <TableHead className="w-[80px]" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((rfq) => (
                                        <TableRow
                                            key={rfq.id}
                                            className="group cursor-pointer border-border transition-colors hover:bg-accent/40"
                                            onClick={() => router.push(`/rfqs/${rfq.id}`)}
                                        >
                                            <TableCell className="py-3.5 font-medium text-sm">
                                                {rfq.customerName}
                                            </TableCell>
                                            <TableCell className="py-3.5 max-w-[280px]">
                                                <p className="truncate text-sm">{rfq.subject}</p>
                                            </TableCell>
                                            <TableCell className="py-3.5">
                                                <UiStatusBadge status={rfq.status} />
                                            </TableCell>
                                            <TableCell className="py-3.5">
                                                <RiskBadge level={rfq.risk} />
                                            </TableCell>
                                            <TableCell className="py-3.5">
                                                <ConfidenceBar value={rfq.confidence} />
                                            </TableCell>
                                            <TableCell className="py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                                                {rfq.updatedAt}
                                            </TableCell>
                                            <TableCell className="py-3.5">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 gap-1 px-2 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/rfqs/${rfq.id}`);
                                                    }}
                                                >
                                                    Open
                                                    <ArrowRight className="h-3 w-3" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </div>

                {/* Ask ForgeSight panel */}
                <div className="hidden w-[280px] flex-col border-l border-border xl:flex">
                    <AskPanel />
                </div>
            </div>
        </div>
    );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapApiStatus(apiStatus: string): UiStatus {
    const map: Record<string, UiStatus> = {
        NEW: "needs_review",
        EXTRACTED: "needs_review",
        NEEDS_REVIEW: "needs_review",
        NEEDS_CLARIFICATION: "needs_answers",
        READY_TO_SEND: "ready_to_quote",
        SENT: "sent",
        COMPLETED: "completed",
    };
    return map[apiStatus] ?? "needs_review";
}

function computeRisk(fields: Array<{ confidence: number }>): MockRFQ["risk"] {
    if (!fields.length) return "MEDIUM";
    const avg = fields.reduce((s, f) => s + f.confidence, 0) / fields.length;
    if (avg >= 0.9) return "LOW";
    if (avg >= 0.75) return "MEDIUM";
    if (avg >= 0.6) return "HIGH";
    return "CRITICAL";
}

function avgConfidence(fields: Array<{ confidence: number }>): number {
    if (!fields.length) return 0.5;
    return fields.reduce((s, f) => s + f.confidence, 0) / fields.length;
}

function timeAgo(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}
