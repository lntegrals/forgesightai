"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { VarianceReport as VarianceReportType } from "@/core/types";

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function DeltaBadge({ delta, deltaPct }: { delta: number; deltaPct: number }) {
  if (Math.abs(delta) < 0.01) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> —
      </span>
    );
  }
  const over = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${over ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}
    >
      {over ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {over ? "+" : ""}
      {fmt(delta)} ({deltaPct > 0 ? "+" : ""}
      {deltaPct.toFixed(1)}%)
    </span>
  );
}

interface VarianceReportProps {
  report: VarianceReportType;
}

export function VarianceReport({ report }: VarianceReportProps) {
  const isOverBudget = report.totalDelta > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Variance Report
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary banner */}
        <div
          className={`rounded-lg px-4 py-3 text-sm ${isOverBudget ? "bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900/30" : "bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30"}`}
        >
          <div className="flex items-center justify-between">
            <span className={`font-medium ${isOverBudget ? "text-red-800 dark:text-red-400" : "text-emerald-800 dark:text-emerald-400"}`}>
              {isOverBudget ? "Over budget" : "Under budget"} by ${fmt(Math.abs(report.totalDelta))}
            </span>
            <span className={`text-xs ${isOverBudget ? "text-red-600 dark:text-red-500" : "text-emerald-600 dark:text-emerald-500"}`}>
              {report.totalDeltaPct > 0 ? "+" : ""}
              {report.totalDeltaPct.toFixed(1)}% vs. estimate
            </span>
          </div>
        </div>

        {/* Line-by-line table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 text-left font-medium text-muted-foreground">Line Item</th>
                <th className="pb-2 text-right font-medium text-muted-foreground">Estimate</th>
                <th className="pb-2 text-right font-medium text-muted-foreground">Actual</th>
                <th className="pb-2 text-right font-medium text-muted-foreground">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {report.lines.map((line) => (
                <tr key={line.type} className="py-1">
                  <td className="py-2 text-foreground">{line.label}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    ${fmt(line.estimate)}
                  </td>
                  <td className="py-2 text-right tabular-nums">${fmt(line.actual)}</td>
                  <td className="py-2 text-right">
                    <DeltaBadge delta={line.delta} deltaPct={line.deltaPct} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-bold">
                <td className="pt-3">Total</td>
                <td className="pt-3 text-right tabular-nums">${fmt(report.estimateTotal)}</td>
                <td className="pt-3 text-right tabular-nums">${fmt(report.actualTotal)}</td>
                <td className="pt-3 text-right">
                  <DeltaBadge delta={report.totalDelta} deltaPct={report.totalDeltaPct} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Margin comparison */}
        <div className="rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Estimated margin: {(report.estimateMarginPct * 100).toFixed(1)}%</span>
            <span>Actual margin: {(report.actualMarginPct * 100).toFixed(1)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
