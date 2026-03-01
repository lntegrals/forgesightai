import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FileText } from "lucide-react";
import type { Quote } from "@/core/types";

interface PdfPreviewProps {
    customerName: string;
    subject: string;
    quote: Quote | null;
}

export function PdfPreview({ customerName, subject, quote }: PdfPreviewProps) {
    return (
        <Card className="border-dashed">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        PDF Preview
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-900">
                    {/* Header */}
                    <div className="text-center">
                        <h2 className="text-lg font-bold">ForgeSight AI</h2>
                        <p className="text-xs text-muted-foreground">Manufacturing Quote</p>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-xs text-muted-foreground">Customer</p>
                            <p className="font-medium">{customerName}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Reference</p>
                            <p className="font-medium">{subject}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Date</p>
                            <p className="font-medium">{new Date().toLocaleDateString()}</p>
                        </div>
                    </div>

                    <Separator />

                    {quote ? (
                        <>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left">
                                        <th className="pb-2 text-xs font-semibold text-muted-foreground">Item</th>
                                        <th className="pb-2 text-right text-xs font-semibold text-muted-foreground">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {quote.lineItems.map((item, i) => (
                                        <tr key={i} className="border-b border-dashed last:border-0">
                                            <td className="py-2">{item.label}</td>
                                            <td className="py-2 text-right tabular-nums font-medium">
                                                ${item.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <Separator />

                            <div className="flex justify-between text-sm font-bold">
                                <span>Total</span>
                                <span className="tabular-nums">
                                    ${quote.totals.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>

                            {quote.assumptions.length > 0 && (
                                <div className="mt-3">
                                    <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                                        Assumptions
                                    </p>
                                    <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                                        {quote.assumptions.map((a, i) => (
                                            <li key={i}>• {a}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            No quote generated yet
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
