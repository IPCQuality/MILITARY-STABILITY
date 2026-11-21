import { useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import {
  CATEGORIES,
  SHIFTS,
  type CategoryType,
  type HandoverReport,
  type ShiftType,
} from '../../shared/types/handover';
import { loadReportsFirebase } from '../../backend/services';
import {
  buildHandoverFilename,
  downloadHandoverExcel,
} from '../../domain/handover/excelExport';
import {
  computeCaseDurations,
  countMilitaryInReport,
  countStabilityInReport,
  filterAndSortReports,
  formatDisplayDate,
  formatWorkflowBadge,
  getOperationalDateString,
} from '../../domain/handover/handoverLogic';

interface ExportViewProps {
  reports: HandoverReport[];
  onRefreshReports: (nextReports: HandoverReport[]) => void;
}

export function ExportView({ reports, onRefreshReports }: ExportViewProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportShift, setExportShift] = useState<ShiftType | 'ALL'>('ALL');
  const [exportCategory, setExportCategory] = useState<CategoryType | 'ALL'>('ALL');
  const [exporting, setExporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const allDurations = useMemo(() => computeCaseDurations(reports), [reports]);

  const durationByReportId = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of allDurations) {
      for (const reportId of item.reportIds) {
        map.set(
          reportId,
          item.countedReportIds.includes(reportId) ? item.durationShifts : 0
        );
      }
    }
    return map;
  }, [allDurations]);

  const previewRows = useMemo(
    () =>
      filterAndSortReports(reports, {
        date: '',
        startDate,
        endDate,
        shift: exportShift,
        category: exportCategory,
        keyword: '',
      }),
    [reports, startDate, endDate, exportShift, exportCategory]
  );

  const exportMetrics = useMemo(() => {
    const previewIdSet = new Set(previewRows.map((r) => r.id));
    const totalCases = allDurations.filter((item) =>
      item.reportIds.some((id) => previewIdSet.has(id))
    ).length;
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
      totalCases,
      totalMilitary,
      totalStability,
    };
  }, [previewRows, allDurations]);

  const operationalToday = getOperationalDateString();
  const [opYear, opMonth, opDay] = operationalToday.split('-').map(Number);
  const past7DateStr = useMemo(() => {
    const d = new Date(opYear, opMonth - 1, opDay - 6, 12, 0);
    return getOperationalDateString(d);
  }, [opYear, opMonth, opDay]);
  const monthStartStr = useMemo(() => {
    const d = new Date(opYear, opMonth - 1, 1, 12, 0);
    return getOperationalDateString(d);
  }, [opYear, opMonth]);

  const targetFilename = buildHandoverFilename();

  function applyPreset(preset: 'all' | 'today' | '7days' | 'month') {
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      setStartDate(operationalToday);
      setEndDate(operationalToday);
    } else if (preset === '7days') {
      setStartDate(past7DateStr);
      setEndDate(operationalToday);
    } else if (preset === 'month') {
      setStartDate(monthStartStr);
      setEndDate(operationalToday);
    }
  }

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
        date: '',
        startDate,
        endDate,
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

      const result = downloadHandoverExcel(
        filteredForExport,
        targetFilename,
        fresh.reports
      );
      setStatusMsg({
        ok: true,
        text: `Berhasil mengunduh ${result.filename} (${result.rowCount} laporan).`,
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Filter & Download Card */}
      <div className="bg-white dark:bg-[#0B0C0E] rounded-xl border border-slate-200 dark:border-zinc-800/90 divide-y divide-slate-200 dark:divide-zinc-800/90 overflow-hidden">
        <div className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              Filter Data Ekspor
            </span>
            <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#121417] border border-transparent dark:border-zinc-800/80">
              <button
                type="button"
                onClick={() => applyPreset('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  startDate === '' && endDate === ''
                    ? 'bg-white dark:bg-[#1E222A] text-teal-700 dark:text-teal-400 shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => applyPreset('today')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  startDate === operationalToday && endDate === operationalToday
                    ? 'bg-white dark:bg-[#1E222A] text-teal-700 dark:text-teal-400 shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => applyPreset('7days')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  startDate === past7DateStr && endDate === operationalToday
                    ? 'bg-white dark:bg-[#1E222A] text-teal-700 dark:text-teal-400 shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                7 Hari Terakhir
              </button>
              <button
                type="button"
                onClick={() => applyPreset('month')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  startDate === monthStartStr && endDate === operationalToday
                    ? 'bg-white dark:bg-[#1E222A] text-teal-700 dark:text-teal-400 shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                Bulan Ini
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label
                htmlFor="export-start-date"
                className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1"
              >
                Dari Tanggal
              </label>
              <input
                id="export-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full min-h-[40px] px-3 py-1.5 text-sm font-mono border border-slate-300 dark:border-zinc-800 rounded-lg bg-white dark:bg-[#07080A] text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-600/25 focus:border-teal-600 dark:focus:ring-teal-500/60 dark:focus:border-teal-500"
              />
            </div>

            <div>
              <label
                htmlFor="export-end-date"
                className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1"
              >
                Sampai Tanggal
              </label>
              <input
                id="export-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full min-h-[40px] px-3 py-1.5 text-sm font-mono border border-slate-300 dark:border-zinc-800 rounded-lg bg-white dark:bg-[#07080A] text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-600/25 focus:border-teal-600 dark:focus:ring-teal-500/60 dark:focus:border-teal-500"
              />
            </div>

            <div>
              <label
                htmlFor="export-shift"
                className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1"
              >
                Shift
              </label>
              <select
                id="export-shift"
                value={exportShift}
                onChange={(e) => setExportShift(e.target.value as ShiftType | 'ALL')}
                className="w-full min-h-[40px] px-3 py-1.5 text-sm border border-slate-300 dark:border-zinc-800 rounded-lg bg-white dark:bg-[#07080A] text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-600/25 focus:border-teal-600 dark:focus:ring-teal-500/60 dark:focus:border-teal-500"
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
              <label
                htmlFor="export-category"
                className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1"
              >
                Kategori
              </label>
              <select
                id="export-category"
                value={exportCategory}
                onChange={(e) => setExportCategory(e.target.value as CategoryType | 'ALL')}
                className="w-full min-h-[40px] px-3 py-1.5 text-sm border border-slate-300 dark:border-zinc-800 rounded-lg bg-white dark:bg-[#07080A] text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-600/25 focus:border-teal-600 dark:focus:ring-teal-500/60 dark:focus:border-teal-500"
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
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800/60 dark:text-emerald-200'
                  : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/60 dark:border-rose-800/60 dark:text-rose-200'
              }`}
            >
              {statusMsg.text}
            </div>
          )}
        </div>

        {/* Summary Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-zinc-800/90 bg-slate-50/60 dark:bg-[#121417]">
          <div className="px-5 py-3.5">
            <p className="text-xs text-slate-500 dark:text-zinc-400">Baris Laporan</p>
            <p className="mt-0.5 text-lg font-bold text-slate-900 dark:text-zinc-100 tabular-nums">
              {exportMetrics.totalReports}
            </p>
          </div>
          <div className="px-5 py-3.5">
            <p className="text-xs text-slate-500 dark:text-zinc-400">Total Case</p>
            <p className="mt-0.5 text-lg font-bold text-slate-900 dark:text-zinc-100 tabular-nums">
              {exportMetrics.totalCases}
            </p>
          </div>
          <div className="px-5 py-3.5">
            <p className="text-xs text-slate-500 dark:text-zinc-400">Total Military</p>
            <p className="mt-0.5 text-lg font-bold text-teal-700 dark:text-teal-400 tabular-nums">
              {exportMetrics.totalMilitary}
            </p>
          </div>
          <div className="px-5 py-3.5">
            <p className="text-xs text-slate-500 dark:text-zinc-400">Total Stability</p>
            <p className="mt-0.5 text-lg font-bold text-cyan-700 dark:text-cyan-400 tabular-nums">
              {exportMetrics.totalStability}
            </p>
          </div>
        </div>

        {/* Download Footer */}
        <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-slate-700 dark:text-zinc-300">
              Siap unduh {previewRows.length} baris laporan
            </p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono truncate">
              File: {targetFilename}
            </p>
          </div>

          <button
            type="button"
            disabled={exporting || previewRows.length === 0}
            onClick={handleExportExcel}
            className="w-full sm:w-auto min-h-[46px] px-6 py-2.5 rounded-full bg-teal-700 hover:bg-teal-800 dark:bg-teal-500 dark:hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white dark:text-zinc-950 text-sm font-semibold shadow-md shadow-teal-700/25 dark:shadow-teal-500/20 hover:shadow-lg active:scale-[0.98] inline-flex items-center justify-center gap-2 transition-all whitespace-nowrap"
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
      <div className="bg-white dark:bg-[#0B0C0E] rounded-xl border border-slate-200 dark:border-zinc-800/90 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-zinc-800/90 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            Pratinjau Data ({Math.min(5, previewRows.length)} terbaru dari {previewRows.length})
          </h3>
        </div>

        {previewRows.length === 0 ? (
          <div className="py-10 px-4 text-center text-sm text-slate-500 dark:text-zinc-400">
            Tidak ada data yang sesuai filter saat ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#121417] border-b border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-600 dark:text-zinc-400">
                  <th className="py-2.5 px-4">Tanggal &amp; Shift</th>
                  <th className="py-2.5 px-4">Mesin</th>
                  <th className="py-2.5 px-4">Tahap &amp; Hasil</th>
                  <th className="py-2.5 px-4">Lokasi Palet</th>
                  <th className="py-2.5 px-4">Total Durasi</th>
                  <th className="py-2.5 px-4">PIC</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/70">
                {previewRows.slice(0, 5).map((rep) => {
                  const badge = formatWorkflowBadge(rep);
                  const durShifts = durationByReportId.get(rep.id);
                  return (
                    <tr
                      key={rep.id}
                      className="align-top hover:bg-slate-50/70 dark:hover:bg-[#13161B] transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-xs tabular-nums text-slate-900 dark:text-zinc-100">
                          {formatDisplayDate(rep.reportDate)}
                        </span>
                        <span className="text-slate-400 dark:text-zinc-600"> · </span>
                        <span className="text-xs text-slate-600 dark:text-zinc-400">
                          {rep.shift}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-teal-700 dark:text-teal-400 whitespace-nowrap">
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
                        <p className="text-xs text-slate-700 dark:text-zinc-300 line-clamp-1">
                          {rep.information}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                        {rep.palletLocation || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                        {durShifts !== undefined ? `${durShifts} Shift` : '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                        {rep.createdByName}
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        <span
                          className={
                            rep.isCompleted
                              ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                              : 'text-slate-600 dark:text-zinc-400'
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
