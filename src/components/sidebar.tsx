"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Factory,
    Inbox,
    BarChart3,
    FileText,
    Settings,
    ChevronRight,
    Sparkles,
    Github,
    HelpCircle,
    ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// ── Nav Items ──────────────────────────────────────────────

const PIPELINE_ITEMS = [
    {
        href: "/rfqs",
        label: "RFQs",
        icon: Inbox,
        description: "Mission Control",
    },
    {
        href: "#",
        label: "Quote Builder",
        icon: FileText,
        description: "Pricing engine",
        disabled: true,
    },
];

const ANALYTICS_ITEMS = [
    {
        href: "/audit",
        label: "Audit Log",
        icon: ClipboardList,
        description: "All pipeline events",
    },
    {
        href: "#",
        label: "Variance",
        icon: BarChart3,
        description: "Actuals vs quoted",
        disabled: true,
    },
];

// ── Sub-components ─────────────────────────────────────────

interface NavItemProps {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description?: string;
    disabled?: boolean;
    active?: boolean;
    badge?: number;
}

function NavItem({ href, label, icon: Icon, disabled, active, badge }: NavItemProps) {
    return (
        <Link
            href={disabled ? "#" : href}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                "hover:bg-accent hover:text-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-muted-foreground",
                disabled && "pointer-events-none opacity-40"
            )}
        >
            <Icon
                className={cn(
                    "h-4 w-4 flex-shrink-0 transition-colors",
                    active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                )}
            />
            <span className={cn("flex-1 truncate", active && "text-foreground")}>{label}</span>
            {badge !== undefined && badge > 0 && (
                <Badge
                    variant="secondary"
                    className="h-5 min-w-[20px] px-1.5 text-[10px] font-bold tabular-nums"
                >
                    {badge}
                </Badge>
            )}
            {active && (
                <ChevronRight className="h-3 w-3 opacity-50" />
            )}
        </Link>
    );
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-0.5">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {label}
            </p>
            {children}
        </div>
    );
}

// ── Main Sidebar ───────────────────────────────────────────

export function Sidebar() {
    const pathname = usePathname();

    const isRfqsActive = pathname.startsWith("/rfqs");

    return (
        <aside className="flex h-screen w-[240px] flex-col border-r border-border bg-sidebar">
            {/* ── Logo / Brand ── */}
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
                    <Factory className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                    <h1 className="text-sm font-bold tracking-tight text-foreground">
                        ForgeSight
                    </h1>
                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Sparkles className="h-2.5 w-2.5" />
                        AI Quoting Copilot
                    </p>
                </div>
            </div>

            {/* ── Navigation ── */}
            <nav className="flex-1 overflow-y-auto px-3 py-4">
                <div className="space-y-5">
                    <NavGroup label="Pipeline">
                        {PIPELINE_ITEMS.map((item) => (
                            <NavItem
                                key={item.href}
                                {...item}
                                active={isRfqsActive && !item.disabled && item.href !== "#"}
                            />
                        ))}
                    </NavGroup>

                    <Separator className="opacity-50" />

                    <NavGroup label="Analytics">
                        {ANALYTICS_ITEMS.map((item) => (
                            <NavItem
                                key={item.label}
                                {...item}
                                active={pathname === item.href}
                            />
                        ))}
                    </NavGroup>
                </div>
            </nav>

            {/* ── Footer ── */}
            <div className="space-y-1 border-t border-border px-3 py-3">
                <NavItem
                    href="/settings"
                    label="Settings"
                    icon={Settings}
                    active={pathname === "/settings"}
                />
                <NavItem
                    href="#"
                    label="Help & Docs"
                    icon={HelpCircle}
                    disabled
                />
                <Link
                    href="https://github.com/lntegrals/forgesightai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                    <Github className="h-3.5 w-3.5" />
                    <span>View on GitHub</span>
                </Link>
                <div className="px-3 pb-1 pt-2">
                    <div className="rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-900/40 px-3 py-2">
                        <p className="flex items-center gap-1.5 text-[10px] font-semibold text-violet-700 dark:text-violet-400">
                            <Sparkles className="h-2.5 w-2.5" />
                            Gemini 2.5 Flash Active
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                            AI extraction &amp; clarifier live
                        </p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
