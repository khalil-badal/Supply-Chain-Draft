import React, { useState, useRef, useEffect } from 'react';
import { FileDown, FileSpreadsheet, FileText, ChevronDown, Loader2, Route } from 'lucide-react';
import {
  ExportColumn,
  ExportMeta,
  StatusHistoryCounts,
  downloadCSV,
  downloadExcel,
  downloadPDF
} from '../utils/export';
import {
  AllOpsSummary,
  downloadAllOpsCSV,
  downloadAllOpsExcel,
  downloadAllOpsPDF,
} from '../utils/allOpsExport';
import { downloadRouteSlipExcel, downloadRouteSlipPDF, downloadRouteSlipDocx } from '../utils/routeSlip';
import { downloadDocx } from '../utils/exportDocx';
import { DeliveryRecord } from '../types';

interface RouteSlipProps {
  records: DeliveryRecord[];
  driverName: string;
  date: string;
  preparedBy: string;
}

interface Props {
  rows: Record<string, string | number | null | undefined>[];
  columns: ExportColumn[];
  /** Override column set used only for PDF (CSV/Excel still use `columns`). */
  pdfColumns?: ExportColumn[];
  sheetName: string;
  filename: string;
  pdfTitle: string;
  meta: ExportMeta;
  /** Show PDF option? Default true. */
  showPdf?: boolean;
  /** Use portrait orientation for PDF? Default false (landscape). */
  pdfPortrait?: boolean;
  /** When provided, exports include a comprehensive summary cover page / header sheet. */
  summary?: AllOpsSummary;
  /**
   * When provided (driver filter active), Excel and PDF options become
   * "Route Slip" variants. CSV remains unchanged.
   */
  routeSlipProps?: RouteSlipProps;
  statusHistoryCounts?: StatusHistoryCounts;
}

type Format = 'csv' | 'excel' | 'pdf' | 'docx';

export default function ExportMenu({
  rows,
  columns,
  pdfColumns,
  sheetName,
  filename,
  pdfTitle,
  meta,
  showPdf = true,
  pdfPortrait = false,
  summary,
  routeSlipProps,
  statusHistoryCounts,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<Format | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const run = async (fmt: Format) => {
    setOpen(false);
    setLoading(fmt);
    try {
      // Route slip path — replaces Excel/PDF when driver filter is active
      if (routeSlipProps && fmt !== 'csv') {
        const rsParams = { ...routeSlipProps, filename };
        if (fmt === 'excel') await downloadRouteSlipExcel(rsParams);
        if (fmt === 'pdf')   await downloadRouteSlipPDF(rsParams);
      } else if (summary) {
        const summaryTitle = pdfTitle.replace(/ records?$/i, '') + ' — Comprehensive Report';
        if (fmt === 'csv')   downloadAllOpsCSV(rows, columns, filename, meta, summary, summaryTitle);
        if (fmt === 'excel') await downloadAllOpsExcel(rows, columns, filename, meta, summary, summaryTitle);
        if (fmt === 'pdf')   await downloadAllOpsPDF(rows, pdfColumns ?? columns, filename, meta, summary, summaryTitle);
      } else {
        if (fmt === 'csv')   downloadCSV(rows, columns, filename, meta, statusHistoryCounts);
        if (fmt === 'excel') await downloadExcel(rows, columns, sheetName, filename, meta, statusHistoryCounts);
        if (fmt === 'pdf')   await downloadPDF(rows, pdfColumns ?? columns, pdfTitle, filename, meta, !pdfPortrait, statusHistoryCounts);
      }
      if (fmt === 'docx') {
        if (routeSlipProps) {
          await downloadRouteSlipDocx({ ...routeSlipProps, filename });
        } else {
          const summaryTitle = summary ? (pdfTitle.replace(/ records?$/i, '') + ' — Comprehensive Report') : undefined;
          await downloadDocx(rows, columns, pdfTitle, filename, meta, summary, summaryTitle);
        }
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setLoading(null);
    }
  };

  const options: { fmt: Format; label: string; icon: React.ReactNode; color: string }[] = [
    {
      fmt: 'csv',
      label: 'Export CSV',
      icon: <FileText className="w-3.5 h-3.5" />,
      color: 'text-emerald-700 hover:bg-emerald-50'
    },
    {
      fmt: 'docx',
      label: routeSlipProps ? 'Route Slip — Word (.docx)' : 'Export Word (.docx)',
      icon: routeSlipProps ? <Route className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />,
      color: 'text-blue-700 hover:bg-blue-50'
    },
    routeSlipProps
      ? {
          fmt: 'excel' as Format,
          label: 'Route Slip — Excel',
          icon: <Route className="w-3.5 h-3.5" />,
          color: 'text-green-700 hover:bg-green-50'
        }
      : {
          fmt: 'excel' as Format,
          label: 'Export Excel',
          icon: <FileSpreadsheet className="w-3.5 h-3.5" />,
          color: 'text-green-700 hover:bg-green-50'
        },
    ...(routeSlipProps
      ? [{
          fmt: 'pdf' as Format,
          label: 'Route Slip — PDF',
          icon: <Route className="w-3.5 h-3.5" />,
          color: 'text-red-700 hover:bg-red-50'
        }]
      : showPdf
        ? [{
            fmt: 'pdf' as Format,
            label: 'Export PDF',
            icon: <FileDown className="w-3.5 h-3.5" />,
            color: 'text-red-700 hover:bg-red-50'
          }]
        : []
    ),
  ];

  const isLoading = loading !== null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !isLoading && setOpen(o => !o)}
        disabled={isLoading}
        className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-600 text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-lg transition-all cursor-pointer disabled:opacity-60 shadow-xs"
      >
        {isLoading
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <FileDown className="w-3.5 h-3.5" />
        }
        {isLoading ? `Exporting ${loading?.toUpperCase()}…` : 'Export'}
        {!isLoading && <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-max">
          {options.map(opt => (
            <button
              key={opt.fmt}
              onClick={() => run(opt.fmt)}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[11px] font-bold transition-colors cursor-pointer ${opt.color}`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
          <div className="mx-3 mt-1 pt-1 border-t border-slate-100 text-[9px] text-slate-400 pb-1">
            {rows.length} record{rows.length !== 1 ? 's' : ''} will be exported
          </div>
        </div>
      )}
    </div>
  );
}
