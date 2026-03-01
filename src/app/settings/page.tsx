"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Save, RotateCcw, Loader2, CheckCircle } from "lucide-react";
import type { ShopConfig } from "@/core/types";
import { DEFAULT_SHOP_CONFIG } from "@/core/types";
import { toast } from "sonner";

export default function SettingsPage() {
  const [config, setConfig] = useState<ShopConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => { setConfig(data); setLoading(false); });
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        const saved = await res.json();
        setConfig(saved);
        toast.success("Shop rates saved", {
          description: "All new quotes will use the updated rates.",
          icon: <CheckCircle className="h-4 w-4" />,
        });
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig({ ...DEFAULT_SHOP_CONFIG });
    toast.info("Rates reset to defaults — click Save to apply");
  };

  const field = (
    key: keyof ShopConfig,
    label: string,
    description: string,
    prefix?: string,
    suffix?: string
  ) => {
    if (!config) return null;
    const raw = key === "overheadPct" || key === "marginPct"
      ? (config[key] * 100).toFixed(1)
      : config[key].toString();

    return (
      <div className="space-y-1.5">
        <Label htmlFor={key}>{label}</Label>
        <div className="flex items-center gap-2">
          {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
          <Input
            id={key}
            type="number"
            min="0"
            step={key === "overheadPct" || key === "marginPct" ? "0.5" : "1"}
            value={raw}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (isNaN(v)) return;
              const stored = key === "overheadPct" || key === "marginPct" ? v / 100 : v;
              setConfig((c) => c ? { ...c, [key]: stored } : c);
            }}
            className="w-32"
          />
          {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <Settings className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure shop rates used by the pricing engine</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Hourly Rates</CardTitle>
              <CardDescription>
                Applied per-hour to setup, labor, and machine time on every new quote.
                Changes take effect on the next generated quote — existing quotes are unchanged.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {field("setupRate", "Setup Rate", "One-time setup / programming cost per hour", "$", "/ hr")}
              <Separator />
              {field("laborRate", "Labor Rate", "Direct labor cost per hour (machinist time at machine)", "$", "/ hr")}
              <Separator />
              {field("machineRate", "Machine Rate", "Machine run time cost per hour (CNC cycle time)", "$", "/ hr")}
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-base">Overhead & Margin</CardTitle>
              <CardDescription>
                Overhead is applied as a percentage of direct costs (subtotal).
                Margin is applied on top of subtotal + overhead.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {field("overheadPct", "Overhead", "Covers indirect costs: facility, tooling, insurance, utilities", undefined, "%")}
              <Separator />
              {field("marginPct", "Profit Margin", "Target gross margin on each job", undefined, "%")}
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset to Defaults
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
