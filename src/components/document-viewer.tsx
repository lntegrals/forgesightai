"use client";

import { useCallback, useRef, useEffect, useState } from "react";

interface DocumentViewerProps {
    rawText: string;
    highlightSnippets?: string[];
    activeSnippet?: string | null;
}

export function DocumentViewer({
    rawText,
    highlightSnippets = [],
    activeSnippet,
}: DocumentViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    // Scroll to the active snippet when it changes
    useEffect(() => {
        if (!activeSnippet || !containerRef.current) return;
        const marks = containerRef.current.querySelectorAll("mark[data-active='true']");
        if (marks.length > 0) {
            marks[0].scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [activeSnippet]);

    const renderHighlightedText = useCallback(() => {
        if (highlightSnippets.length === 0) {
            return rawText.split("\n").map((line, i) => (
                <div key={i} className="flex min-w-0">
                    <span className="mr-4 w-8 shrink-0 select-none text-right text-xs text-muted-foreground/50">
                        {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">{line || "\u00A0"}</span>
                </div>
            ));
        }

        // Build highlighted version
        let html = rawText;
        const sorted = [...highlightSnippets].sort((a, b) => b.length - a.length);
        for (const snippet of sorted) {
            if (!snippet) continue;
            const escaped = snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const isActive = snippet === activeSnippet;
            html = html.replace(
                new RegExp(escaped, "gi"),
                `<mark class="${isActive ? "bg-amber-300 dark:bg-amber-500/40 ring-2 ring-amber-400" : "bg-yellow-200/60 dark:bg-yellow-500/20"}" data-active="${isActive}">${snippet}</mark>`
            );
        }

        return html.split("\n").map((line, i) => (
            <div key={i} className="flex min-w-0">
                <span className="mr-4 w-8 shrink-0 select-none text-right text-xs text-muted-foreground/50">
                    {i + 1}
                </span>
                <span
                    className="min-w-0 flex-1 break-words whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: line || "\u00A0" }}
                />
            </div>
        ));
    }, [rawText, highlightSnippets, activeSnippet]);

    return (
        <div className="flex h-full flex-col rounded-lg border border-border bg-muted/30 overflow-hidden">
            <div className="border-b border-border px-4 py-2.5 shrink-0">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Document
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4" ref={containerRef}>
                <div className="font-mono text-[13px] leading-6 text-foreground/90 min-w-0">
                    {renderHighlightedText()}
                </div>
            </div>
        </div>
    );
}
