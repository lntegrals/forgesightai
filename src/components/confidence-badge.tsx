import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, AlertOctagon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfidenceBadgeProps {
    confidence: number;
    showLabel?: boolean;
}

export function ConfidenceBadge({ confidence, showLabel = true }: ConfidenceBadgeProps) {
    const pct = Math.round(confidence * 100);

    if (confidence >= 0.85) {
        return (
            <Badge
                variant="secondary"
                className={cn(
                    "gap-1 border-0 text-[11px] font-medium",
                    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                )}
            >
                <CheckCircle className="h-3 w-3" />
                {showLabel && <span>{pct}%</span>}
            </Badge>
        );
    }

    if (confidence >= 0.5) {
        return (
            <Badge
                variant="secondary"
                className={cn(
                    "gap-1 border-0 text-[11px] font-medium",
                    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                )}
            >
                <AlertTriangle className="h-3 w-3" />
                {showLabel && <span>{pct}%</span>}
            </Badge>
        );
    }

    return (
        <Badge
            variant="secondary"
            className={cn(
                "gap-1 border-0 text-[11px] font-medium",
                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            )}
        >
            <AlertOctagon className="h-3 w-3" />
            {showLabel && <span>{pct}%</span>}
        </Badge>
    );
}
