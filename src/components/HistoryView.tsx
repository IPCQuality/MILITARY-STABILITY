import { useMemo } from 'react';
import { Eye, Pencil, RotateCcw, Search } from 'lucide-react';
import {
  CATEGORIES,
  SHIFTS,
  type CategoryType,
  type HandoverReport,
  type HistoryFilters,
  type ShiftType,
  type UserProfile,
} from '../types/handover';
import {
  canEditReport,
  computeCaseDurations,
  filterAndSortReports,
  formatDateTimeId,
  formatWorkflowBadge,
} from '../utils/handoverLogic';

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

  const hasActiveFilters =
    Boolean(filters.date) ||
    filters.shift !== 'ALL' ||
    filters.category !== 'ALL' ||
    Boolean(filters.keyword.trim());

  function resetFilters() {
    onChangeFilters({
      date: '',
      shift: 'ALL',
      category: 'ALL',
      keyword: '',
    });
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="sm:col-span-2 lg:col-span-1">
          <label htmlFor="filter-keyword" className="block text-xs font-semibold text-slate-600 mb-1">
            Cari Mesin / Kata Kunci
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="filter-keyword"
              type="text"
              value={filters.keyword}
              onChange={(e) => onChangeFilters({ ...filters, keyword: e.target.value })}
              placeholder="Cari mesin, palet, pembuat..."
              className="w-full min-h-[40px] pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="filter-date" className="block text-xs font-semibold text-slate-600 mb-1">
            Tanggal
          </label>
          <input
            id="filter-date"
            type="date"
            value={filters.date}
            onChange={(e) => onChangeFilters({ ...filters, date: e.target.value })}
            className="w-full min-h-[40px] px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
          />
        </div>

        <div>
          <label htmlFor="filter-shift" className="block text-xs font-semibold text-slate-600 mb-1">
            Shift
          </label>
          <select
            id="filter-shift"
            value={filters.shift}
            onChange={(e) =>
              onChangeFilters({ ...filters, shift: e.target.value as ShiftType | 'ALL' })
            }
            className="w-full min-h-[40px] px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
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
          <label htmlFor="filter-category" className="block text-xs font-semibold text-slate-600 mb-1">
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
            className="w-full min-h-[40px] px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
          >
            <option value="ALL">Semua Kategori</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2 lg:col-span-4 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500 tabular-nums">
            Menampilkan <span className="font-semibold text-slate-800">{filteredReports.length}</span> dari{' '}
            <span className="font-semibold text-slate-800">{reports.length}</span> laporan
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-[32px] px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs active:scale-[0.97] inline-flex items-center gap-1.5 whitespace-nowrap transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Memuat data laporan...
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <p className="text-sm text-slate-600">
              Tidak ada laporan yang cocok dengan filter saat ini.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-3 min-h-[40px] px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs hover:shadow-sm active:scale-[0.97] transition-all"
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
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Waktu &amp; Shift</th>
                    <th className="py-3 px-4">Mesin &amp; Kategori</th>
                    <th className="py-3 px-4">Tahap &amp; Keterangan</th>
                    <th className="py-3 px-4">Lokasi Palet</th>
                    <th className="py-3 px-4">Pembuat</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReports.map((rep) => {
                    const editable = canEditReport(rep, currentUser);
                    const durationShifts = durationByReportId.get(rep.id);
                    const badge = formatWorkflowBadge(rep);
                    return (
                      <tr key={rep.id} className="hover:bg-slate-50/70 align-top">
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <p className="font-mono text-xs font-semibold tabular-nums text-slate-900">
                            {rep.reportDate}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">{rep.shift}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-mono text-xs font-semibold text-[#0F294A] whitespace-nowrap">
                            {rep.machine || '—'}
                            {durationShifts !== undefined && (
                              <span className="text-slate-500 font-medium">
                                {' '}
                                | {durationShifts} Shift
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{rep.category}</p>
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
                              <span className="text-[11px] font-semibold text-emerald-700">
                                · Selesai (OK)
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-slate-900 line-clamp-2 leading-snug">
                            {rep.information}
                          </p>
                          {rep.followUp && (
                            <p className="text-xs text-slate-500 line-clamp-1">
                              Lanjut: {rep.followUp}
                            </p>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                          {rep.palletLocation || '—'}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <p className="text-xs font-medium text-slate-800">{rep.createdByName}</p>
                          <p className="font-mono text-[11px] tabular-nums text-slate-400 mt-0.5">
                            {formatDateTimeId(rep.updatedAt)}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onSelectReport(rep)}
                              aria-label={`Detail laporan ${rep.reportDate} ${rep.shift}`}
                              className="min-h-[34px] px-3 py-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs hover:shadow-sm active:scale-[0.97] inline-flex items-center gap-1 transition-all"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Detail</span>
                            </button>
                            {editable && (
                              <button
                                type="button"
                                onClick={() => onEditReport(rep)}
                                aria-label={`Edit laporan ${rep.reportDate} ${rep.shift}`}
                                className="min-h-[34px] px-3 py-1 rounded-full bg-[#0F294A] hover:bg-[#163864] text-xs font-semibold text-white shadow-xs shadow-[#0F294A]/20 hover:shadow-sm active:scale-[0.97] inline-flex items-center gap-1 transition-all"
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
            <div className="md:hidden divide-y divide-slate-200">
              {filteredReports.map((rep) => {
                const editable = canEditReport(rep, currentUser);
                const durationShifts = durationByReportId.get(rep.id);
                const badge = formatWorkflowBadge(rep);
                return (
                  <article key={rep.id} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <div className="min-w-0 truncate">
                        <span className="font-semibold text-slate-900">{rep.shift}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{rep.category}</span>
                      </div>
                      <span className="font-mono tabular-nums shrink-0">{rep.reportDate}</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-sm font-bold text-[#0F294A]">
                        {rep.machine || 'Umum / Non-Mesin'}
                        {durationShifts !== undefined && (
                          <span className="text-slate-500 font-medium text-xs">
                            {' '}
                            | {durationShifts} Shift
                          </span>
                        )}
                      </p>
                      {rep.isCompleted && (
                        <span className="text-xs font-semibold text-emerald-700">Selesai (OK)</span>
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

                    <p className="text-sm text-slate-900 leading-relaxed line-clamp-3">
                      {rep.information}
                    </p>

                    {(rep.followUp || rep.palletLocation) && (
                      <div className="text-xs text-slate-500 space-y-0.5">
                        {rep.followUp && <p>Lanjut: {rep.followUp}</p>}
                        {rep.palletLocation && (
                          <p className="font-mono">Palet: {rep.palletLocation}</p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-2 text-xs text-slate-500">
                      <div className="min-w-0 truncate">
                        <span className="font-medium text-slate-700">{rep.createdByName}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono tabular-nums">
                          {formatDateTimeId(rep.updatedAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onSelectReport(rep)}
                          className="min-h-[38px] px-4 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold shadow-xs active:scale-[0.97] transition-all"
                        >
                          Detail
                        </button>
                        {editable && (
                          <button
                            type="button"
                            onClick={() => onEditReport(rep)}
                            className="min-h-[38px] px-4 py-1.5 rounded-full bg-[#0F294A] hover:bg-[#163864] text-white font-semibold shadow-sm shadow-[#0F294A]/20 active:scale-[0.97] transition-all"
                          >
                            Edit
                          </button>
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
