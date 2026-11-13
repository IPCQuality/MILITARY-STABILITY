import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  CATEGORIES,
  type HandoverFormInput,
  type HandoverReport,
} from '../types/handover';
import {
  getCurrentShiftStatus,
  getTodayDateString,
  groupActiveDashboardCases,
} from '../utils/handoverLogic';

interface DashboardViewProps {
  reports: HandoverReport[];
  loading: boolean;
  onSelectReport: (report: HandoverReport) => void;
  onCreatePreset: (preset: Partial<HandoverFormInput>) => void;
}

export function DashboardView({
  reports,
  loading,
  onSelectReport,
  onCreatePreset,
}: DashboardViewProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const today = getTodayDateString(now);
  const liveShiftStatus = useMemo(() => getCurrentShiftStatus(now), [now]);
  const grouped = useMemo(
    () => groupActiveDashboardCases(reports, now),
    [reports, now]
  );

  return (
    <div className="max-w-4xl mx-auto">
      {/* Main Sheet Frame */}
      <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-xs">
        {/* Tanggal hari ini dan shift yang sedang berjalan (Tanpa pemilih tanggal) */}
        <div className="px-4 py-3 sm:px-5 border-b border-slate-300 bg-slate-50">
          <p className="text-xs sm:text-sm font-semibold text-slate-900">
            {liveShiftStatus.dateFormatted} ·{' '}
            <span className="text-[#0F294A]">{liveShiftStatus.statusText}</span>
          </p>
          <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 font-mono tabular-nums">
            Jadwal {liveShiftStatus.dayTypeLabel}: S1 {liveShiftStatus.schedule['Shift 1']} · S2{' '}
            {liveShiftStatus.schedule['Shift 2']} · S3 {liveShiftStatus.schedule['Shift 3']}
          </p>
        </div>

        {/* 4 Category Blocks */}
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Memuat catatan handover hari ini...
          </div>
        ) : (
          <div className="divide-y divide-slate-300">
            {CATEGORIES.map((category) => {
              const machineGroups = grouped[category];

              return (
                <section key={category} aria-label={category}>
                  {/* Category Row */}
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
                      className="text-[11px] font-semibold text-[#0F294A] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
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
                                ? 'Selesai'
                                : `${group.rows.length} shift ditampilkan`}
                            </span>
                          </div>

                          {/* Dynamic Shift Rows (Hanya sampai shift berjalan, maks 4 baris jika carry-over) */}
                          <div className="divide-y divide-slate-200">
                            {group.rows.map((row) => (
                              <div
                                key={row.key}
                                className={`grid grid-cols-12 items-stretch ${
                                  row.isRunningShift
                                    ? 'bg-blue-50/30'
                                    : row.isCarryOver
                                      ? 'bg-amber-50/25'
                                      : 'bg-white'
                                }`}
                              >
                                {/* Left Column: Shift Label */}
                                <div className="col-span-4 sm:col-span-3 px-3 sm:px-5 py-2.5 border-r border-slate-200 flex flex-col justify-center">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span
                                      className={`text-xs sm:text-sm font-semibold whitespace-nowrap ${
                                        row.isRunningShift ? 'text-[#0F294A]' : 'text-slate-800'
                                      }`}
                                    >
                                      {row.shift}
                                    </span>
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
                                  <span className="text-[10px] font-mono tabular-nums text-slate-500 mt-0.5">
                                    {row.hours}
                                  </span>
                                </div>

                                {/* Right Column: Hasil Shift & Instruksi Selanjutnya */}
                                <div className="col-span-8 sm:col-span-9 flex items-stretch min-w-0">
                                  {row.reports.length > 0 ? (
                                    <div className="flex-1 min-w-0 divide-y divide-slate-100">
                                      {row.reports.map((rep) => (
                                        <button
                                          key={rep.id}
                                          type="button"
                                          onClick={() => onSelectReport(rep)}
                                          className="w-full min-h-[44px] px-3 sm:px-4 py-2 text-left hover:bg-slate-50 transition-colors block"
                                        >
                                          <p className="text-xs sm:text-sm text-slate-900 leading-snug">
                                            <span>{rep.information}</span>
                                            {rep.followUp && (
                                              <span className="text-[#0F294A] font-medium">
                                                {' '}
                                                · {rep.followUp}
                                              </span>
                                            )}
                                          </p>
                                          {rep.issue && (
                                            <p className="mt-0.5 text-[11px] text-rose-700 line-clamp-1">
                                              Masalah: {rep.issue}
                                            </p>
                                          )}
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
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
