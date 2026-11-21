import { useMemo, useState } from 'react';
import { ChevronDown, Eye, Pencil, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import {
  CATEGORIES,
  SHIFTS,
  type CategoryType,
  type HandoverReport,
  type HistoryFilters,
  type ShiftType,
  type UserProfile,
} from '../../shared/types/handover';
import {
  canEditReport,
  computeCaseDurations,
  filterAndSortReports,
  formatDateTimeId,
  formatDisplayDate,
  formatWorkflowBadge,
  getOperationalDateString,
} from '../../domain/handover/handoverLogic';

interface HistoryViewProps {
  reports: HandoverReport[];
  loading: boolean;
  currentUser: UserProfile;
  filters: HistoryFilters;
  onChangeFilters: (next: HistoryFilters) => void;
  onSelectReport: (report: HandoverReport) => void;
  onEditReport: (report: HandoverReport) => void;
}

export function HistoryView({
  reports,
  loading,
  currentUser,
  filters,
  onChangeFilters,
  onSelectReport,
  onEditReport,
}: HistoryViewProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
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

  const filteredReports = useMemo(
    () => filterAndSortReports(reports, filters),
    [reports, filters]
  );

  const durationByReportId = useMemo(() => {
    const map = new Map<string, number>();
    const allDurations = computeCaseDurations(reports);
    for (const item of allDurations) {
      for (const reportId of item.reportIds) {
        map.set(
          reportId,
          item.countedReportIds.includes(reportId) ? item.durationShifts : 0
        );
      }
    }
    return map;
  }, [reports]);

  const startDate = filters.startDate ?? '';
  const endDate = filters.endDate ?? '';
  const statusFilter = filters.status ?? 'ALL';

  const activeExtraFilterCount =
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0) +
    (filters.shift !== 'ALL' ? 1 : 0) +
    (filters.category !== 'ALL' ? 1 : 0) +
    (statusFilter !== 'ALL' ? 1 : 0);

  const hasActiveFilters =
    Boolean(filters.date) ||
    Boolean(startDate) ||
    Boolean(endDate) ||
    filters.shift !== 'ALL' ||
    filters.category !== 'ALL' ||
    statusFilter !== 'ALL' ||
    Boolean(filters.keyword.trim());

  function resetFilters() {
    onChangeFilters({
      date: '',
      startDate: '',
      endDate: '',
      shift: 'ALL',
      category: 'ALL',
      status: 'ALL',
      keyword: '',
    });
  }

  function applyDatePreset(preset: 'all' | 'today' | '7days' | 'month') {
    if (preset === 'all') {
      onChangeFilters({ ...filters, date: '', startDate: '', endDate: '' });
    } else if (preset === 'today') {
      onChangeFilters({
        ...filters,
        date: '',
        startDate: operationalToday,
        endDate: operationalToday,
      });
    } else if (preset === '7days') {
      onChangeFilters({
        ...filters,
        date: '',
        startDate: past7DateStr,
        endDate: operationalToday,
      });
    } else if (preset === 'month') {
      onChangeFilters({
        ...filters,
        date: '',
        startDate: monthStartStr,
        endDate: operationalToday,
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="bg-white dark:bg-[#0B0C0E] rounded-xl border border-slate-200 dark:border-zinc-800/90 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="filter-keyword"
              aria-label="Cari mesin, palet, atau PIC"
              type="text"
              value={filters.keyword}
              onChange={(e) => onChangeFilters({ ...filters, keyword: e.target.value })}
              placeholder="Cari mesin, palet, keterangan, atau PIC..."
              className="w-full min-h-[42px] pl-9 pr-3 py-1.5 text-sm border border-slate-300 dark:border-zinc-800 rounded-xl bg-white dark:bg-[#07080A] text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-600/25 focus:border-teal-600 dark:focus:ring-teal-500/60 dark:focus:border-teal-500"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
            <button
              type="button"
              aria-expanded={showAdvancedFilters}
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
              className={`min-h-[42px] px-3.5 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap ${
                showAdvancedFilters || activeExtraFilterCount > 0
                  ? 'border-teal-300 dark:border-teal-700/70 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300'
                  : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#14171C] hover:bg-slate-50 dark:hover:bg-[#1C2027] text-slate-700 dark:text-zinc-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filter</span>
              {activeExtraFilterCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-teal-700 dark:bg-teal-500 text-white dark:text-zinc-950 text-[10px] font-bold tabular-nums leading-none">
                  {activeExtraFilterCount}
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  showAdvancedFilters ? 'rotate-180' : ''
                }`}
              />
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#14171C] hover:bg-slate-50 dark:hover:bg-[#1C2027] text-xs font-semibold text-slate-700 dark:text-zinc-200 active:scale-[0.97] inline-flex items-center gap-1.5 whitespace-nowrap transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#121417] border border-transparent dark:border-zinc-800/80">
            <button
              type="button"
              onClick={() => applyDatePreset('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                !startDate && !endDate && !filters.date
                  ? 'bg-white dark:bg-[#1E222A] text-teal-700 dark:text-teal-400 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('today')}
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
              onClick={() => applyDatePreset('7days')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                startDate === past7DateStr && endDate === operationalToday
                  ? 'bg-white dark:bg-[#1E222A] text-teal-700 dark:text-teal-400 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              7 Hari
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('month')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                startDate === monthStartStr && endDate === operationalToday
                  ? 'bg-white dark:bg-[#1E222A] text-teal-700 dark:text-teal-400 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              Bulan Ini
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-zinc-400 tabular-nums">
            <span className="font-semibold text-slate-800 dark:text-zinc-100">
              {filteredReports.length}
            </span>{' '}
            dari{' '}
            <span className="font-semibold text-slate-800 dark:text-zinc-100">
              {reports.length}
            </span>{' '}
            laporan
          </p>
        </div>

        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label
                htmlFor="filter-start-date"
                className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1"
              >
                Dari Tanggal
              </label>
              <input
                id="filter-start-date"
                type="date"
                value={startDate}
                onChange={(e) =>
                  onChangeFilters({ ...filters, date: '', startDate: e.target.value })
                }
                className="w-full min-h-[40px] px-3 py-1.5 text-sm font-mono border border-slate-300 dark:border-zinc-800 rounded-lg bg-white dark:bg-[#07080A] text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-600/25 focus:border-teal-600 dark:focus:ring-teal-500/60 dark:focus:border-teal-500"
              />
            </div>

            <div>
              <label
                htmlFor="filter-end-date"
                className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1"
              >
                Sampai Tanggal
              </label>
              <input
                id="filter-end-date"
                type="date"
                value={endDate}
                onChange={(e) =>
                  onChangeFilters({ ...filters, date: '', endDate: e.target.value })
                }
                className="w-full min-h-[40px] px-3 py-1.5 text-sm font-mono border border-slate-300 dark:border-zinc-800 rounded-lg bg-white dark:bg-[#07080A] text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-600/25 focus:border-teal-600 dark:focus:ring-teal-500/60 dark:focus:border-teal-500"
              />
            </div>

            <div>
              <label
                htmlFor="filter-shift"
                className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1"
              >
                Shift
              </label>
              <select
                id="filter-shift"
                value={filters.shift}
                onChange={(e) =>
                  onChangeFilters({ ...filters, shift: e.target.value as ShiftType | 'ALL' })
                }
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
                htmlFor="filter-category"
                className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1"
              >
                Kategori
              </label>
              <select
                id="filter-category"
                value={filters.category}
                onChange={(e) =>
                  onChangeFilters({
                    ...filters,
                    category: e.target.value as CategoryType | 'ALL',
                  })
                }
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

            <div>
              <label
                htmlFor="filter-status"
                className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1"
              >
                Status
              </label>
              <select
                id="filter-status"
                value={statusFilter}
                onChange={(e) =>
                  onChangeFilters({
                    ...filters,
                    status: e.target.value as 'ALL' | 'OPEN' | 'COMPLETED',
                  })
                }
                className="w-full min-h-[40px] px-3 py-1.5 text-sm border border-slate-300 dark:border-zinc-800 rounded-lg bg-white dark:bg-[#07080A] text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-600/25 focus:border-teal-600 dark:focus:ring-teal-500/60 dark:focus:border-teal-500"
              >
                <option value="ALL">Semua Status</option>
                <option value="OPEN">Berlanjut</option>
                <option value="COMPLETED">Selesai (OK)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="bg-white dark:bg-[#0B0C0E] rounded-xl border border-slate-200 dark:border-zinc-800/90 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-zinc-400">
            Memuat data laporan...
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              Tidak ada laporan yang cocok dengan filter saat ini.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-3 min-h-[40px] px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#14171C] hover:bg-slate-50 dark:hover:bg-[#1C2027] text-xs font-semibold text-slate-700 dark:text-zinc-200 shadow-xs hover:shadow-sm active:scale-[0.97] transition-all"
              >
                Tampilkan Semua Laporan
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[780px] text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#121417] border-b border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-600 dark:text-zinc-400">
                    <th className="py-3 px-4">Waktu &amp; Shift</th>
                    <th className="py-3 px-4">Mesin &amp; Kategori</th>
                    <th className="py-3 px-4">Tahap &amp; Keterangan</th>
                    <th className="py-3 px-4">Lokasi Palet</th>
                    <th className="py-3 px-4">PIC</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/70">
                  {filteredReports.map((rep) => {
                    const editable = canEditReport(rep, currentUser);
                    const durationShifts = durationByReportId.get(rep.id);
                    const badge = formatWorkflowBadge(rep);
                    return (
                      <tr
                        key={rep.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-[#13161B] align-top transition-colors"
                      >
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <p className="font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-zinc-100">
                            {formatDisplayDate(rep.reportDate)}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                            {rep.shift}
                          </p>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-mono text-xs font-semibold text-teal-700 dark:text-teal-400 whitespace-nowrap">
                            {rep.machine || '—'}
                            {durationShifts !== undefined && (
                              <span className="text-slate-500 dark:text-zinc-400 font-medium">
                                {' '}
                                · Total: {durationShifts} Shift
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                            {rep.category}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 max-w-md space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            {badge && (
                              <span
                                className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold ${badge.badgeClass}`}
                              >
                                {badge.badgeLabel}
                              </span>
                            )}
                            {rep.isCompleted && (
                              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                                · Selesai (OK)
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-slate-900 dark:text-zinc-100 line-clamp-2 leading-snug">
                            {rep.information}
                          </p>
                          {rep.leakLine && (
                            <p className="font-mono text-xs font-semibold text-rose-700 dark:text-rose-400">
                              Line Bocor: {rep.leakLine}
                            </p>
                          )}
                          {rep.followUp && (
                            <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-1">
                              Lanjut: {rep.followUp}
                            </p>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-xs text-slate-700 dark:text-zinc-300 whitespace-nowrap">
                          {rep.palletLocation || '—'}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <p className="text-xs font-medium text-slate-800 dark:text-zinc-200">
                            {rep.createdByName}
                          </p>
                          <p className="font-mono text-[11px] tabular-nums text-slate-400 dark:text-zinc-500 mt-0.5">
                            {formatDateTimeId(rep.updatedAt)}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onSelectReport(rep)}
                              aria-label={`Detail laporan ${rep.reportDate} ${rep.shift}`}
                              className="min-h-[34px] px-3 py-1 rounded-full border border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-[#16191F] hover:bg-slate-50 dark:hover:bg-[#1E222A] text-xs font-semibold text-slate-700 dark:text-zinc-200 shadow-xs hover:shadow-sm active:scale-[0.97] inline-flex items-center gap-1 transition-all"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Detail</span>
                            </button>
                            {editable && (
                              <button
                                type="button"
                                onClick={() => onEditReport(rep)}
                                aria-label={`Edit laporan ${rep.reportDate} ${rep.shift}`}
                                className="min-h-[34px] px-3 py-1 rounded-full bg-teal-700 hover:bg-teal-800 dark:bg-teal-500 dark:hover:bg-teal-400 text-xs font-semibold text-white dark:text-zinc-950 shadow-xs shadow-teal-700/20 dark:shadow-teal-500/15 hover:shadow-sm active:scale-[0.97] inline-flex items-center gap-1 transition-all"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile List */}
            <div className="md:hidden divide-y divide-slate-200 dark:divide-zinc-800/90">
              {filteredReports.map((rep) => {
                const editable = canEditReport(rep, currentUser);
                const durationShifts = durationByReportId.get(rep.id);
                const badge = formatWorkflowBadge(rep);
                return (
                  <article key={rep.id} className="p-4 space-y-2.5">
                    <button
                      type="button"
                      onClick={() => onSelectReport(rep)}
                      aria-label={`Buka detail laporan ${rep.machine || 'Umum'} ${rep.shift} ${formatDisplayDate(rep.reportDate)}`}
                      className="w-full text-left space-y-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-zinc-400">
                        <div className="min-w-0 truncate">
                          <span className="font-semibold text-slate-900 dark:text-zinc-100">
                            {rep.shift}
                          </span>
                          <span aria-hidden="true"> · </span>
                          <span>{rep.category}</span>
                        </div>
                        <span className="font-mono tabular-nums shrink-0">
                          {formatDisplayDate(rep.reportDate)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-mono text-sm font-bold text-teal-700 dark:text-teal-400">
                          {rep.machine || 'Umum / Non-Mesin'}
                          {durationShifts !== undefined && (
                            <span className="text-slate-500 dark:text-zinc-400 font-medium text-xs">
                              {' '}
                              · Total: {durationShifts} Shift
                            </span>
                          )}
                        </p>
                        {rep.isCompleted && (
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            Selesai (OK)
                          </span>
                        )}
                      </div>

                      {badge && (
                        <div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold ${badge.badgeClass}`}
                          >
                            {badge.badgeLabel}
                          </span>
                        </div>
                      )}

                      <p className="text-sm text-slate-900 dark:text-zinc-100 leading-relaxed line-clamp-3">
                        {rep.information}
                      </p>

                      {(rep.leakLine || rep.followUp || rep.palletLocation) && (
                        <div className="text-xs text-slate-500 dark:text-zinc-400 space-y-0.5">
                          {rep.leakLine && (
                            <p className="font-mono font-semibold text-rose-700 dark:text-rose-400">
                              Line Bocor: {rep.leakLine}
                            </p>
                          )}
                          {rep.followUp && <p>Lanjut: {rep.followUp}</p>}
                          {rep.palletLocation && (
                            <p className="font-mono">Palet: {rep.palletLocation}</p>
                          )}
                        </div>
                      )}
                    </button>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/70 text-xs text-slate-500 dark:text-zinc-400">
                      <div className="min-w-0 truncate">
                        <span className="font-medium text-slate-700 dark:text-zinc-300">
                          {rep.createdByName}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono tabular-nums">
                          {formatDateTimeId(rep.updatedAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {editable ? (
                          <button
                            type="button"
                            onClick={() => onEditReport(rep)}
                            className="min-h-[36px] px-3.5 py-1 rounded-full bg-teal-700 hover:bg-teal-800 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-zinc-950 font-semibold shadow-sm shadow-teal-700/20 dark:shadow-teal-500/15 active:scale-[0.97] inline-flex items-center gap-1 transition-all"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        ) : (
                          <span className="text-[11px] font-medium text-teal-700 dark:text-teal-400">
                            Ketuk kartu →
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
