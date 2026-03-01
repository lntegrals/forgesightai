"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { NewRfqDialog } from "@/components/new-rfq-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Inbox, Upload, ChevronDown, FileText, Loader2 } from "lucide-react";
import type { RFQ } from "@/core/types";
import { toast } from "sonner";

const SAMPLES = [
  { label: "Aluminum Bracket (Qty 500)", file: "bracket-rfq.txt" },
  { label: "Steel Drive Shaft (Qty 150)", file: "shaft-rfq.txt" },
  { label: "Stainless Valve Housing (Prototype)", file: "housing-rfq.txt" },
];

export default function InboxPage() {
  const router = useRouter();
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchRfqs = async () => {
    try {
      const res = await fetch("/api/rfqs");
      const data = await res.json();
      setRfqs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRfqs();
  }, []);

  const handleCreateRfq = async (data: {
    customerName: string;
    subject: string;
    rawText: string;
  }) => {
    setCreating(true);
    try {
      const res = await fetch("/api/rfqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const created: RFQ = await res.json();
        await fetchRfqs();
        router.push(`/rfq/${created.id}`);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/rfqs/ingest", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const created: RFQ = await res.json();
        await fetchRfqs();
        toast.success(`Uploaded "${file.name}" — fields auto-extracted`);
        router.push(`/rfq/${created.id}`);
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Upload failed");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFileUpload(file);
    // Reset so same file can be re-uploaded
    e.target.value = "";
  };

  const handleLoadSample = async (sampleFile: string) => {
    setUploading(true);
    try {
      const res = await fetch(`/samples/${sampleFile}`);
      if (!res.ok) {
        toast.error("Could not load sample file");
        return;
      }
      const text = await res.text();
      const blob = new Blob([text], { type: "text/plain" });
      const file = new File([blob], sampleFile, { type: "text/plain" });
      await handleFileUpload(file);
    } finally {
      setUploading(false);
    }
  };

  const filtered = rfqs.filter(
    (r) =>
      r.customerName.toLowerCase().includes(search.toLowerCase()) ||
      r.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">RFQ Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rfqs.length} request{rfqs.length !== 1 ? "s" : ""} for quote
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* File Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.pdf"
            className="hidden"
            onChange={handleFileInputChange}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={uploading}>
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploading ? "Uploading..." : "Upload RFQ"}
                <ChevronDown className="h-3 w-3 ml-0.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Upload .txt or .pdf file
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
                Load sample RFQ
              </div>
              {SAMPLES.map((s) => (
                <DropdownMenuItem key={s.file} onClick={() => handleLoadSample(s.file)}>
                  <FileText className="mr-2 h-4 w-4" />
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <NewRfqDialog onSubmit={handleCreateRfq} loading={creating} />
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by customer or subject..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <Inbox className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search ? "No matching RFQs found" : "No RFQs yet. Create your first one or upload a file!"}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[240px]">Customer</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="w-[120px]">Source</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="w-[160px] text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((rfq) => (
                <TableRow
                  key={rfq.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => router.push(`/rfq/${rfq.id}`)}
                  tabIndex={0}
                  role="link"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(`/rfq/${rfq.id}`);
                  }}
                >
                  <TableCell className="font-medium">{rfq.customerName}</TableCell>
                  <TableCell className="text-muted-foreground">{rfq.subject}</TableCell>
                  <TableCell>
                    {rfq.sourceType ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground capitalize">
                        {rfq.sourceType === "file" && <FileText className="h-3 w-3" />}
                        {rfq.sourceType}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">manual</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={rfq.status} />
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {new Date(rfq.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
