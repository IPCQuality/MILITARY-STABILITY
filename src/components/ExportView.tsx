import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { SHIFTS, type HandoverReport, type ShiftType } from '../types/handover';
import { loadReportsUnified } from '../services/handoverService';
import {
  buildHandoverFilename,
  downloadHandoverExcel,
} from '../utils/excelExport';
import { filterAndSortReports, getTodayDateString } from '../utils/handoverLogic';

interface ExportViewProps {
  mode: 'supabase' | 'demo';
  reports: HandoverReport[];
  onRefreshReports: (nextReports: HandoverReport[]) => void;
}

export function ExportView({ mode, reports, onRefreshReports }: ExportViewProps) {
  const [exportDate, setExportDate] = useState('');
  const [exportShift, setExportShift] = useState<ShiftType | 'ALL'>('ALL');
  const [exporting, setExporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const previewRows = useMemo(
    () =>
      filterAndSortReports(reports, {
        date: exportDate,
        shift: exportShift,
        category: 'ALL',
        keyword: '',
      }),
    [reports, exportDate, exportShift]
  );

  const targetFilename = buildHandoverFilename(exportDate || getTodayDateString());

  async function handleExportExcel() {
    setStatusMsg(null);
    setExporting(true);
    try {
      // Ambil data langsung dari Supabase Cloud (atau store aktif) agar tidak hanya bergantung pada tampilan layar
      const fresh = await loadReportsUnified(mode);
      if (fresh.error) {
        setStatusMsg({
          ok: false,
          text: `Gagal mengambil data terbaru sebelum ekspor: ${fresh.error}`,
        });
        return;
      }

      onRefreshReports(fresh.reports);

      const filteredForExport = filterAndSortReports(fresh.reports, {
        date: exportDate,
        shift: exportShift,
        category: 'ALL',
        keyword: '',
      });

      if (filteredForExport.length === 0) {
        setStatusMsg({
          ok: false,
          text: 'Tidak ada data laporan yang sesuai filter untuk diekspor.',
        });
        return;
      }

      const result = downloadHandoverExcel(filteredForExport, targetFilename);
      setStatusMsg({
        ok: true,
        text: `Berhasil mengunduh ${result.filename} (${result.rowCount} laporan, 2 worksheet: HANDOVER & DETAIL DATA).`,
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-slate-900">
          Report &amp; Export Excel (.xlsx)
        </h2>
        <p className="text-sm text-slate-500">
          Ekspor seluruh data laporan langsung dari {mode === 'supabase' ? 'Supabase Cloud' : 'Penyimpanan Demo'} ke file Excel dua worksheet.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="export-date" className="block text-xs font-medium text-slate-600 mb-1">
              Filter Tanggal (Kosongkan untuk Semua Tanggal)
            </label>
            <input
              id="export-date"
              type="date"
              value={exportDate}
              onChange={(e) => setExportDate(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
            />
          </div>

          <div>
            <label htmlFor="export-shift" className="block text-xs font-medium text-slate-600 mb-1">
              Filter Shift
            </label>
            <select
              id="export-shift"
              value={exportShift}
              onChange={(e) => setExportShift(e.target.value as ShiftType | 'ALL')}
              className="w-full min-h-[44px] px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">Semua Shift</option>
              {SHIFTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Worksheet Specification Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileSpreadsheet className="w-4 h-4 text-[#0F294A]" />
              <span>Sheet 1: HANDOVER</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Dikelompokkan berdasarkan Tanggal, Shift, Kategori, dan Mesin dengan kolom
              Informasi, Masalah, serta Tindak Lanjut.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileSpreadsheet className="w-4 h-4 text-[#0F294A]" />
              <span>Sheet 2: DETAIL DATA</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Data mentah lengkap termasuk ID unik, Pembuat, Waktu Dibuat, dan Waktu
              Diperbarui, dilengkapi AutoFilter dan Freeze Header.
            </p>
          </div>
        </div>

        {statusMsg && (
          <div
            role="status"
            className={`p-3.5 rounded-lg border text-sm ${
              statusMsg.ok
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-200">
          <div className="text-xs text-slate-600 space-y-0.5">
            <p>
              Nama file: <span className="font-mono font-semibold text-slate-900">{targetFilename}</span>
            </p>
            <p className="tabular-nums">
              Jumlah baris siap ekspor: <span className="font-semibold text-slate-900">{previewRows.length}</span> laporan
            </p>
          </div>

          <button
            type="button"
            disabled={exporting}
            onClick={handleExportExcel}
            className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#0F294A] hover:bg-[#163864] disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            {exporting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{exporting ? 'Mengambil Data & Membuat Excel...' : 'UNDUH EXCEL (.XLSX)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
