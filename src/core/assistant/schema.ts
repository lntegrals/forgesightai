/**
 * schema.ts — Zod schema for the Ask ForgeSight QueryPlan.
 */
import { z } from "zod";

export const QueryPlanSchema = z.object({
  intent: z.enum(["search_rfqs", "similar_rfqs", "variance_report", "analytics"]),
  filters: z
    .object({
      q: z.string().optional(),
      customerName: z.string().optional(),
      status: z.string().optional(),
      material: z.string().optional(),
      finish: z.string().optional(),
      qtyMin: z.number().optional(),
      qtyMax: z.number().optional(),
      toleranceMax: z.number().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      hasActuals: z.boolean().optional(),
      // For similar_rfqs intent
      rfqId: z.string().optional(),
    })
    .optional(),
  sort: z
    .object({
      by: z.enum(["createdAt", "totalQuoted", "variancePct"]),
      dir: z.enum(["asc", "desc"]),
    })
    .optional(),
  limit: z.number().min(1).max(50).optional(),
  groupBy: z.enum(["material", "customerName", "month"]).optional(),
  metrics: z
    .array(z.enum(["count", "avgVariancePct", "avgTotalQuoted"]))
    .optional(),
});

export type QueryPlan = z.infer<typeof QueryPlanSchema>;

// JSON Schema representation for Gemini structured output
export const QUERY_PLAN_JSON_SCHEMA = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: ["search_rfqs", "similar_rfqs", "variance_report", "analytics"],
    },
    filters: {
      type: "object",
      properties: {
        q: { type: "string" },
        customerName: { type: "string" },
        status: { type: "string" },
        material: { type: "string" },
        finish: { type: "string" },
        qtyMin: { type: "number" },
        qtyMax: { type: "number" },
        toleranceMax: { type: "number" },
        dateFrom: { type: "string" },
        dateTo: { type: "string" },
        hasActuals: { type: "boolean" },
        rfqId: { type: "string" },
      },
    },
    sort: {
      type: "object",
      properties: {
        by: { type: "string", enum: ["createdAt", "totalQuoted", "variancePct"] },
        dir: { type: "string", enum: ["asc", "desc"] },
      },
      required: ["by", "dir"],
    },
    limit: { type: "number" },
    groupBy: { type: "string", enum: ["material", "customerName", "month"] },
    metrics: {
      type: "array",
      items: { type: "string", enum: ["count", "avgVariancePct", "avgTotalQuoted"] },
    },
  },
  required: ["intent"],
};
