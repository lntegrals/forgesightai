"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface EmailDraftProps {
    to: string;
    subject: string;
    body: string;
    onToChange: (val: string) => void;
    onSubjectChange: (val: string) => void;
    onBodyChange: (val: string) => void;
}

export function EmailDraft({
    to,
    subject,
    body,
    onToChange,
    onSubjectChange,
    onBodyChange,
}: EmailDraftProps) {
    return (
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email Draft
            </h3>
            <div className="space-y-3">
                <div>
                    <Label htmlFor="emailTo" className="text-xs">To</Label>
                    <Input
                        id="emailTo"
                        type="email"
                        placeholder="customer@example.com"
                        value={to}
                        onChange={(e) => onToChange(e.target.value)}
                        className="mt-1"
                    />
                </div>
                <div>
                    <Label htmlFor="emailSubject" className="text-xs">Subject</Label>
                    <Input
                        id="emailSubject"
                        placeholder="Quote for..."
                        value={subject}
                        onChange={(e) => onSubjectChange(e.target.value)}
                        className="mt-1"
                    />
                </div>
                <div>
                    <Label htmlFor="emailBody" className="text-xs">Body</Label>
                    <Textarea
                        id="emailBody"
                        rows={10}
                        placeholder="Email body..."
                        value={body}
                        onChange={(e) => onBodyChange(e.target.value)}
                        className="mt-1 resize-none"
                    />
                </div>
            </div>
        </div>
    );
}
