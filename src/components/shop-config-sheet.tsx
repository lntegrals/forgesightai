"use client";

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Settings } from "lucide-react";
import type { ShopConfig } from "@/core/types";

interface ShopConfigSheetProps {
    config: ShopConfig;
    onConfigChange: (config: ShopConfig) => void;
}

export function ShopConfigSheet({ config, onConfigChange }: ShopConfigSheetProps) {
    const handleChange = (key: keyof ShopConfig, raw: string) => {
        const val = parseFloat(raw) || 0;
        onConfigChange({ ...config, [key]: val });
    };

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Settings className="h-4 w-4" />
                    Shop Rates
                </Button>
            </SheetTrigger>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Shop Configuration</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-5">
                    <div className="space-y-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Hourly Rates
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <Label htmlFor="setupRate" className="text-xs">Setup Rate ($/hr)</Label>
                                <Input
                                    id="setupRate"
                                    type="number"
                                    step="5"
                                    value={config.setupRate}
                                    onChange={(e) => handleChange("setupRate", e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label htmlFor="laborRate" className="text-xs">Labor Rate ($/hr)</Label>
                                <Input
                                    id="laborRate"
                                    type="number"
                                    step="5"
                                    value={config.laborRate}
                                    onChange={(e) => handleChange("laborRate", e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label htmlFor="machineRate" className="text-xs">Machine Rate ($/hr)</Label>
                                <Input
                                    id="machineRate"
                                    type="number"
                                    step="5"
                                    value={config.machineRate}
                                    onChange={(e) => handleChange("machineRate", e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Percentages
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <Label htmlFor="overheadPct" className="text-xs">Overhead (%)</Label>
                                <Input
                                    id="overheadPct"
                                    type="number"
                                    step="1"
                                    value={Math.round(config.overheadPct * 100)}
                                    onChange={(e) => handleChange("overheadPct", String(parseFloat(e.target.value) / 100))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label htmlFor="marginPct" className="text-xs">Profit Margin (%)</Label>
                                <Input
                                    id="marginPct"
                                    type="number"
                                    step="1"
                                    value={Math.round(config.marginPct * 100)}
                                    onChange={(e) => handleChange("marginPct", String(parseFloat(e.target.value) / 100))}
                                    className="mt-1"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
