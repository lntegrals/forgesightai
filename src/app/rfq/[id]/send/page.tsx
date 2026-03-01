"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { EmailDraft } from "@/components/email-draft";
import { PdfPreview } from "@/components/pdf-preview";
import { AuditTimeline } from "@/components/audit-timeline";
import { ActualsModal } from "@/components/actuals-modal";
import { VarianceReport } from "@/components/variance-report";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Send, Loader2, CheckCircle, Download, FlaskConical } from "lucide-react";
import type { RFQ, VarianceReport as VarianceReportType } from "@/core/types";
import { RFQStatus } from "@/core/types";
import { toast } from "sonner";

export default function SendPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [variance, setVariance] = useState<VarianceReportType | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const fetchRfq = useCallback(async () => {
    try {
      const res = await fetch(`/api/rfqs/${id}`);
      if (!res.ok) { router.push("/inbox"); return; }
      const data: RFQ = await res.json();
      setRfq(data);

      setEmailTo("");
      setEmailSubject(`Quote: ${data.subject}`);
      setEmailBody(
        `Dear ${data.customerName},\n\n` +
        `Thank you for your request for quote regarding "${data.subject}".\n\n` +
        `Please find our quote attached. The total quoted amount is $${data.quote?.totals.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "N/A"}.\n\n` +
        `This quote is valid for 30 days from the date of issue.\n\n` +
        `Key assumptions:\n` +
        (data.quote?.assumptions.map((a) => `  • ${a}`).join("\n") ?? "") +
        `\n\nPlease don't hesitate to reach out if you have any questions.\n\n` +
        `Best regards,\nForgeSight AI — Manufacturing Copilot`
      );

      // If actuals exist, fetch variance
      if (data.actuals && data.quote) {
        fetchVariance();
      }
    } finally {
      setLoading(false);
    }
  }, [id, router]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchVariance = useCallback(async () => {
    try {
      const res = await fetch(`/api/rfqs/${id}/variance`);
      if (res.ok) {
        const data = await res.json();
        setVariance(data);
      }
    } catch {
      // variance not yet available
    }
  }, [id]);

  useEffect(() => {
    fetchRfq();
  }, [fetchRfq]);

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/rfqs/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailTo, subject: emailSubject, body: emailBody }),
      });
      if (res.ok) {
        const data = await res.json();
        setRfq(data);
        toast.success("Quote sent successfully!", {
          description: "Email has been simulated and the audit log updated.",
          icon: <CheckCircle className="h-4 w-4" />,
        });
      }
    } finally {
      setSending(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/rfqs/${id}/quote/pdf`);
      if (!res.ok) {
        toast.error("Failed to generate PDF");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quote-${id.slice(0, 8).toUpperCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleActualsSaved = useCallback(async () => {
    await fetchRfq();
    await fetchVariance();
    toast.success("Actuals recorded — variance report updated");
  }, [fetchRfq, fetchVariance]);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  if (!rfq) return null;

  const isSent = rfq.status === RFQStatus.SENT;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-1">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/rfq/${id}/quote`)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Quote
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Send Quote</h1>
              <StatusBadge status={rfq.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {rfq.customerName} — {rfq.subject}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {rfq.quote && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
              >
                {downloadingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {downloadingPdf ? "Generating..." : "Download PDF"}
              </Button>
            )}
            {isSent && <ActualsModal rfqId={id} onSaved={handleActualsSaved} />}
          </div>
        </div>
      </div>

      {/* Sent confirmation */}
      {isSent && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/10">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400">
              Quote has been sent successfully (simulated)
              {rfq.actuals
                ? " — Actuals recorded. See variance report below."
                : " — Record actuals to see profitability variance."}
            </p>
          </div>
        </div>
      )}

      {/* Sandbox Mode notice */}
      <div className="mb-5 flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/30 dark:bg-amber-950/10">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-xs text-amber-800 dark:text-amber-400">
          <strong>Sandbox mode</strong> — no external email will be sent. This page simulates the full
          send workflow including audit logging. All quote data is real; only the email delivery is mocked.
        </p>
      </div>

      {/* Two-column: email draft + PDF preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <EmailDraft
          to={emailTo}
          subject={emailSubject}
          body={emailBody}
          onToChange={setEmailTo}
          onSubjectChange={setEmailSubject}
          onBodyChange={setEmailBody}
        />
        <PdfPreview
          customerName={rfq.customerName}
          subject={rfq.subject}
          quote={rfq.quote}
        />
      </div>

      {/* Send CTA */}
      {!isSent && (
        <div className="mb-6 flex justify-end">
          <Button size="lg" className="gap-2" onClick={handleSend} disabled={sending}>
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {sending ? "Sending…" : "Simulate Send (Sandbox)"}
          </Button>
        </div>
      )}

      {/* Variance Report */}
      {variance && (
        <>
          <Separator className="my-6" />
          <div className="mb-6">
            <VarianceReport report={variance} />
          </div>
        </>
      )}

      <Separator className="my-6" />

      {/* Audit Timeline */}
      <div className="mb-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Audit Log
        </h2>
        <AuditTimeline events={[...rfq.audit].reverse()} />
      </div>
    </div>
  );
}
