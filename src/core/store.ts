import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import {
  RFQStatus,
  AuditAction,
  Actor,
  type RFQ,
  type AuditEvent,
  type Actuals,
} from "./types";
import { getSeedRFQs } from "./seed";

// ── File-backed store ─────────────────────────────────────────────────────────
// On Vercel (serverless): writes go to /tmp which is writable per-instance.
// On local dev: persists to .data/rfqs.json in the project root.

const DATA_DIR = process.env.VERCEL
  ? "/tmp/.forgesight"
  : path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "rfqs.json");

function readFile(): Map<string, RFQ> {
  try {
    if (!fs.existsSync(DATA_FILE)) return seedAndWrite();
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const arr = JSON.parse(raw) as RFQ[];
    if (!Array.isArray(arr) || arr.length === 0) return seedAndWrite();
    const m = new Map<string, RFQ>();
    for (const rfq of arr) m.set(rfq.id, rfq);
    return m;
  } catch {
    return seedAndWrite();
  }
}

function writeFile(m: Map<string, RFQ>): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(Array.from(m.values()), null, 2), "utf-8");
  } catch (err) {
    console.warn("[store] Failed to persist data:", err);
  }
}

function seedAndWrite(): Map<string, RFQ> {
  const m = new Map<string, RFQ>();
  for (const rfq of getSeedRFQs()) m.set(rfq.id, rfq);
  writeFile(m);
  return m;
}

// ── Synchronous store access (reads file on every call, but OS caches it) ─────
// In Next.js dev with multiple workers we can't use a module-level singleton
// reliably. Reading from file ensures consistency across workers.

function getStore(): Map<string, RFQ> {
  return readFile();
}

function withStore(fn: (m: Map<string, RFQ>) => void): void {
  const m = readFile();
  fn(m);
  writeFile(m);
}

// ── CRUD helpers ───────────────────────────────────────────────────────────

export function getAllRfqs(): RFQ[] {
  const s = getStore();
  return Array.from(s.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/** Alias for getAllRfqs — used by query/similarity modules. */
export const listRfqs = getAllRfqs;

export function getRfq(id: string): RFQ | undefined {
  return getStore().get(id);
}

export function createRfq(data: {
  customerName: string;
  subject: string;
  rawText: string;
  externalId?: string;
  sourceType?: "manual" | "file" | "webhook";
  attachmentName?: string;
}): RFQ {
  const rfq: RFQ = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    customerName: data.customerName,
    subject: data.subject,
    status: RFQStatus.NEW,
    rawText: data.rawText,
    extractedFields: [],
    quote: null,
    audit: [
      {
        at: new Date().toISOString(),
        actor: Actor.USER,
        action: AuditAction.RFQ_CREATED,
        detail: `RFQ created for ${data.customerName}: "${data.subject}"`,
      },
    ],
    ...(data.externalId ? { externalId: data.externalId } : {}),
    ...(data.sourceType ? { sourceType: data.sourceType } : {}),
    ...(data.attachmentName ? { attachmentName: data.attachmentName } : {}),
  };
  withStore((m) => m.set(rfq.id, rfq));
  return rfq;
}

export function updateRfq(
  id: string,
  patch: Partial<Omit<RFQ, "id" | "createdAt">>
): RFQ | undefined {
  let updated: RFQ | undefined;
  withStore((m) => {
    const existing = m.get(id);
    if (!existing) return;
    updated = { ...existing, ...patch };
    m.set(id, updated);
  });
  return updated;
}

export function appendAudit(id: string, event: AuditEvent): void {
  withStore((m) => {
    const existing = m.get(id);
    if (!existing) return;
    existing.audit.push(event);
    m.set(id, existing);
  });
}

/** Record actuals against a sent RFQ and append audit event. */
export function recordActuals(id: string, actuals: Actuals): RFQ | undefined {
  let updated: RFQ | undefined;
  withStore((m) => {
    const existing = m.get(id);
    if (!existing) return;
    updated = { ...existing, actuals };
    updated.audit = [
      ...updated.audit,
      {
        at: new Date().toISOString(),
        actor: Actor.USER,
        action: AuditAction.ACTUALS_RECORDED,
        detail: `Actuals recorded — material: $${actuals.materialCost}, setup: ${actuals.setupHours}h, labor: ${actuals.laborHours}h, machine: ${actuals.machineHours}h`,
      },
    ];
    m.set(id, updated);
  });
  return updated;
}

/** Find an RFQ by externalId (for webhook deduplication). */
export function findByExternalId(externalId: string): RFQ | undefined {
  const s = getStore();
  for (const rfq of s.values()) {
    if (rfq.externalId === externalId) return rfq;
  }
  return undefined;
}

/** Reset the store: delete data file and re-seed. */
export function resetStore(): void {
  try {
    if (fs.existsSync(DATA_FILE)) fs.unlinkSync(DATA_FILE);
  } catch {
    // ignore
  }
  seedAndWrite();
}
