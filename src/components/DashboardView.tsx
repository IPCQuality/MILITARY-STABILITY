import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  CATEGORIES,
  type CategoryType,
  type HandoverFormInput,
  type HandoverReport,
  type UserProfile,
} from '../types/handover';
import {
  getCurrentShiftStatus,
  getOperationalDateString,
  groupActiveDashboardCases,
} from '../utils/handoverLogic';

interface DashboardViewProps {
  reports: HandoverReport[];
  loading: boolean;
  currentUser: UserProfile;
  onSelectReport: (report: HandoverReport) => void;
  onCreatePreset: (preset: Partial<HandoverFormInput>) => void;
}

const OTHER_CATEGORIES: CategoryType[] = CATEGORIES.filter(
  (category) => category !== 'OVERHAUL'
);

export function DashboardView({
  reports,
  loading,
  currentUser,
  onSelectReport,
  onCreatePreset,
}: DashboardViewProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const today = getOperationalDateString(now);
  const liveShiftStatus = useMemo(() => getCurrentShiftStatus(now), [now]);
  const grouped = useMemo(
    () => groupActiveDashboardCases(reports, now, currentUser),
    [reports, now, currentUser]
  );

  function renderCategoryCard(category: CategoryType) {
    const machineGroups = grouped[category];

    return (
      <section
        key={category}
        aria-label={category}
        data-testid={`category-card-${category}`}
        className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-xs"
      >
        {/* Category Header Row */}
        <div className="px-4 py-2 sm:px-5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2">
          <h2 className="text-xs sm:text-sm font-bold tracking-wide text-slate-900">
            {category}
          </h2>
          <button
            type="button"
            onClick={() =>
              onCreatePreset({
                reportDate: today,
                shift: liveShiftStatus.primaryShift,
                category,
              })
            }
            aria-label={`Tambah mesin di ${category}`}
            className="text-[11px] font-semibold text-[#0F294A] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Mesin Baru</span>
          </button>
        </div>

        {/* Empty Category State */}
        {machineGroups.length === 0 ? (
          <button
            type="button"
            onClick={() =>
              onCreatePreset({
                reportDate: today,
                shift: liveShiftStatus.primaryShift,
                category,
              })
            }
            className="w-full min-h-[44px] px-4 py-3 sm:px-5 text-left text-xs sm:text-sm text-slate-500 hover:bg-slate-50 transition-colors"
          >
            kosong, belum ada jadwal.
          </button>
        ) : (
          <div className="divide-y divide-slate-300">
            {machineGroups.map((group) => (
              <div key={group.machineName}>
                {/* Machine Sub-header Row */}
                <div className="px-4 py-2 sm:px-5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs sm:text-sm font-bold text-[#0F294A]">
                    {group.machineName}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                    {group.isCompleted
                      ? 'Selesai (OK)'
                      : `${group.rows.length} shift ditampilkan`}
                  </span>
                </div>

                {/* Dynamic Shift Rows (Hanya sampai shift berjalan, maks 4 baris jika carry-over) */}
                <div className="divide-y divide-slate-200">
                  {group.rows.map((row) => {
                    const rowBgClass = row.isOk
                      ? 'bg-emerald-100/75'
                      : row.isRunningShift
                        ? 'bg-blue-50/30'
                        : row.isCarryOver
                          ? 'bg-amber-50/25'
                          : 'bg-white';

                    const reportHoverClass = row.isOk
                      ? 'hover:bg-emerald-100'
                      : 'hover:bg-slate-50';

                    return (
                      <div
                        key={row.key}
                        data-shift-ok={row.isOk ? 'true' : 'false'}
                        className={`grid grid-cols-12 items-stretch transition-colors ${rowBgClass}`}
                      >
                        {/* Left Column: Shift Label (tanpa jam jadwal) */}
                        <div className="col-span-4 px-3 sm:px-4 py-2.5 border-r border-slate-200/80 flex flex-col justify-center">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`text-xs sm:text-sm font-semibold whitespace-nowrap ${
                                row.isOk
                                  ? 'text-emerald-950'
                                  : row.isRunningShift
                                    ? 'text-[#0F294A]'
                                    : 'text-slate-800'
                              }`}
                            >
                              {row.shift}
                            </span>
                            {row.isOk && (
                              <span className="text-[10px] font-semibold text-emerald-900 bg-emerald-200/80 px-1.5 py-0.5 rounded">
                                OK
                              </span>
                            )}
                            {row.isRunningShift && (
                              <span className="text-[10px] font-semibold text-[#0F294A] bg-blue-100 px-1.5 py-0.5 rounded">
                                Aktif
                              </span>
                            )}
                            {row.isCarryOver && (
                              <span className="text-[10px] font-medium text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded">
                                {row.carryOverLabel}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right Column: Hasil Shift & Instruksi Selanjutnya */}
                        <div className="col-span-8 flex items-stretch min-w-0">
                          {row.reports.length > 0 ? (
                            <div className="flex-1 min-w-0 divide-y divide-slate-200/60">
                              {row.reports.map((rep) => (
                                <button
                                  key={rep.id}
                                  type="button"
                                  onClick={() => onSelectReport(rep)}
                                  className={`w-full min-h-[44px] px-3 sm:px-4 py-2.5 text-left transition-colors block ${reportHoverClass}`}
                                >
                                  <div className="space-y-1.5 text-left">
                                    <div>
                                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                        Update Shift / Informasi / Keterangan
                                      </span>
                                      <p className="text-xs sm:text-sm text-slate-900 leading-snug whitespace-pre-wrap">
                                        {rep.information}
                                      </p>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-rose-700/90">
                                        Masalah
                                      </span>
                                      <p className="text-xs text-slate-800 leading-snug whitespace-pre-wrap">
                                        {rep.issue || '-'}
                                      </p>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#0F294A]">
                                        Tindak Lanjut
                                      </span>
                                      <p className="text-xs text-slate-800 leading-snug whitespace-pre-wrap">
                                        {rep.followUp || '-'}
                                      </p>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                        Lokasi Palet
                                      </span>
                                      <p className="text-xs font-mono text-slate-800 leading-snug">
                                        {rep.palletLocation || '-'}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : row.canFill ? (
                            <button
                              type="button"
                              onClick={() =>
                                onCreatePreset({
                                  reportDate: today,
                                  shift: row.shift,
                                  category,
                                  machine: group.rawMachine ?? '',
                                })
                              }
                              className="w-full min-h-[44px] px-3 sm:px-4 py-2 text-left text-xs sm:text-sm text-[#0F294A] font-medium hover:bg-blue-50/50 transition-colors flex items-center"
                            >
                              <span>Ketuk untuk isi update {row.shift}...</span>
                            </button>
                          ) : (
                            <div className="w-full min-h-[44px] px-3 sm:px-4 py-2 text-left text-xs text-slate-400 flex items-center">
                              <span>Belum ada update pada {row.shift}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <div>
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-300 py-12 text-center text-sm text-slate-500 shadow-xs">
          Memuat catatan handover hari ini...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-start">
          {/* Kolom 1: Kategori OVERHAUL */}
          <div data-testid="dashboard-col-overhaul" className="space-y-4 sm:space-y-5">
            {renderCategoryCard('OVERHAUL')}
          </div>

          {/* Kolom 2: Setiap Kategori Lainnya Dipisah ke Kolom/Kartu Tersendiri */}
          <div data-testid="dashboard-col-others" className="space-y-4 sm:space-y-5">
            {OTHER_CATEGORIES.map((category) => renderCategoryCard(category))}
          </div>
        </div>
      )}
    </div>
  );
}
