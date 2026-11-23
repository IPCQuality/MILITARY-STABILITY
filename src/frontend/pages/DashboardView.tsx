import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import {
  CATEGORIES,
  type CategoryType,
  type HandoverFormInput,
  type HandoverReport,
  type UserProfile,
} from '../../shared/types/handover';
import {
  formatReportInformationDisplay,
  formatWorkflowBadge,
  getCurrentShiftStatus,
  getOperationalDateString,
  groupActiveDashboardCases,
} from '../../domain/handover/handoverLogic';

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

  const activeOtherCategories = OTHER_CATEGORIES.filter(
    (category) => grouped[category].length > 0
  );
  const emptyCategories = CATEGORIES.filter(
    (category) => grouped[category].length === 0
  );
  const hasOverhaulActive = grouped['OVERHAUL'].length > 0;
  const totalActiveMachines = CATEGORIES.reduce(
    (sum, cat) => sum + grouped[cat].length,
    0
  );

  function renderCategoryCard(category: CategoryType) {
    const machineGroups = grouped[category];
    if (machineGroups.length === 0) return null;

    return (
      <section
        key={category}
        aria-label={category}
        data-testid={`category-card-${category}`}
        className="bg-white dark:bg-[#161920] rounded-xl border border-slate-200 dark:border-zinc-800/90 overflow-hidden"
      >
        {/* Category Header Row */}
        <div className="px-4 py-3 sm:px-5 bg-slate-50 dark:bg-[#1D212A] border-b border-slate-200 dark:border-zinc-800/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-xs sm:text-sm font-bold tracking-wide text-slate-900 dark:text-zinc-100 truncate">
              {category}
            </h3>
            <span className="text-xs text-slate-500 dark:text-zinc-400 tabular-nums shrink-0">
              · {machineGroups.length} mesin
            </span>
          </div>
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
            className="min-h-[34px] px-3.5 py-1.5 rounded-full border border-teal-200/80 dark:border-zinc-700 bg-white dark:bg-[#252A35] hover:bg-teal-50/70 dark:hover:bg-[#2E3442] text-xs font-semibold text-teal-700 dark:text-dark-accent shadow-xs hover:shadow-sm active:scale-[0.97] inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah</span>
          </button>
        </div>

        {/* Machine List */}
        <div className="divide-y divide-slate-200 dark:divide-zinc-800/90">
          {machineGroups.map((group) => (
            <div key={group.machineName}>
              {/* Machine Sub-header Row */}
              <div
                className={`px-4 py-2.5 sm:px-5 border-b border-slate-100 dark:border-zinc-800/60 flex items-center justify-between gap-2 ${
                  group.isCompleted
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/20'
                    : !group.hasStartedRepair
                      ? 'bg-slate-50/70 dark:bg-[#191D25]'
                      : 'bg-amber-50/45 dark:bg-amber-950/15'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    aria-label={group.isCompleted ? 'Status OK' : 'Dalam proses'}
                    data-machine-status={group.isCompleted ? 'ok' : 'in-progress'}
                    className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${
                      group.isCompleted
                        ? 'bg-emerald-600 dark:bg-emerald-500/80'
                        : !group.hasStartedRepair
                          ? 'bg-slate-400 dark:bg-zinc-500'
                          : 'bg-amber-500 dark:bg-amber-500/80'
                    }`}
                  />
                  <span
                    className={`font-mono text-sm font-bold truncate ${
                      group.isCompleted
                        ? 'text-emerald-900 dark:text-emerald-300/90'
                        : 'text-slate-900 dark:text-zinc-100'
                    }`}
                  >
                    {group.machineName}
                  </span>
                </div>
                <span
                  className={`text-xs font-semibold tabular-nums shrink-0 ${
                    group.isCompleted
                      ? 'text-emerald-700 dark:text-emerald-300/90'
                      : !group.hasStartedRepair
                        ? 'text-slate-600 dark:text-zinc-400'
                        : 'text-amber-700 dark:text-amber-300/90'
                  }`}
                >
                  {group.isCompleted
                    ? group.durationShifts > 0
                      ? `Selesai (OK) · ${group.durationShifts} shift`
                      : 'Selesai (OK)'
                    : !group.hasStartedRepair
                      ? 'Menunggu Perbaikan (OH)'
                      : `Berjalan · ${group.durationShifts} shift`}
                </span>
              </div>

              {/* Shift Rows */}
              <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {group.rows.map((row) => {
                  const rowBgClass = row.isOk
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/20'
                    : row.isRunningShift
                      ? 'bg-teal-50/35 dark:bg-teal-900/15'
                      : row.isCarryOver
                        ? 'bg-amber-50/25 dark:bg-amber-950/15'
                        : 'bg-white dark:bg-[#161920]';

                  const reportHoverClass = row.isOk
                    ? 'hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                    : 'hover:bg-slate-50 dark:hover:bg-[#1D212A]';

                  return (
                    <div
                      key={row.key}
                      data-shift-ok={row.isOk ? 'true' : 'false'}
                      className={`grid grid-cols-12 items-stretch transition-colors ${rowBgClass}`}
                    >
                      {/* Shift Label Column */}
                      <div className="col-span-4 sm:col-span-3 px-3.5 sm:px-4 py-3 border-r border-slate-100 dark:border-zinc-800/60 flex flex-col justify-center gap-0.5">
                        <span
                          className={`text-xs sm:text-sm font-semibold whitespace-nowrap ${
                            row.isOk
                              ? 'text-emerald-950 dark:text-emerald-300/90'
                              : row.isRunningShift
                                ? 'text-teal-700 dark:text-dark-accent'
                                : 'text-slate-800 dark:text-zinc-200'
                          }`}
                        >
                          {row.shift}
                        </span>
                        {(row.isOk || row.isRunningShift || row.isCarryOver) && (
                          <span
                            className={`text-[11px] font-medium ${
                              row.isOk
                                ? 'text-emerald-700 dark:text-emerald-300/90'
                                : row.isRunningShift
                                  ? 'text-teal-700 dark:text-dark-accent'
                                  : 'text-amber-700 dark:text-amber-300/90'
                            }`}
                          >
                            {row.isOk
                              ? 'Selesai'
                              : row.isRunningShift
                                ? 'Aktif'
                                : row.carryOverLabel}
                          </span>
                        )}
                      </div>

                      {/* Shift Report Content Column */}
                      <div className="col-span-8 sm:col-span-9 flex items-stretch min-w-0">
                        {row.reports.length > 0 ? (
                          <div className="flex-1 min-w-0 divide-y divide-slate-100 dark:divide-zinc-800/60">
                            {row.reports.map((rep) => {
                              const badge = formatWorkflowBadge(rep);
                              return (
                                <button
                                  key={rep.id}
                                  type="button"
                                  onClick={() => onSelectReport(rep)}
                                  className={`w-full min-h-[48px] px-3.5 sm:px-4 py-3 text-left transition-colors block ${reportHoverClass}`}
                                >
                                  {badge && (
                                    <div className="mb-1.5">
                                      <span
                                        className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold ${badge.badgeClass}`}
                                      >
                                        {badge.badgeLabel}
                                      </span>
                                    </div>
                                  )}

                                  <p className="text-xs sm:text-sm text-slate-900 dark:text-zinc-100 leading-snug whitespace-pre-wrap break-words">
                                    {formatReportInformationDisplay(rep.information)}
                                  </p>

                                  {(rep.leakLine || rep.followUp || rep.palletLocation) && (
                                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
                                      {rep.leakLine && (
                                        <span className="font-mono font-semibold text-rose-700 dark:text-rose-300">
                                          Line Bocor: {rep.leakLine}
                                        </span>
                                      )}
                                      {rep.leakLine && (rep.followUp || rep.palletLocation) && (
                                        <span aria-hidden="true">·</span>
                                      )}
                                      {rep.followUp && (
                                        <span className="text-teal-700 dark:text-dark-accent font-medium break-words">
                                          {rep.followUp}
                                        </span>
                                      )}
                                      {rep.followUp && rep.palletLocation && (
                                        <span aria-hidden="true">·</span>
                                      )}
                                      {rep.palletLocation && (
                                        <span className="font-mono text-slate-600 dark:text-zinc-400">
                                          Palet: {rep.palletLocation}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                            {row.canFill && !group.isCompleted && (
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
                                className="w-full min-h-[38px] px-3.5 sm:px-4 py-1.5 text-left text-xs text-teal-700 dark:text-dark-accent font-semibold hover:bg-teal-50/60 dark:hover:bg-teal-900/20 transition-colors flex items-center gap-1.5"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Update baru</span>
                              </button>
                            )}
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
                            className="w-full min-h-[44px] px-3.5 sm:px-4 py-2.5 text-left text-xs sm:text-sm text-teal-700 dark:text-dark-accent font-medium hover:bg-teal-50/50 dark:hover:bg-teal-900/20 transition-colors flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5 shrink-0" />
                            <span>Isi {row.shift}</span>
                          </button>
                        ) : (
                          <div className="w-full min-h-[44px] px-3.5 sm:px-4 py-2.5 text-left text-xs text-slate-400 dark:text-zinc-600 flex items-center">
                            <span>Belum ada update</span>
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
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="bg-white dark:bg-[#161920] rounded-xl border border-slate-200 dark:border-zinc-800/90 py-12 text-center text-sm text-slate-500 dark:text-zinc-400">
          Memuat catatan handover hari ini...
        </div>
      ) : totalActiveMachines === 0 ? (
        <div className="bg-white dark:bg-[#161920] rounded-2xl border border-slate-200 dark:border-zinc-800/90 p-6 sm:p-8 text-center space-y-4">
          <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-900/25 text-teal-700 dark:text-dark-accent flex items-center justify-center mx-auto">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Belum Ada Mesin Aktif Hari Ini
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
              Semua kasus sebelumnya sudah selesai atau belum ada laporan untuk shift berjalan.
              Pilih kategori di bawah untuk mulai mencatat.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() =>
                  onCreatePreset({
                    reportDate: today,
                    shift: liveShiftStatus.primaryShift,
                    category,
                  })
                }
                className="min-h-[40px] px-4 py-2 rounded-full border border-teal-200 dark:border-zinc-700 bg-teal-50/70 dark:bg-[#1D212A] hover:bg-teal-100/80 dark:hover:bg-[#252A35] text-xs font-semibold text-teal-800 dark:text-dark-accent inline-flex items-center gap-1.5 transition-all active:scale-[0.98]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{category}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active Category Cards */}
          {hasOverhaulActive && activeOtherCategories.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <div data-testid="dashboard-col-overhaul" className="space-y-4">
                {renderCategoryCard('OVERHAUL')}
              </div>
              <div data-testid="dashboard-col-others" className="space-y-4">
                {activeOtherCategories.map((category) => renderCategoryCard(category))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {hasOverhaulActive && (
                <div data-testid="dashboard-col-overhaul" className="space-y-4">
                  {renderCategoryCard('OVERHAUL')}
                </div>
              )}
              {activeOtherCategories.length > 0 && (
                <div
                  data-testid="dashboard-col-others"
                  className={
                    activeOtherCategories.length > 1
                      ? 'grid grid-cols-1 lg:grid-cols-2 gap-4 items-start'
                      : 'space-y-4'
                  }
                >
                  {activeOtherCategories.map((category) => renderCategoryCard(category))}
                </div>
              )}
            </div>
          )}

          {/* Compact Quick-Add Strip for Empty Categories */}
          {emptyCategories.length > 0 && (
            <section
              aria-label="Tambah ke kategori lain"
              className="bg-white dark:bg-[#161920] rounded-xl border border-slate-200/90 dark:border-zinc-800/90 px-4 py-3.5 sm:px-5 flex flex-wrap items-center justify-between gap-2.5"
            >
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                Kategori kosong — tambah cepat:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {emptyCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    data-testid={`category-card-${category}`}
                    onClick={() =>
                      onCreatePreset({
                        reportDate: today,
                        shift: liveShiftStatus.primaryShift,
                        category,
                      })
                    }
                    className="min-h-[34px] px-3 py-1.5 rounded-full border border-slate-200 dark:border-zinc-700/80 bg-slate-50/70 dark:bg-[#1D212A] hover:border-teal-300 dark:hover:border-teal-700/80 hover:bg-teal-50/60 dark:hover:bg-[#252A35] text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-teal-800 dark:hover:text-dark-accent inline-flex items-center gap-1 transition-all active:scale-[0.97] whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5 text-teal-700 dark:text-dark-accent shrink-0" />
                    <span>{category}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
