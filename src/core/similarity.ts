/**
 * similarity.ts — Deterministic RFQ similarity scoring.
 * No AI; uses weighted feature matching on DerivedRFQ fields.
 */
import { getAllRfqs } from "./store";
import { deriveRFQ, type DerivedRFQ } from "./derive";

export type SimilarResult = { id: string; score: number; reasons: string[] };

/**
 * Score similarity between two DerivedRFQs (0–100 scale).
 *
 * Weights:
 *   Material exact match  35 pts
 *   Material partial      15 pts
 *   Qty closeness         up to 25 pts (linear ratio)
 *   Tolerance band        20 pts (exact) / 8 pts (adjacent)
 *   Finish match          10 pts (exact) / 4 pts (partial)
 *   Keyword overlap       up to 10 pts
 */
export function similarityScore(
  a: DerivedRFQ,
  b: DerivedRFQ
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Material (heavy weight)
  if (a.material && b.material) {
    const aM = a.material.toLowerCase();
    const bM = b.material.toLowerCase();
    if (aM === bM) {
      score += 35;
      reasons.push(`Same material: ${a.material}`);
    } else {
      const aWords = aM.split(/[\s\-,/]+/).filter((w) => w.length > 2);
      const bWords = new Set(bM.split(/[\s\-,/]+/).filter((w) => w.length > 2));
      const common = aWords.filter((w) => bWords.has(w));
      if (common.length > 0) {
        score += 15;
        reasons.push(`Similar material (${common.slice(0, 2).join(", ")})`);
      }
    }
  }

  // Quantity closeness (moderate)
  if (a.qty !== undefined && b.qty !== undefined && a.qty > 0 && b.qty > 0) {
    const ratio = Math.min(a.qty, b.qty) / Math.max(a.qty, b.qty);
    const qtyScore = Math.round(ratio * 25);
    if (qtyScore > 0) {
      score += qtyScore;
      reasons.push(`Similar quantity (${a.qty} vs ${b.qty})`);
    }
  }

  // Tolerance band (moderate)
  if (a.toleranceBand && b.toleranceBand) {
    if (a.toleranceBand === b.toleranceBand) {
      score += 20;
      reasons.push(`Same tolerance band: ${a.toleranceBand}`);
    } else {
      const bands = ["loose", "med", "tight"];
      const diff = Math.abs(bands.indexOf(a.toleranceBand) - bands.indexOf(b.toleranceBand));
      if (diff === 1) {
        score += 8;
        reasons.push("Adjacent tolerance band");
      }
    }
  }

  // Finish match (small)
  if (a.finish && b.finish) {
    const aF = a.finish.toLowerCase();
    const bF = b.finish.toLowerCase();
    if (aF === bF) {
      score += 10;
      reasons.push(`Same finish: ${a.finish}`);
    } else {
      const aFWords = aF.split(/[\s\-,/]+/).filter((w) => w.length > 3);
      const bFWords = new Set(bF.split(/[\s\-,/]+/).filter((w) => w.length > 3));
      const common = aFWords.filter((w) => bFWords.has(w));
      if (common.length > 0) {
        score += 4;
        reasons.push(`Similar finish (${common[0]})`);
      }
    }
  }

  // Keyword overlap from searchText (moderate)
  const aWords = new Set(a.searchText.split(/\s+/).filter((w) => w.length > 4));
  const bWords = new Set(b.searchText.split(/\s+/).filter((w) => w.length > 4));
  const commonWords = [...aWords].filter((w) => bWords.has(w));
  if (commonWords.length > 0) {
    const pts = Math.min(commonWords.length * 2, 10);
    score += pts;
    if (commonWords.length > 1) {
      reasons.push(`Keyword overlap: ${commonWords.slice(0, 3).join(", ")}`);
    }
  }

  return { score, reasons };
}

export async function similarRFQs(
  rfqId: string,
  limit = 5
): Promise<SimilarResult[]> {
  const rfqs = getAllRfqs();
  const target = rfqs.find((r) => r.id === rfqId);
  if (!target) return [];

  const targetDerived = deriveRFQ(target);

  return rfqs
    .filter((r) => r.id !== rfqId)
    .map((r) => {
      const derived = deriveRFQ(r);
      const { score, reasons } = similarityScore(targetDerived, derived);
      return { id: r.id, score, reasons };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
