"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { useState } from "react";

interface NewRfqDialogProps {
    onSubmit: (data: { customerName: string; subject: string; rawText: string }) => void;
    loading?: boolean;
}

export function NewRfqDialog({ onSubmit, loading }: NewRfqDialogProps) {
    const [open, setOpen] = useState(false);
    const [customerName, setCustomerName] = useState("");
    const [subject, setSubject] = useState("");
    const [rawText, setRawText] = useState("");

    const canSubmit = customerName.trim() && subject.trim() && rawText.trim();

    const handleSubmit = () => {
        if (!canSubmit) return;
        onSubmit({ customerName: customerName.trim(), subject: subject.trim(), rawText: rawText.trim() });
        setCustomerName("");
        setSubject("");
        setRawText("");
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    New RFQ
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>Create New RFQ</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    <div>
                        <Label htmlFor="newCustomer" className="text-xs">Customer Name</Label>
                        <Input
                            id="newCustomer"
                            placeholder="Acme Manufacturing"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <Label htmlFor="newSubject" className="text-xs">Subject</Label>
                        <Input
                            id="newSubject"
                            placeholder="CNC Parts — Qty 100"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <Label htmlFor="newRawText" className="text-xs">
                            RFQ Text <span className="text-muted-foreground">(paste email / document text)</span>
                        </Label>
                        <Textarea
                            id="newRawText"
                            rows={8}
                            placeholder="Paste your RFQ content here..."
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            className="mt-1 resize-none"
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={!canSubmit || loading}>
                            {loading ? "Creating..." : "Create RFQ"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
