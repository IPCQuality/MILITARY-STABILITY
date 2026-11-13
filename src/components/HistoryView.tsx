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
  filterAndSortReports,
  formatDateTimeId,
} from '../utils/handoverLogic';
import { CategoryTag, ShiftTag } from './StatusTag';

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

  function resetFilters() {
    onChangeFilters({
      date: '',
      shift: 'ALL',
      category: 'ALL',
      keyword: '',
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Riwayat Laporan Handover
          </h2>
          <p className="text-sm text-slate-500">
            Menampilkan seluruh catatan lintas shift ({filteredReports.length} laporan sesuai filter).
          </p>
        </div>
        <button
          type="button"
          onClick={resetFilters}
          className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center justify-center gap-1.5 self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Filter
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label htmlFor="filter-date" className="block text-xs font-medium text-slate-600 mb-1">
            Filter Tanggal
          </label>
          <input
            id="filter-date"
            type="date"
            value={filters.date}
            onChange={(e) => onChangeFilters({ ...filters, date: e.target.value })}
            className="w-full min-h-[44px] px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
          />
        </div>

        <div>
          <label htmlFor="filter-shift" className="block text-xs font-medium text-slate-600 mb-1">
            Filter Shift
          </label>
          <select
            id="filter-shift"
            value={filters.shift}
            onChange={(e) =>
              onChangeFilters({ ...filters, shift: e.target.value as ShiftType | 'ALL' })
            }
            className="w-full min-h-[44px] px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
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
          <label htmlFor="filter-category" className="block text-xs font-medium text-slate-600 mb-1">
            Filter Kategori
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
            className="w-full min-h-[44px] px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
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
          <label htmlFor="filter-keyword" className="block text-xs font-medium text-slate-600 mb-1">
            Cari Mesin / Kata Kunci
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="filter-keyword"
              type="text"
              value={filters.keyword}
              onChange={(e) => onChangeFilters({ ...filters, keyword: e.target.value })}
              placeholder="AST4S, bearing, nama..."
              className="w-full min-h-[44px] pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Memuat data laporan...
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-200 rounded-lg">
            <p className="text-sm text-slate-600">
              Tidak ada laporan yang cocok dengan kriteria filter saat ini.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-3 min-h-[44px] px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
            >
              Tampilkan Semua Laporan
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table with Horizontal Scroll */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[820px] text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                    <th className="py-2.5 pr-3">Tanggal</th>
                    <th className="py-2.5 px-3">Shift</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3">Mesin</th>
                    <th className="py-2.5 px-3">Informasi &amp; Tindak Lanjut</th>
                    <th className="py-2.5 px-3">Pembuat</th>
                    <th className="py-2.5 px-3">Waktu Update</th>
                    <th className="py-2.5 pl-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReports.map((rep) => {
                    const editable = canEditReport(rep, currentUser);
                    return (
                      <tr key={rep.id} className="hover:bg-slate-50/80 align-top">
                        <td className="py-3 pr-3 font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                          {rep.reportDate}
                        </td>
                        <td className="py-3 px-3">
                          <ShiftTag shift={rep.shift} />
                        </td>
                        <td className="py-3 px-3">
                          <CategoryTag category={rep.category} />
                        </td>
                        <td className="py-3 px-3 font-mono text-xs text-slate-900 whitespace-nowrap">
                          {rep.machine || '-'}
                        </td>
                        <td className="py-3 px-3 max-w-sm">
                          <p className="text-xs text-slate-800 line-clamp-2 leading-relaxed">
                            {rep.information}
                          </p>
                          {rep.followUp && (
                            <p className="mt-1 text-[11px] text-slate-500 line-clamp-1">
                              Tindak lanjut: {rep.followUp}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-700 whitespace-nowrap">
                          {rep.createdByName}
                        </td>
                        <td className="py-3 px-3 font-mono text-xs tabular-nums text-slate-500 whitespace-nowrap">
                          {formatDateTimeId(rep.updatedAt)}
                        </td>
                        <td className="py-3 pl-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onSelectReport(rep)}
                              aria-label={`Detail laporan ${rep.reportDate} ${rep.shift}`}
                              className="min-h-[36px] px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Detail
                            </button>
                            {editable && (
                              <button
                                type="button"
                                onClick={() => onEditReport(rep)}
                                aria-label={`Edit laporan ${rep.reportDate} ${rep.shift}`}
                                className="min-h-[36px] px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-[#0F294A] inline-flex items-center gap-1"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit
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

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filteredReports.map((rep) => {
                const editable = canEditReport(rep, currentUser);
                return (
                  <article
                    key={rep.id}
                    className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <ShiftTag shift={rep.shift} />
                        <CategoryTag category={rep.category} />
                      </div>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        {rep.reportDate}
                      </span>
                    </div>

                    {rep.machine && (
                      <p className="font-mono text-xs font-semibold text-[#0F294A]">
                        Mesin: {rep.machine}
                      </p>
                    )}

                    <p className="text-sm text-slate-900 leading-relaxed line-clamp-3">
                      {rep.information}
                    </p>

                    {rep.issue && (
                      <p className="text-xs text-rose-700 line-clamp-2">
                        Masalah: {rep.issue}
                      </p>
                    )}

                    {rep.followUp && (
                      <p className="text-xs text-slate-600 line-clamp-2">
                        Tindak lanjut: {rep.followUp}
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 text-xs text-slate-500">
                      <div className="min-w-0 truncate">
                        <span className="font-medium text-slate-700">{rep.createdByName}</span>
                        <span className="mx-1">·</span>
                        <span className="font-mono tabular-nums">
                          {formatDateTimeId(rep.updatedAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onSelectReport(rep)}
                          className="min-h-[40px] px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 font-medium"
                        >
                          Detail
                        </button>
                        {editable && (
                          <button
                            type="button"
                            onClick={() => onEditReport(rep)}
                            className="min-h-[40px] px-3 py-1.5 rounded-md bg-[#0F294A] text-white font-medium"
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
