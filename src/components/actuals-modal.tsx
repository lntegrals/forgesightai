"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, Loader2 } from "lucide-react";

interface ActualsModalProps {
  rfqId: string;
  onSaved: () => void;
}

export function ActualsModal({ rfqId, onSaved }: ActualsModalProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [materialCost, setMaterialCost] = useState("");
  const [setupHours, setSetupHours] = useState("");
  const [laborHours, setLaborHours] = useState("");
  const [machineHours, setMachineHours] = useState("");
  const [notes, setNotes] = useState("");

  const handleSave = async () => {
    const parsed = {
      materialCost: parseFloat(materialCost),
      setupHours: parseFloat(setupHours),
      laborHours: parseFloat(laborHours),
      machineHours: parseFloat(machineHours),
      notes: notes.trim() || undefined,
    };

    if (
      isNaN(parsed.materialCost) ||
      isNaN(parsed.setupHours) ||
      isNaN(parsed.laborHours) ||
      isNaN(parsed.machineHours)
    ) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/rfqs/${rfqId}/actuals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (res.ok) {
        setOpen(false);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ClipboardList className="h-4 w-4" />
          Record Actuals
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Record Actual Costs</DialogTitle>
          <DialogDescription>
            Enter what the job actually cost. The variance report will compare these to the quote.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="materialCost">Material Cost ($)</Label>
              <Input
                id="materialCost"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 850.00"
                value={materialCost}
                onChange={(e) => setMaterialCost(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="setupHours">Setup Hours</Label>
              <Input
                id="setupHours"
                type="number"
                min="0"
                step="0.25"
                placeholder="e.g. 2.5"
                value={setupHours}
                onChange={(e) => setSetupHours(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="laborHours">Labor Hours</Label>
              <Input
                id="laborHours"
                type="number"
                min="0"
                step="0.25"
                placeholder="e.g. 8.0"
                value={laborHours}
                onChange={(e) => setLaborHours(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="machineHours">Machine Hours</Label>
              <Input
                id="machineHours"
                type="number"
                min="0"
                step="0.25"
                placeholder="e.g. 4.0"
                value={machineHours}
                onChange={(e) => setMachineHours(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any notes about cost overruns, material substitutions, etc."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {saving ? "Saving..." : "Save Actuals"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
