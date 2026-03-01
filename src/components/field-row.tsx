"use client";

import { ConfidenceBadge } from "@/components/confidence-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Pencil, RotateCcw, FileText } from "lucide-react";
import type { ExtractedField } from "@/core/types";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface FieldRowProps {
    field: ExtractedField;
    onConfirm: (key: string) => void;
    onOverride: (key: string, newValue: string) => void;
    onReset: (key: string) => void;
    onSourceClick: (snippet: string) => void;
}

export function FieldRow({
    field,
    onConfirm,
    onOverride,
    onReset,
    onSourceClick,
}: FieldRowProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(field.userOverrideValue ?? field.value);

    const displayValue = field.userOverrideValue ?? field.value;
    const isOverridden = field.userOverrideValue !== null;
    const needsReview = field.confidence < 0.85 && !field.isConfirmed;

    const handleSaveEdit = () => {
        if (editValue.trim() && editValue !== field.value) {
            onOverride(field.key, editValue.trim());
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleSaveEdit();
        if (e.key === "Escape") {
            setEditValue(displayValue);
            setIsEditing(false);
        }
    };

    return (
        <div
            className={cn(
                "group flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors",
                needsReview
                    ? "border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/10"
                    : "border-border bg-card",
                field.isConfirmed && "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/30 dark:bg-emerald-950/10"
            )}
        >
            {/* Field label + value */}
            <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {field.label}
                    </span>
                    <ConfidenceBadge confidence={field.confidence} />
                    {isOverridden && (
                        <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                            (overridden)
                        </span>
                    )}
                </div>

                {isEditing ? (
                    <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleSaveEdit}
                        onKeyDown={handleKeyDown}
                        className="h-8 text-sm"
                        autoFocus
                    />
                ) : (
                    <p className="text-sm font-medium">{displayValue}</p>
                )}

                {/* Source snippet */}
                <button
                    onClick={() => onSourceClick(field.sourceSnippet)}
                    className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                    <FileText className="h-3 w-3" />
                    <span className="underline decoration-dashed underline-offset-2">
                        {field.sourceRef}
                    </span>
                    <span className="max-w-[200px] truncate text-muted-foreground/70">
                        — &ldquo;{field.sourceSnippet}&rdquo;
                    </span>
                </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 pt-0.5">
                {!field.isConfirmed && (
                    <Button
                        size="sm"
                        variant={needsReview ? "default" : "outline"}
                        className="h-7 gap-1 text-xs"
                        onClick={() => onConfirm(field.key)}
                    >
                        <Check className="h-3 w-3" />
                        Confirm
                    </Button>
                )}

                {field.isConfirmed && (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <Check className="h-3.5 w-3.5" />
                        Confirmed
                    </span>
                )}

                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                        setEditValue(displayValue);
                        setIsEditing(true);
                    }}
                    title="Edit value"
                >
                    <Pencil className="h-3 w-3" />
                </Button>

                {isOverridden && (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground"
                        onClick={() => {
                            onReset(field.key);
                            setEditValue(field.value);
                        }}
                        title="Reset to extracted value"
                    >
                        <RotateCcw className="h-3 w-3" />
                    </Button>
                )}
            </div>
        </div>
    );
}
