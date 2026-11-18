import { useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import {
  CATEGORIES,
  SHIFTS,
  type CategoryType,
  type HandoverReport,
  type ShiftType,
} from '../types/handover';
import { loadReportsFirebase } from '../services/handoverService';
import {
  buildHandoverFilename,
  downloadHandoverExcel,
} from '../utils/excelExport';
import {
  computeCaseDurations,
  countMilitaryInReport,
  countStabilityInReport,
  filterAndSortReports,
  formatWorkflowBadge,
  getOperationalDateString,
  getTodayDateString,
} from '../utils/handoverLogic';

interface ExportViewProps {
  reports: HandoverReport[];
  onRefreshReports: (nextReports: HandoverReport[]) => void;
}

export function ExportView({ reports, onRefreshReports }: ExportViewProps) {
  const [exportDate, setExportDate] = useState('');
  const [exportShift, setExportShift] = useState<ShiftType | 'ALL'>('ALL');
  const [exportCategory, setExportCategory] = useState<CategoryType | 'ALL'>('ALL');
  const [exporting, setExporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const previewRows = useMemo(
    () =>
      filterAndSortReports(reports, {
        date: exportDate,
        shift: exportShift,
        category: exportCategory,
        keyword: '',
      }),
    [reports, exportDate, exportShift, exportCategory]
  );

  const exportMetrics = useMemo(() => {
    const cases = computeCaseDurations(previewRows);
    const totalMilitary = previewRows.reduce(
      (sum, rep) => sum + countMilitaryInReport(rep),
      0
    );
    const totalStability = previewRows.reduce(
      (sum, rep) => sum + countStabilityInReport(rep),
      0
    );
    return {
      totalReports: previewRows.length,
      totalCases: cases.length,
      totalMilitary,
      totalStability,
    };
  }, [previewRows]);

  const operationalToday = getOperationalDateString();
  const targetFilename = buildHandoverFilename(exportDate || getTodayDateString());

  async function handleExportExcel() {
    setStatusMsg(null);
    setExporting(true);
    try {
      const fresh = await loadReportsFirebase();
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
        category: exportCategory,
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
        text: `Berhasil mengunduh ${result.filename} (${result.rowCount} laporan).`,
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
          Report &amp; Ekspor Excel
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Pilih filter data yang dibutuhkan lalu unduh laporan dalam format Excel (.xlsx).
        </p>
      </div>

      {/* Filter & Download Card */}
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-200 overflow-hidden">
        <div className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-900">Filter Data Ekspor</span>
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100">
              <button
                type="button"
                onClick={() => setExportDate('')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  exportDate === ''
                    ? 'bg-white text-[#0F294A] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Tanggal
              </button>
              <button
                type="button"
                onClick={() => setExportDate(operationalToday)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  exportDate === operationalToday
                    ? 'bg-white text-[#0F294A] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hari Ini
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="export-date" className="block text-xs font-semibold text-slate-600 mb-1">
                Tanggal
              </label>
              <input
                id="export-date"
                type="date"
                value={exportDate}
                onChange={(e) => setExportDate(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
              />
            </div>

            <div>
              <label htmlFor="export-shift" className="block text-xs font-semibold text-slate-600 mb-1">
                Shift
              </label>
              <select
                id="export-shift"
                value={exportShift}
                onChange={(e) => setExportShift(e.target.value as ShiftType | 'ALL')}
                className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
              >
                <option value="ALL">Semua Shift</option>
                {SHIFTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="export-category" className="block text-xs font-semibold text-slate-600 mb-1">
                Kategori
              </label>
              <select
                id="export-category"
                value={exportCategory}
                onChange={(e) => setExportCategory(e.target.value as CategoryType | 'ALL')}
                className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
              >
                <option value="ALL">Semua Kategori</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
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
        </div>

        {/* Summary Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/60">
          <div className="px-5 py-3.5">
            <p className="text-xs text-slate-500">Baris Laporan</p>
            <p className="mt-0.5 text-lg font-bold text-slate-900 tabular-nums">
              {exportMetrics.totalReports}
            </p>
          </div>
          <div className="px-5 py-3.5">
            <p className="text-xs text-slate-500">Total Case</p>
            <p className="mt-0.5 text-lg font-bold text-slate-900 tabular-nums">
              {exportMetrics.totalCases}
            </p>
          </div>
          <div className="px-5 py-3.5">
            <p className="text-xs text-slate-500">Total Military</p>
            <p className="mt-0.5 text-lg font-bold text-[#0F294A] tabular-nums">
              {exportMetrics.totalMilitary}
            </p>
          </div>
          <div className="px-5 py-3.5">
            <p className="text-xs text-slate-500">Total Stability</p>
            <p className="mt-0.5 text-lg font-bold text-teal-700 tabular-nums">
              {exportMetrics.totalStability}
            </p>
          </div>
        </div>

        {/* Download Footer */}
        <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-slate-500">
            Nama file:{' '}
            <span className="font-mono font-semibold text-slate-900">{targetFilename}</span>
          </div>

          <button
            type="button"
            disabled={exporting || previewRows.length === 0}
            onClick={handleExportExcel}
            className="min-h-[44px] px-6 py-2.5 rounded-full bg-[#0F294A] hover:bg-[#163864] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-md shadow-[#0F294A]/25 hover:shadow-lg active:scale-[0.98] inline-flex items-center justify-center gap-2 transition-all whitespace-nowrap"
          >
            {exporting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{exporting ? 'Menyiapkan Excel...' : 'Unduh Excel (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* Preview Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Pratinjau Data ({Math.min(5, previewRows.length)} terbaru dari {previewRows.length})
          </h3>
        </div>

        {previewRows.length === 0 ? (
          <div className="py-10 px-4 text-center text-sm text-slate-500">
            Tidak ada data yang sesuai filter saat ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Tanggal &amp; Shift</th>
                  <th className="py-2.5 px-4">Mesin</th>
                  <th className="py-2.5 px-4">Tahap &amp; Hasil</th>
                  <th className="py-2.5 px-4">Lokasi Palet</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewRows.slice(0, 5).map((rep) => {
                  const badge = formatWorkflowBadge(rep);
                  return (
                    <tr key={rep.id} className="align-top">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-xs tabular-nums text-slate-900">
                          {rep.reportDate}
                        </span>
                        <span className="text-slate-400"> · </span>
                        <span className="text-xs text-slate-600">{rep.shift}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-[#0F294A] whitespace-nowrap">
                        {rep.machine || '—'}
                      </td>
                      <td className="py-3 px-4 max-w-xs space-y-1">
                        {badge && (
                          <span
                            className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold ${badge.badgeClass}`}
                          >
                            {badge.badgeLabel}
                          </span>
                        )}
                        <p className="text-xs text-slate-700 line-clamp-1">{rep.information}</p>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {rep.palletLocation || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        <span
                          className={
                            rep.isCompleted
                              ? 'font-semibold text-emerald-700'
                              : 'text-slate-600'
                          }
                        >
                          {rep.isCompleted ? 'Selesai (OK)' : 'Berlanjut'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
