import { useState, useRef, useEffect } from 'react';
import { FileDown, FileSpreadsheet, FileText, ChevronDown, Loader2 } from 'lucide-react';
import { DeliveryRecord } from '../types';
import { ExportMeta, StatusHistoryCounts } from '../utils/export';
import {
  computeAllOpsSummary,
  serializeAllOpsRow,
  ALL_OPS_COLUMNS,
  PDF_ALL_OPS_COLUMNS,
  downloadAllOpsCSV,
  downloadAllOpsExcel,
  downloadAllOpsPDF,
} from '../utils/allOpsExport';
import { downloadDocx } from '../utils/exportDocx';

interface Props {
  records: DeliveryRecord[];
  meta: ExportMeta;
  activeFilterLabel?: string;
  statusHistoryCounts?: StatusHistoryCounts;
}

type Format = 'csv' | 'excel' | 'pdf' | 'docx';

export default function AllOpsExportMenu({ records, meta, activeFilterLabel, statusHistoryCounts }: Props) {
  const [open,    setOpen]    = useState(false);
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
      const rows        = records.map(serializeAllOpsRow);
      const summary     = computeAllOpsSummary(records, 'nearest');
      const reportTitle = activeFilterLabel
        ? `${activeFilterLabel} — Comprehensive Report`
        : 'All Operations — Comprehensive Report';

      if (fmt === 'csv')   downloadAllOpsCSV(rows, ALL_OPS_COLUMNS, 'all-operations', meta, summary, reportTitle, statusHistoryCounts);
      if (fmt === 'excel') await downloadAllOpsExcel(rows, ALL_OPS_COLUMNS, 'all-operations', meta, summary, reportTitle, statusHistoryCounts);
      if (fmt === 'pdf')   await downloadAllOpsPDF(rows, PDF_ALL_OPS_COLUMNS, 'all-operations', meta, summary, reportTitle, statusHistoryCounts);
      if (fmt === 'docx')  await downloadDocx(rows, ALL_OPS_COLUMNS, reportTitle, 'all-operations', meta, summary, reportTitle);
    } catch (err) {
      console.error('All Ops export failed:', err);
    } finally {
      setLoading(null);
    }
  };

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
          : <FileDown className="w-3.5 h-3.5" />}
        {isLoading
          ? `Exporting ${loading?.toUpperCase()}…`
          : activeFilterLabel
            ? `Export · ${activeFilterLabel}`
            : 'Export'}
        {!isLoading && <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-lg py-2 w-52">
          <div className="pt-0">
            <button
              onClick={() => run('csv')}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button
              onClick={() => run('docx')}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[11px] font-bold text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" /> Export Word (.docx)
            </button>
            <button
              onClick={() => run('excel')}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[11px] font-bold text-green-700 hover:bg-green-50 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
            </button>
            <button
              onClick={() => run('pdf')}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[11px] font-bold text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" /> Export PDF
            </button>
          </div>

          <div className="mx-3.5 mt-1 pt-1 border-t border-slate-100 text-[9px] text-slate-400 pb-1">
            {records.length} record{records.length !== 1 ? 's' : ''} · includes cover summary
          </div>
        </div>
      )}
    </div>
  );
}
