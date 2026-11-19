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
  formatWorkflowBadge,
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
        className="bg-white rounded-xl border border-slate-200 overflow-hidden"
      >
        {/* Category Header Row */}
        <div
          className={`px-4 py-3 sm:px-5 bg-slate-50 flex items-center justify-between gap-3 ${
            machineGroups.length > 0 ? 'border-b border-slate-200' : ''
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-xs sm:text-sm font-bold tracking-wide text-slate-900 truncate">
              {category}
            </h3>
            <span className="text-xs text-slate-500 tabular-nums shrink-0">
              · {machineGroups.length > 0 ? `${machineGroups.length} mesin` : 'Kosong'}
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
            className="min-h-[34px] px-3.5 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-[#0F294A] shadow-xs hover:shadow-sm active:scale-[0.97] inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah</span>
          </button>
        </div>

        {/* Machine List */}
        {machineGroups.length > 0 && (
          <div className="divide-y divide-slate-200">
            {machineGroups.map((group) => (
              <div key={group.machineName}>
                {/* Machine Sub-header Row */}
                <div className="px-4 py-2.5 sm:px-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      aria-label={group.isCompleted ? 'Status OK' : 'Dalam proses'}
                      data-machine-status={group.isCompleted ? 'ok' : 'in-progress'}
                      className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${
                        group.isCompleted
                          ? 'bg-emerald-600'
                          : !group.hasStartedRepair
                            ? 'bg-slate-400'
                            : 'bg-amber-500'
                      }`}
                    />
                    <span
                      className={`font-mono text-sm font-bold truncate ${
                        group.isCompleted ? 'text-emerald-900' : 'text-slate-900'
                      }`}
                    >
                      {group.machineName}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-semibold tabular-nums shrink-0 ${
                      group.isCompleted
                        ? 'text-emerald-700'
                        : !group.hasStartedRepair
                          ? 'text-slate-600'
                          : 'text-amber-700'
                    }`}
                  >
                    {group.isCompleted
                      ? group.durationShifts > 0
                        ? `Selesai (OK) · ${group.durationShifts} shift`
                        : 'Selesai (OK)'
                      : !group.hasStartedRepair
                        ? 'OH · 0 shift'
                        : `Dalam Proses · ${group.durationShifts} shift`}
                  </span>
                </div>

                {/* Shift Rows */}
                <div className="divide-y divide-slate-100">
                  {group.rows.map((row) => {
                    const rowBgClass = row.isOk
                      ? 'bg-emerald-50/70'
                      : row.isRunningShift
                        ? 'bg-blue-50/25'
                        : row.isCarryOver
                          ? 'bg-amber-50/25'
                          : 'bg-white';

                    const reportHoverClass = row.isOk
                      ? 'hover:bg-emerald-50'
                      : 'hover:bg-slate-50';

                    return (
                      <div
                        key={row.key}
                        data-shift-ok={row.isOk ? 'true' : 'false'}
                        className={`grid grid-cols-12 items-stretch transition-colors ${rowBgClass}`}
                      >
                        {/* Shift Label Column */}
                        <div className="col-span-4 sm:col-span-3 px-3.5 sm:px-4 py-3 border-r border-slate-100 flex flex-col justify-center gap-0.5">
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
                          {(row.isOk || row.isRunningShift || row.isCarryOver) && (
                            <span
                              className={`text-[11px] font-medium ${
                                row.isOk
                                  ? 'text-emerald-700'
                                  : row.isRunningShift
                                    ? 'text-[#0F294A]'
                                    : 'text-amber-700'
                              }`}
                            >
                              {row.isOk
                                ? 'Selesai'
                                : row.isRunningShift
                                  ? 'Shift Aktif'
                                  : row.carryOverLabel}
                            </span>
                          )}
                        </div>

                        {/* Shift Report Content Column */}
                        <div className="col-span-8 sm:col-span-9 flex items-stretch min-w-0">
                          {row.reports.length > 0 ? (
                            <div className="flex-1 min-w-0 divide-y divide-slate-100">
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

                                    <p className="text-xs sm:text-sm text-slate-900 leading-snug whitespace-pre-wrap break-words">
                                      {rep.information}
                                    </p>

                                    {(rep.followUp || rep.palletLocation) && (
                                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                                        {rep.followUp && (
                                          <span className="text-[#0F294A] font-medium break-words">
                                            Lanjut: {rep.followUp}
                                          </span>
                                        )}
                                        {rep.followUp && rep.palletLocation && (
                                          <span aria-hidden="true">·</span>
                                        )}
                                        {rep.palletLocation && (
                                          <span className="font-mono text-slate-600">
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
                                  className="w-full min-h-[36px] px-3.5 sm:px-4 py-2 text-left text-xs text-[#0F294A] font-semibold hover:bg-blue-50/50 transition-colors flex items-center gap-1.5"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Tambah tahap / update di {row.shift}</span>
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
                              className="w-full min-h-[44px] px-3.5 sm:px-4 py-2.5 text-left text-xs sm:text-sm text-[#0F294A] font-medium hover:bg-blue-50/40 transition-colors flex items-center"
                            >
                              <span>+ Isi update {row.shift}</span>
                            </button>
                          ) : (
                            <div className="w-full min-h-[44px] px-3.5 sm:px-4 py-2.5 text-left text-xs text-slate-400 flex items-center">
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
        )}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {/* Category Grid */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-sm text-slate-500">
          Memuat catatan handover hari ini...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div data-testid="dashboard-col-overhaul" className="space-y-4">
            {renderCategoryCard('OVERHAUL')}
          </div>

          <div data-testid="dashboard-col-others" className="space-y-4">
            {OTHER_CATEGORIES.map((category) => renderCategoryCard(category))}
          </div>
        </div>
      )}
    </div>
  );
}
