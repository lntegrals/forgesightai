"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import type { QuoteLineItem } from "@/core/types";
import { LineItemType } from "@/core/types";
import {
    Package,
    Wrench,
    Clock,
    Users,
    Building2,
    TrendingUp,
} from "lucide-react";

const iconMap: Record<LineItemType, React.ElementType> = {
    [LineItemType.MATERIAL]: Package,
    [LineItemType.SETUP]: Wrench,
    [LineItemType.RUN_TIME]: Clock,
    [LineItemType.LABOR]: Users,
    [LineItemType.OVERHEAD]: Building2,
    [LineItemType.MARGIN]: TrendingUp,
};

const colorMap: Record<LineItemType, string> = {
    [LineItemType.MATERIAL]: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30",
    [LineItemType.SETUP]: "text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-900/30",
    [LineItemType.RUN_TIME]: "text-cyan-600 bg-cyan-100 dark:text-cyan-400 dark:bg-cyan-900/30",
    [LineItemType.LABOR]: "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30",
    [LineItemType.OVERHEAD]: "text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-900/30",
    [LineItemType.MARGIN]: "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30",
};

interface QuoteCardProps {
    item: QuoteLineItem;
}

export function QuoteCard({ item }: QuoteCardProps) {
    const Icon = iconMap[item.type] ?? Package;
    const color = colorMap[item.type] ?? colorMap[LineItemType.MATERIAL];

    return (
        <Card className="overflow-hidden">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
                            <Icon className="h-4 w-4" />
                        </div>
                        <CardTitle className="text-sm font-semibold">{item.label}</CardTitle>
                    </div>
                    <span className="text-lg font-bold tabular-nums">
                        ${item.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                <Accordion type="single" collapsible>
                    <AccordionItem value="why" className="border-0">
                        <AccordionTrigger className="py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:no-underline">
                            Why this amount?
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="space-y-3 rounded-lg bg-muted/50 p-3">
                                {/* Formula */}
                                <div>
                                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        Formula
                                    </p>
                                    <code className="text-xs font-mono text-foreground/80 bg-muted px-2 py-1 rounded">
                                        {item.formula}
                                    </code>
                                </div>

                                <Separator />

                                {/* Inputs */}
                                <div>
                                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        Inputs
                                    </p>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                        {Object.entries(item.inputs).map(([k, v]) => (
                                            <div key={k} className="flex justify-between text-xs">
                                                <span className="text-muted-foreground">{k}</span>
                                                <span className="font-medium tabular-nums">
                                                    {typeof v === "number" && v % 1 !== 0
                                                        ? v.toFixed(2)
                                                        : v.toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <Separator />

                                {/* Explanation */}
                                <p className="text-xs text-foreground/80 leading-relaxed">
                                    💡 {item.why}
                                </p>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
        </Card>
    );
}
