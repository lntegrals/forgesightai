/**
 * pdf.ts — Server-side PDF generation for quote documents.
 * Uses pdfkit (pure JS, no native binaries, works offline).
 * Returns a Buffer containing valid PDF bytes.
 */

import PDFDocument from "pdfkit";
import type { RFQ } from "./types";

const BRAND = "ForgeSight AI";
const TAGLINE = "Manufacturing Quoting Copilot";

/** Build a PDF quote document from an RFQ with a generated quote. */
export function buildQuotePdf(rfq: RFQ): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (!rfq.quote) {
      return reject(new Error("RFQ has no quote to generate PDF from"));
    }

    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const quote = rfq.quote;
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // ── Header ──────────────────────────────────────────────────────────────
    doc.fontSize(20).font("Helvetica-Bold").text(BRAND, { align: "left" });
    doc.fontSize(9).font("Helvetica").fillColor("#666666").text(TAGLINE);
    doc.fillColor("#000000");

    // Right-align quote metadata
    doc.fontSize(10).font("Helvetica-Bold").text("MANUFACTURING QUOTE", {
      align: "right",
    });
    doc
      .fontSize(9)
      .font("Helvetica")
      .text(`Date: ${date}`, { align: "right" })
      .text(`RFQ ID: ${rfq.id.slice(0, 8).toUpperCase()}`, { align: "right" });

    doc.moveDown(0.5);
    doc
      .moveTo(50, doc.y)
      .lineTo(doc.page.width - 50, doc.y)
      .strokeColor("#000000")
      .lineWidth(1.5)
      .stroke();
    doc.moveDown(1);

    // ── Bill To ──────────────────────────────────────────────────────────────
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#666666").text("BILL TO");
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor("#000000")
      .text(rfq.customerName);
    doc.fontSize(10).font("Helvetica").text(rfq.subject);
    doc.moveDown(1.5);

    // ── Line Items Table ─────────────────────────────────────────────────────
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#666666").text("COST BREAKDOWN");
    doc.moveDown(0.4);

    // Table header
    const colX = { label: 50, formula: 210, amount: 490 };
    const rowH = 20;

    doc.rect(50, doc.y, doc.page.width - 100, rowH).fill("#f3f4f6");
    const headerY = doc.y + 5;
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#374151")
      .text("Line Item", colX.label, headerY)
      .text("Formula", colX.formula, headerY)
      .text("Amount", colX.amount, headerY, { width: 60, align: "right" });

    doc.fillColor("#000000");
    doc.y += rowH + 2;

    // Table rows
    for (const item of quote.lineItems) {
      const rowY = doc.y;
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(item.label, colX.label, rowY, { width: 150 });
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#6b7280")
        .text(item.formula, colX.formula, rowY + 2, { width: 270 });
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#000000")
        .text(
          `$${item.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          colX.amount,
          rowY,
          { width: 60, align: "right" }
        );
      doc.y = rowY + rowH;
      doc
        .moveTo(50, doc.y - 2)
        .lineTo(doc.page.width - 50, doc.y - 2)
        .strokeColor("#e5e7eb")
        .lineWidth(0.5)
        .stroke();
    }

    doc.moveDown(0.5);

    // ── Totals ────────────────────────────────────────────────────────────────
    const totalsX = 380;
    const totalsWidth = 170;

    const totalsRows = [
      { label: "Subtotal", value: quote.totals.subtotal },
      { label: `Overhead (${Math.round(quote.totals.overheadPct * 100)}%)`, value: quote.totals.overheadAmount },
      { label: `Margin (${Math.round(quote.totals.marginPct * 100)}%)`, value: quote.totals.marginAmount },
    ];

    for (const row of totalsRows) {
      const rowY = doc.y;
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#6b7280")
        .text(row.label, totalsX, rowY, { width: 100 });
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#000000")
        .text(
          `$${row.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          totalsX + 100,
          rowY,
          { width: 70, align: "right" }
        );
      doc.y = rowY + 16;
    }

    // Total line
    doc
      .moveTo(totalsX, doc.y)
      .lineTo(totalsX + totalsWidth, doc.y)
      .strokeColor("#000000")
      .lineWidth(1)
      .stroke();
    doc.moveDown(0.3);

    const totalY = doc.y;
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("TOTAL", totalsX, totalY)
      .text(
        `$${quote.totals.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        totalsX + 100,
        totalY,
        { width: 70, align: "right" }
      );

    doc.moveDown(2);

    // ── Assumptions ──────────────────────────────────────────────────────────
    if (quote.assumptions.length > 0) {
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#666666").text("ASSUMPTIONS & SHOP RATES");
      doc.moveDown(0.3);
      for (const assumption of quote.assumptions) {
        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor("#374151")
          .text(`• ${assumption}`);
      }
    }

    doc.moveDown(1.5);

    // ── Extracted Fields Summary ──────────────────────────────────────────────
    const confirmedFields = rfq.extractedFields.filter((f) => f.isConfirmed || f.confidence >= 0.85);
    if (confirmedFields.length > 0) {
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#666666").text("RFQ SPECIFICATIONS");
      doc.moveDown(0.3);
      for (const field of confirmedFields) {
        const val = field.userOverrideValue ?? field.value;
        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor("#374151")
          .text(`${field.label}: `, { continued: true })
          .font("Helvetica-Bold")
          .text(val);
      }
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 70;
    doc
      .moveTo(50, footerY)
      .lineTo(doc.page.width - 50, footerY)
      .strokeColor("#d1d5db")
      .lineWidth(0.5)
      .stroke();

    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#9ca3af")
      .text(
        `Generated by ${BRAND} — deterministic pricing engine. This quote is valid for 30 days from the date of issue.`,
        50,
        footerY + 8,
        { align: "center", width: doc.page.width - 100 }
      )
      .text(
        "⚠ SIMULATION — No actual email was sent. For demo purposes only.",
        50,
        footerY + 22,
        { align: "center", width: doc.page.width - 100 }
      );

    doc.end();
  });
}
