import { AuditAction, Actor, type AuditEvent } from "@/core/types";
import {
    FileText,
    Scan,
    CheckCircle,
    Pencil,
    Calculator,
    Send,
    RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

const actionConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    [AuditAction.RFQ_CREATED]: { icon: FileText, color: "text-blue-500 bg-blue-100 dark:bg-blue-900/30", label: "RFQ Created" },
    [AuditAction.FIELDS_EXTRACTED]: { icon: Scan, color: "text-purple-500 bg-purple-100 dark:bg-purple-900/30", label: "Fields Extracted" },
    [AuditAction.FIELD_CONFIRMED]: { icon: CheckCircle, color: "text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30", label: "Field Confirmed" },
    [AuditAction.FIELD_OVERRIDDEN]: { icon: Pencil, color: "text-amber-500 bg-amber-100 dark:bg-amber-900/30", label: "Field Overridden" },
    [AuditAction.FIELD_RESET]: { icon: RotateCcw, color: "text-slate-500 bg-slate-100 dark:bg-slate-900/30", label: "Field Reset" },
    [AuditAction.QUOTE_GENERATED]: { icon: Calculator, color: "text-cyan-500 bg-cyan-100 dark:bg-cyan-900/30", label: "Quote Generated" },
    [AuditAction.EMAIL_SENT]: { icon: Send, color: "text-green-500 bg-green-100 dark:bg-green-900/30", label: "Email Sent" },
};

interface AuditTimelineProps {
    events: AuditEvent[];
}

export function AuditTimeline({ events }: AuditTimelineProps) {
    if (events.length === 0) {
        return (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No audit events yet
            </div>
        );
    }

    return (
        <div className="space-y-0">
            {events.map((event, i) => {
                const config = actionConfig[event.action] ?? actionConfig[AuditAction.RFQ_CREATED];
                const Icon = config.icon;
                const isLast = i === events.length - 1;

                return (
                    <div key={i} className="relative flex gap-3 pb-4">
                        {/* Timeline line */}
                        {!isLast && (
                            <div className="absolute left-[17px] top-[34px] h-[calc(100%-26px)] w-[2px] bg-border" />
                        )}

                        {/* Icon */}
                        <div
                            className={cn(
                                "z-10 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full",
                                config.color
                            )}
                        >
                            <Icon className="h-4 w-4" />
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1 pt-1">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{config.label}</span>
                                <span
                                    className={cn(
                                        "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                        event.actor === Actor.SYSTEM
                                            ? "bg-muted text-muted-foreground"
                                            : "bg-primary/10 text-primary"
                                    )}
                                >
                                    {event.actor}
                                </span>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
                            <time className="mt-0.5 block text-[10px] text-muted-foreground/60">
                                {new Date(event.at).toLocaleString()}
                            </time>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
