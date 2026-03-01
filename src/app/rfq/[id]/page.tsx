"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { DocumentViewer } from "@/components/document-viewer";
import { FieldRow } from "@/components/field-row";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Sparkles, AlertTriangle, CheckCircle, Loader2,
  HelpCircle, ShieldAlert, TrendingUp, ExternalLink,
} from "lucide-react";
import type { RFQ, ExtractedField, ClarifierOutput } from "@/core/types";
import { RFQStatus, AuditAction } from "@/core/types";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

type SimilarResult = { id: string; score: number; reasons: string[] };

// ── Sub-components ───────────────────────────────────────────────────────────

function EngineBadge({ engine }: { engine?: string }) {
  if (!engine) return null;
  const isGemini = engine === "gemini";
  return (
    <Badge
      variant="outline"
      className={
        isGemini
          ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-300"
          : "border-muted bg-muted/40 text-muted-foreground"
      }
    >
      {isGemini ? "✦ Gemini" : "Mock"}
    </Badge>
  );
}

function SeverityBadge({ severity }: { severity: "low" | "med" | "high" }) {
  const cls = {
    high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    med: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    low: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  }[severity];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${cls}`}>
      {severity}
    </span>
  );
}

function ClarifierPanel({
  rfqId,
  clarifier,
  clarifierAnswers,
  confirmedAssumptions,
  onSaved,
}: {
  rfqId: string;
  clarifier: ClarifierOutput;
  clarifierAnswers: Record<string, string>;
  confirmedAssumptions: string[];
  onSaved: (rfq: RFQ) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>(clarifierAnswers);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set(confirmedAssumptions));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/rfqs/${rfqId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clarifierAnswers: answers,
          confirmedAssumptions: Array.from(confirmed),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onSaved(data);
        toast.success("Clarifier responses saved");
      } else {
        toast.error("Failed to save clarifier responses");
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleAssumption = (id: string) => {
    setConfirmed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card mt-4">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <HelpCircle className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Clarifier</span>
        <Badge variant="outline" className="ml-auto text-[10px]">
          {clarifier.engine}
        </Badge>
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* Risk Flags */}
        {clarifier.riskFlags.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Risk Flags
            </p>
            <div className="space-y-1.5">
              {clarifier.riskFlags.map((flag) => (
                <div key={flag.id} className="flex items-start gap-2">
                  <ShieldAlert className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">{flag.label}</span>
                      <SeverityBadge severity={flag.severity} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 italic">
                      &ldquo;{flag.evidenceSnippet}&rdquo;
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Questions */}
        {clarifier.questions.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Questions
            </p>
            <div className="space-y-3">
              {clarifier.questions.map((q) => (
                <div key={q.id}>
                  <Label htmlFor={`cq-${q.id}`} className="text-xs font-medium">
                    {q.question}
                    {q.required && (
                      <span className="ml-1 text-red-500">*</span>
                    )}
                  </Label>
                  {q.options && q.options.length > 0 ? (
                    <select
                      id={`cq-${q.id}`}
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    >
                      <option value="">Select…</option>
                      {q.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={`cq-${q.id}`}
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder="Your answer…"
                      className="mt-1 h-8 text-sm"
                    />
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">{q.rationale}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assumptions */}
        {clarifier.assumptions.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Assumptions — confirm to proceed
            </p>
            <div className="space-y-2">
              {clarifier.assumptions.map((a) => (
                <div key={a.id} className="flex items-start gap-2">
                  <Checkbox
                    id={`ca-${a.id}`}
                    checked={confirmed.has(a.id)}
                    onCheckedChange={() => toggleAssumption(a.id)}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor={`ca-${a.id}`}
                    className="text-xs leading-relaxed cursor-pointer"
                  >
                    {a.assumption}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button size="sm" onClick={handleSave} disabled={saving} className="w-full gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {saving ? "Saving…" : "Save Clarifier Responses"}
        </Button>
      </div>
    </div>
  );
}

function SimilarPanel({ rfqId }: { rfqId: string }) {
  const [results, setResults] = useState<SimilarResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/rfqs/${rfqId}/similar`)
      .then((r) => r.json())
      .then((d: { results: SimilarResult[] }) => {
        setResults(d.results ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [rfqId]);

  return (
    <div className="rounded-lg border border-border bg-card mt-4">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Similar Quotes</span>
      </div>
      <div className="px-4 py-3">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : results.length === 0 ? (
          <p className="text-xs text-muted-foreground">No similar quotes found.</p>
        ) : (
          <div className="space-y-2">
            {results.map((r) => (
              <a
                key={r.id}
                href={`/rfq/${r.id}`}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 hover:bg-accent transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{r.id.slice(0, 8)}…</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {r.reasons.slice(0, 2).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="text-xs font-semibold text-muted-foreground">{r.score}%</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function RFQReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeSnippet, setActiveSnippet] = useState<string | null>(null);

  const fetchRfq = useCallback(async () => {
    try {
      const res = await fetch(`/api/rfqs/${id}`);
      if (!res.ok) { router.push("/inbox"); return; }
      const data = await res.json();
      setRfq(data);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchRfq();
  }, [fetchRfq]);

  // Auto-extract for NEW status
  useEffect(() => {
    if (rfq?.status === RFQStatus.NEW && !extracting) {
      handleExtract();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfq?.status]);

  const handleExtract = async () => {
    setExtracting(true);
    try {
      const res = await fetch(`/api/rfqs/${id}/extract`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setRfq(data);
        const engine = data.extractionMeta?.engine ?? "mock";
        toast.success(`Fields extracted (${engine})`);
      }
    } finally {
      setExtracting(false);
    }
  };

  const handleConfirm = async (key: string) => {
    if (!rfq) return;
    const fields = rfq.extractedFields.map((f) =>
      f.key === key ? { ...f, isConfirmed: true } : f
    );
    await updateFields(fields, AuditAction.FIELD_CONFIRMED, `Confirmed field: ${key}`);
  };

  const handleOverride = async (key: string, newValue: string) => {
    if (!rfq) return;
    const fields = rfq.extractedFields.map((f) =>
      f.key === key ? { ...f, userOverrideValue: newValue, isConfirmed: true } : f
    );
    await updateFields(fields, AuditAction.FIELD_OVERRIDDEN, `Overrode field "${key}" to "${newValue}"`);
  };

  const handleReset = async (key: string) => {
    if (!rfq) return;
    const fields = rfq.extractedFields.map((f) =>
      f.key === key ? { ...f, userOverrideValue: null, isConfirmed: false } : f
    );
    await updateFields(fields, AuditAction.FIELD_RESET, `Reset field: ${key}`);
  };

  const updateFields = async (fields: ExtractedField[], auditAction: AuditAction, auditDetail: string) => {
    const res = await fetch(`/api/rfqs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extractedFields: fields, auditAction, auditDetail }),
    });
    if (res.ok) {
      const data = await res.json();
      setRfq(data);
    }
  };

  const handleGenerateQuote = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/rfqs/${id}/quote`, { method: "POST" });
      if (res.ok) {
        toast.success("Quote generated successfully");
        router.push(`/rfq/${id}/quote`);
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to generate quote", {
          description: err.missing?.join("\n"),
        });
      }
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-[500px]" />
          <Skeleton className="h-[500px]" />
        </div>
      </div>
    );
  }

  if (!rfq) return null;

  const needsReviewCount = rfq.extractedFields.filter(
    (f) => f.confidence < 0.85 && !f.isConfirmed
  ).length;
  const allConfirmed =
    rfq.extractedFields.length > 0 &&
    rfq.extractedFields.every((f) => f.isConfirmed || f.confidence >= 0.85);
  const highlightSnippets = rfq.extractedFields.map((f) => f.sourceSnippet).filter(Boolean);

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 lg:px-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/inbox")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Inbox
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-lg font-bold truncate">{rfq.subject}</h1>
              <StatusBadge status={rfq.status} />
              <EngineBadge engine={rfq.extractionMeta?.engine} />
            </div>
            <p className="text-sm text-muted-foreground">{rfq.customerName}</p>
          </div>
          {extracting && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-shrink-0">
              <Loader2 className="h-4 w-4 animate-spin" />
              Extracting…
            </div>
          )}
        </div>
      </div>

      {/* KPI chips */}
      {rfq.extractedFields.length > 0 && (
        <div className="border-b border-border px-6 py-2 lg:px-8 flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {rfq.extractedFields.length} fields extracted
          </span>
          {needsReviewCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400">
              {needsReviewCount} pending review
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400">
              All reviewed
            </span>
          )}
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
            allConfirmed
              ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/20 dark:text-violet-400"
              : "border-border bg-muted/40 text-muted-foreground"
          }`}>
            {allConfirmed ? "Quote-ready" : "Not quote-ready"}
          </span>
          {rfq.extractionMeta?.engine === "gemini" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-medium text-violet-700 dark:border-violet-800 dark:bg-violet-950/20 dark:text-violet-400">
              ✦ Gemini extracted
            </span>
          )}
        </div>
      )}

      {/* Review banner */}
      {rfq.extractedFields.length > 0 && (
        <div className="border-b border-border px-6 py-2.5 lg:px-8">
          {needsReviewCount > 0 ? (
            <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-950/10">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm text-amber-800 dark:text-amber-400">
                <strong>{needsReviewCount}</strong> field{needsReviewCount !== 1 ? "s" : ""} need
                {needsReviewCount === 1 ? "s" : ""} review before generating a quote.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-950/10">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-sm text-emerald-800 dark:text-emerald-400">
                All fields confirmed. Ready to generate quote.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex-1 overflow-hidden">
        <div className="grid h-full grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Left: Document viewer */}
          <div className="border-r border-border p-4 overflow-hidden flex flex-col">
            <DocumentViewer
              rawText={rfq.cleaning?.cleanedText ?? rfq.rawText}
              highlightSnippets={highlightSnippets}
              activeSnippet={activeSnippet}
            />
          </div>

          {/* Right: Fields + Clarifier + Similar */}
          <div className="flex flex-col overflow-y-auto p-4">
            {/* Extracted fields header */}
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Extracted Fields ({rfq.extractedFields.length})
              </h2>
              {rfq.status === RFQStatus.NEW && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExtract}
                  disabled={extracting}
                  className="gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Extract
                </Button>
              )}
            </div>

            {rfq.extractedFields.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border">
                <p className="text-sm text-muted-foreground">
                  {extracting
                    ? "Extracting fields…"
                    : "No fields extracted yet. Click Extract to begin."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {rfq.extractedFields.map((field) => (
                  <FieldRow
                    key={field.key}
                    field={field}
                    onConfirm={handleConfirm}
                    onOverride={handleOverride}
                    onReset={handleReset}
                    onSourceClick={(snippet) => setActiveSnippet(snippet)}
                  />
                ))}
              </div>
            )}

            {/* Clarifier panel (Gemini only) */}
            {rfq.clarifier && (
              <ClarifierPanel
                rfqId={id}
                clarifier={rfq.clarifier}
                clarifierAnswers={rfq.clarifierAnswers ?? {}}
                confirmedAssumptions={rfq.confirmedAssumptions ?? []}
                onSaved={setRfq}
              />
            )}

            {/* Similar quotes panel */}
            {rfq.extractedFields.length > 0 && <SimilarPanel rfqId={id} />}

            {/* Generate Quote CTA */}
            {rfq.extractedFields.length > 0 && (
              <div className="mt-6 pt-4 border-t border-border">
                <Button
                  className="w-full gap-2"
                  size="lg"
                  disabled={!allConfirmed || generating}
                  onClick={handleGenerateQuote}
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {generating ? "Generating Quote…" : "Generate Quote"}
                </Button>
                {!allConfirmed && (
                  <p className="mt-1.5 text-center text-xs text-muted-foreground">
                    Confirm all flagged fields to enable quote generation
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
