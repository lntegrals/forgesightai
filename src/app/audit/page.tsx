"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ClipboardList } from "lucide-react";
import type { RFQ, AuditEvent } from "@/core/types";
import { AuditAction, Actor } from "@/core/types";

interface AuditRow extends AuditEvent {
  rfqId: string;
  customerName: string;
  subject: string;
}

const ACTION_LABELS: Record<AuditAction, string> = {
  [AuditAction.RFQ_CREATED]: "RFQ Created",
  [AuditAction.FIELDS_EXTRACTED]: "Fields Extracted",
  [AuditAction.FIELD_CONFIRMED]: "Field Confirmed",
  [AuditAction.FIELD_OVERRIDDEN]: "Field Overridden",
  [AuditAction.FIELD_RESET]: "Field Reset",
  [AuditAction.QUOTE_GENERATED]: "Quote Generated",
  [AuditAction.EMAIL_SENT]: "Email Sent",
  [AuditAction.ACTUALS_RECORDED]: "Actuals Recorded",
  [AuditAction.WEBHOOK_INGESTED]: "Webhook Ingested",
  [AuditAction.FILE_INGESTED]: "File Ingested",
};

const ACTION_COLORS: Partial<Record<AuditAction, string>> = {
  [AuditAction.RFQ_CREATED]: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  [AuditAction.QUOTE_GENERATED]: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  [AuditAction.EMAIL_SENT]: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  [AuditAction.ACTUALS_RECORDED]: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  [AuditAction.FIELDS_EXTRACTED]: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  [AuditAction.FILE_INGESTED]: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  [AuditAction.WEBHOOK_INGESTED]: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
};

function ActionBadge({ action }: { action: AuditAction }) {
  const color = ACTION_COLORS[action] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${color}`}>
      {ACTION_LABELS[action] ?? action}
    </span>
  );
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/rfqs")
      .then((r) => r.json())
      .then((rfqs: RFQ[]) => {
        const all: AuditRow[] = [];
        for (const rfq of rfqs) {
          for (const event of rfq.audit) {
            all.push({
              ...event,
              rfqId: rfq.id,
              customerName: rfq.customerName,
              subject: rfq.subject,
            });
          }
        }
        all.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
        setRows(all);
        setLoading(false);
      });
  }, []);

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.customerName.toLowerCase().includes(q) ||
      r.subject.toLowerCase().includes(q) ||
      r.detail.toLowerCase().includes(q) ||
      ACTION_LABELS[r.action as AuditAction]?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="h-full overflow-y-auto">
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${rows.length} events across all RFQs`}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by customer, subject, action, or detail…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search ? "No matching events" : "No audit events yet"}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[160px]">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[80px]">Actor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[180px]">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[200px]">RFQ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((row, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {new Date(row.at).toLocaleString("en-US", {
                      month: "short", day: "numeric",
                      hour: "2-digit", minute: "2-digit", second: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={row.actor === Actor.SYSTEM ? "secondary" : "outline"} className="text-[10px]">
                      {row.actor}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <ActionBadge action={row.action as AuditAction} />
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/rfqs/${row.rfqId}`}
                      className="group"
                    >
                      <div className="font-medium text-foreground group-hover:text-primary transition-colors truncate max-w-[190px]">
                        {row.customerName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-[190px]">
                        {row.subject}
                      </div>
                    </a>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs">
                    <span className="line-clamp-2">{row.detail}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </div>
  );
}
