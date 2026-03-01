import { Badge } from "@/components/ui/badge";
import { RFQStatus } from "@/core/types";
import { cn } from "@/lib/utils";

const statusConfig: Record<RFQStatus, { label: string; className: string }> = {
    [RFQStatus.NEW]: {
        label: "New",
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    },
    [RFQStatus.EXTRACTED]: {
        label: "Extracted",
        className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    },
    [RFQStatus.NEEDS_REVIEW]: {
        label: "Needs Review",
        className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    },
    [RFQStatus.READY_TO_SEND]: {
        label: "Ready to Send",
        className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    },
    [RFQStatus.SENT]: {
        label: "Sent",
        className: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
    },
};

export function StatusBadge({ status }: { status: RFQStatus }) {
    const config = statusConfig[status] ?? statusConfig[RFQStatus.NEW];
    return (
        <Badge
            variant="secondary"
            className={cn(
                "text-[11px] font-semibold border-0 px-2.5 py-0.5",
                config.className
            )}
        >
            {config.label}
        </Badge>
    );
}
