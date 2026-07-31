/**
 * DOCX export utility — Word document download for tabular record sets.
 * Uses the `docx` npm package (browser-compatible via dynamic import).
 */

import type { ExportColumn, ExportMeta } from './export';
import type { AllOpsSummary } from './allOpsExport';

// A4 landscape content width in twips (16838 − 2×720 margins)
const CONTENT_W = 15398;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function borderSet(color = 'E2E8F0', size = 4) {
  return { style: 'single' as const, size, color };
}

function cellBorders(color?: string, size?: number) {
  const b = borderSet(color, size);
  return { top: b, bottom: b, left: b, right: b };
}

// ─── Main download function ───────────────────────────────────────────────────

export async function downloadDocx(
  rows:         Record<string, string | number | null | undefined>[],
  columns:      ExportColumn[],
  reportTitle:  string,
  filename:     string,
  meta:         ExportMeta,
  summary?:     AllOpsSummary,
  summaryTitle?: string,
): Promise<void> {
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
    AlignmentType, WidthType, HeadingLevel, PageOrientation,
  } = await import('docx');

  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Column widths proportional to pdfWidth/width, filling the page
  const totalW   = columns.reduce((s, c) => s + (c.pdfWidth ?? c.width ?? 20), 0);
  const colWidths = columns.map(c =>
    Math.round(((c.pdfWidth ?? c.width ?? 20) / totalW) * CONTENT_W),
  );

  // ── Table header row ───────────────────────────────────────────────────────
  const hdrRow = new TableRow({
    tableHeader: true,
    children: columns.map((c, i) =>
      new TableCell({
        shading: { fill: '1F3864' },
        borders: cellBorders('1F3864', 2),
        width: { size: colWidths[i], type: WidthType.DXA },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: c.header, bold: true, color: 'FFFFFF', size: 18 })],
        })],
      }),
    ),
  });

  // ── Data rows ──────────────────────────────────────────────────────────────
  const dataRows = rows.map((row, idx) =>
    new TableRow({
      children: columns.map((c, i) =>
        new TableCell({
          shading: idx % 2 === 1 ? { fill: 'F8F9FA' } : undefined,
          borders: cellBorders(),
          width: { size: colWidths[i], type: WidthType.DXA },
          children: [new Paragraph({
            children: [new TextRun({ text: String(row[c.key] ?? ''), size: 17 })],
          })],
        }),
      ),
    }),
  );

  // ── Summary section (AllOps only) ──────────────────────────────────────────
  const summaryChildren: InstanceType<typeof Paragraph>[] = [];
  if (summary) {
    const title = summaryTitle ?? reportTitle;
    summaryChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: title, bold: true, size: 26, color: '1F3864' })],
        spacing: { before: 200, after: 100 },
      }),
    );

    const kv = (label: string, value: string | number) =>
      new Paragraph({
        children: [
          new TextRun({ text: `${label}: `, bold: true, size: 18 }),
          new TextRun({ text: String(value), size: 18 }),
        ],
        spacing: { after: 60 },
      });

    summaryChildren.push(
      kv('Total Records',   summary.total),
      kv('Overdue',         summary.overdueCount),
      kv('Date Range',      summary.dateRangeStr),
    );

    for (const { status, count, pct } of summary.statusBreakdown) {
      summaryChildren.push(kv(status, `${count} (${pct}%)`));
    }

    if (summary.totalAmountAC > 0) {
      summaryChildren.push(kv('AC Amount', `₱${summary.totalAmountAC.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`));
    }

    summaryChildren.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
  }

  // ── Build document ─────────────────────────────────────────────────────────
  const doc = new Document({
    creator: 'Microgenesis Business Systems',
    title:    reportTitle,
    sections: [{
      properties: {
        page: {
          size: {
            orientation: PageOrientation.LANDSCAPE,
            width:  16838,
            height: 11906,
          },
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children: [
        // Branding
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'Microgenesis Business Systems', bold: true, size: 22, color: '1F3864' })],
          spacing: { after: 40 },
        }),
        // Report title
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: reportTitle, bold: true, size: 28, color: '1F3864' })],
          spacing: { after: 60 },
        }),
        // Meta: date range
        ...(meta.dateRange ? [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `Date Range: ${meta.dateRange}`, size: 18, color: '64748B' })],
          spacing: { after: 40 },
        })] : []),
        // Meta: generated by
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({
            text: `Generated by: ${meta.generatedByName} (${meta.generatedByRole}) · ${dateStr}`,
            size: 18,
            color: '64748B',
          })],
          spacing: { after: 160 },
        }),

        // Optional summary
        ...summaryChildren,

        // Data table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [hdrRow, ...dataRows],
        }),

        // Footer note
        new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 120 } }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({
            text: `${rows.length} record${rows.length !== 1 ? 's' : ''} exported · Microgenesis Business Systems — Confidential`,
            size: 16,
            color: '94A3B8',
          })],
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${filename}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
