"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { QuoteCard } from "@/components/quote-card";
import { ShopConfigSheet } from "@/components/shop-config-sheet";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, RefreshCw, Loader2, Clock, CalendarCheck, ListChecks, ShieldCheck } from "lucide-react";
import type { RFQ, ShopConfig } from "@/core/types";
import { DEFAULT_SHOP_CONFIG, RFQStatus } from "@/core/types";
import { toast } from "sonner";

// ── Lead-time rule engine (deterministic, no AI) ──────────────────────────────

function estimateLeadTime(rfq: RFQ): string {
    const qtyField = rfq.extractedFields.find((f) => f.key === "quantity");
    const qtyRaw = qtyField ? (qtyField.userOverrideValue ?? qtyField.value) : "0";
    const qty = parseInt(qtyRaw.replace(/[^\d]/g, ""), 10) || 0;

    const matField = rfq.extractedFields.find((f) => f.key === "material");
    const mat = (matField ? (matField.userOverrideValue ?? matField.value) : "").toLowerCase();

    const isTitanium = /titanium|ti-6/i.test(mat);
    const isStainless = /stainless|316|304/i.test(mat);
    const isMedical = /medical|implant|iso 13485/i.test(rfq.rawText.toLowerCase());

    if (qty === 0 || isTitanium || isMedical) return "4–6 weeks ARO";
    if (qty <= 10) return "2–3 weeks ARO";
    if (qty <= 100) return "3–4 weeks ARO";
    if (qty <= 500 || isStainless) return "4–6 weeks ARO";
    return "6–10 weeks ARO";
}

function quoteValidUntil(): string {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Small stat tile ───────────────────────────────────────────────────────────

function StatTile({
    icon: Icon,
    label,
    value,
    sub,
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    sub?: string;
}) {
    return (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <Icon className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold leading-tight">{value}</p>
                {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QuoteBuilderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [rfq, setRfq] = useState<RFQ | null>(null);
    const [loading, setLoading] = useState(true);
    const [regenerating, setRegenerating] = useState(false);
    const [shopConfig, setShopConfig] = useState<ShopConfig>(DEFAULT_SHOP_CONFIG);

    const fetchRfq = useCallback(async () => {
        try {
            const res = await fetch(`/api/rfqs/${id}`);
            if (!res.ok) { router.push("/inbox"); return; }
            const data = await res.json();
            setRfq(data);
            if (!data.quote) router.push(`/rfq/${id}`);
        } finally {
            setLoading(false);
        }
    }, [id, router]);

    useEffect(() => { fetchRfq(); }, [fetchRfq]);

    const handleRegenerate = async () => {
        setRegenerating(true);
        try {
            const res = await fetch(`/api/rfqs/${id}/quote`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ shopConfig }),
            });
            if (res.ok) {
                const data = await res.json();
                setRfq(data);
                toast.success("Quote regenerated with updated rates");
            }
        } finally {
            setRegenerating(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 lg:p-8 space-y-4">
                <Skeleton className="h-8 w-64" />
                <div className="grid grid-cols-2 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
                </div>
            </div>
        );
    }

    if (!rfq || !rfq.quote) return null;

    const quote = rfq.quote;
    const totalFields = rfq.extractedFields.length;
    const confirmedCount = rfq.extractedFields.filter((f) => f.isConfirmed || f.confidence >= 0.85).length;
    const pendingCount = totalFields - confirmedCount;
    const allReviewed = pendingCount === 0 && totalFields > 0;
    const leadTime = estimateLeadTime(rfq);
    const validUntil = quoteValidUntil();

    return (
        <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-4 mb-1">
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/rfq/${id}`)} className="gap-1.5">
                        <ArrowLeft className="h-4 w-4" />
                        Review
                    </Button>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight">Quote Builder</h1>
                            <StatusBadge status={rfq.status} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {rfq.customerName} — {rfq.subject}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <ShopConfigSheet config={shopConfig} onConfigChange={setShopConfig} />
                        <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating} className="gap-1.5">
                            {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            Regenerate
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Commercial Summary ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <StatTile
                    icon={Clock}
                    label="Est. Lead Time"
                    value={leadTime}
                    sub="Rule-based estimate"
                />
                <StatTile
                    icon={CalendarCheck}
                    label="Quote Validity"
                    value="30 days"
                    sub={`Expires ${validUntil}`}
                />
                <StatTile
                    icon={ListChecks}
                    label="Assumptions"
                    value={`${quote.assumptions.length}`}
                    sub="Shop rates + overhead"
                />
                <StatTile
                    icon={ShieldCheck}
                    label="Field Coverage"
                    value={`${confirmedCount} / ${totalFields}`}
                    sub={allReviewed ? "All reviewed ✓" : `${pendingCount} pending`}
                />
            </div>

            {/* Cost breakdown cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
                {quote.lineItems.map((item, i) => (
                    <QuoteCard key={i} item={item} />
                ))}
            </div>

            <Separator className="my-6" />

            {/* Totals */}
            <Card className="mb-6">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Quote Summary
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="tabular-nums font-medium">
                                ${quote.totals.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                                Overhead ({Math.round(quote.totals.overheadPct * 100)}%)
                            </span>
                            <span className="tabular-nums font-medium">
                                ${quote.totals.overheadAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                                Margin ({Math.round(quote.totals.marginPct * 100)}%)
                            </span>
                            <span className="tabular-nums font-medium">
                                ${quote.totals.marginAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-lg font-bold">
                            <span>Total</span>
                            <span className="tabular-nums">
                                ${quote.totals.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            Per-unit price: ${totalFields > 0
                                ? (() => {
                                    const qf = rfq.extractedFields.find(f => f.key === "quantity");
                                    const qty = qf ? parseInt((qf.userOverrideValue ?? qf.value).replace(/[^\d]/g, ""), 10) || 1 : 1;
                                    return (quote.totals.total / qty).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                })()
                                : "—"}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Assumptions */}
            {quote.assumptions.length > 0 && (
                <Card className="mb-6">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            Assumptions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-1">
                            {quote.assumptions.map((a, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                    <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                                    {a}
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}

            {/* CTA */}
            <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    Priced by deterministic engine · AI does not set prices
                </Badge>
                <Button
                    size="lg"
                    className="gap-2"
                    onClick={() => router.push(`/rfq/${id}/send`)}
                    disabled={rfq.status === RFQStatus.SENT}
                >
                    {rfq.status === RFQStatus.SENT ? "Already Sent" : "Ready to Send"}
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
