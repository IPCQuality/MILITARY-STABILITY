import { useEffect, useMemo } from 'react';
import { X, Pencil } from 'lucide-react';
import type { HandoverReport, UserProfile } from '../types/handover';
import {
  canEditReport,
  computeCaseDurations,
  countMilitaryInReport,
  countStabilityInReport,
  formatDateTimeId,
  formatDisplayDate,
  formatWorkflowBadge,
} from '../utils/handoverLogic';

interface ReportDetailModalProps {
  report: HandoverReport | null;
  currentUser: UserProfile;
  reports?: HandoverReport[];
  onClose: () => void;
  onEdit: (report: HandoverReport) => void;
}

export function ReportDetailModal({
  report,
  currentUser,
  reports = [],
  onClose,
  onEdit,
}: ReportDetailModalProps) {
  useEffect(() => {
    if (!report) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [report, onClose]);

  const caseMetrics = useMemo(() => {
    if (!report || reports.length === 0) return null;
    const allDurations = computeCaseDurations(reports);
    const matched = allDurations.find(
      (d) => d.reportIds.includes(report.id)
    );
    if (!matched) return null;
    const epReports = reports.filter((r) => matched.reportIds.includes(r.id));
    const totalMil = epReports.reduce((sum, r) => sum + countMilitaryInReport(r), 0);
    const totalStab = epReports.reduce((sum, r) => sum + countStabilityInReport(r), 0);
    return {
      durationShifts: matched.durationShifts,
      isCompleted: matched.isCompleted,
      totalMilitary: totalMil,
      totalStability: totalStab,
      reportCount: matched.reportCount,
    };
  }, [report, reports]);

  if (!report) return null;

  const editable = canEditReport(report, currentUser);
  const wfBadge = formatWorkflowBadge(report);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-xl rounded-t-2xl sm:rounded-xl border border-slate-200 shadow-xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <span className="font-semibold text-slate-800">{report.shift}</span>
              <span aria-hidden="true">·</span>
              <span>{report.category}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{formatDisplayDate(report.reportDate)}</span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
              <h2
                id="detail-modal-title"
                className="text-base sm:text-lg font-bold text-slate-900 font-mono"
              >
                {report.machine || 'Umum / Non-Mesin'}
              </h2>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                  report.isCompleted
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {report.isCompleted ? 'Selesai (OK)' : 'Berlanjut'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup detail laporan"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.95] shrink-0 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto text-sm space-y-4">
          {caseMetrics && (
            <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <div>
                <span className="text-[10px] sm:text-xs text-slate-500 block">Total Durasi Kasus</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-[#0F294A]">
                  {caseMetrics.durationShifts} Shift
                </span>
              </div>
              <div>
                <span className="text-[10px] sm:text-xs text-slate-500 block">Total Military</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-slate-900">
                  {caseMetrics.totalMilitary}x
                </span>
              </div>
              <div>
                <span className="text-[10px] sm:text-xs text-slate-500 block">Total Stability</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-teal-700">
                  {caseMetrics.totalStability}x
                </span>
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-100">

          {(wfBadge || report.isRepairStart) && (
            <div className="py-3 flex flex-wrap items-center gap-2">
              {wfBadge && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded border ${wfBadge.badgeClass}`}>
                  {wfBadge.badgeLabel}
                </span>
              )}
              {report.isRepairStart && (
                <span className="text-xs font-medium text-[#0F294A]">
                  · Awal Perhitungan Durasi (Shift ke-1)
                </span>
              )}
            </div>
          )}

          <div className="py-4 first:pt-0 space-y-1.5">
            <h3 className="text-xs font-semibold text-slate-500">
              Update Shift / Keterangan
            </h3>
            <p className="text-slate-900 whitespace-pre-wrap leading-relaxed">
              {report.information}
            </p>
          </div>

          <div className="py-4 space-y-1.5">
            <h3 className="text-xs font-semibold text-slate-500">
              Tindak Lanjut
            </h3>
            <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
              {report.followUp || '—'}
            </p>
          </div>

          {report.palletLocation && (
            <div className="py-4 space-y-1.5">
              <h3 className="text-xs font-semibold text-slate-500">
                Lokasi Palet
              </h3>
              <p className="font-mono text-slate-900 whitespace-pre-wrap">
                {report.palletLocation}
              </p>
            </div>
          )}

          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
            <div>
              <span className="text-slate-400 block">PIC</span>
              <span className="font-medium text-slate-900">{report.createdByName}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Terakhir Diperbarui</span>
              <span className="font-mono tabular-nums text-slate-900">
                {formatDateTimeId(report.updatedAt)}
                {report.updatedByName ? ` · ${report.updatedByName}` : ''}
              </span>
            </div>
          </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
          <p className="text-xs text-slate-500">
            {editable
              ? 'Anda dapat mengedit laporan ini.'
              : 'Hanya PIC laporan atau Supervisor/Admin yang dapat mengedit.'}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-5 py-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold shadow-xs hover:shadow-sm active:scale-[0.97] transition-all"
            >
              Tutup
            </button>
            {editable && (
              <button
                type="button"
                onClick={() => onEdit(report)}
                className="min-h-[40px] px-5 py-2 rounded-full bg-[#0F294A] hover:bg-[#163864] text-white text-sm font-semibold shadow-sm shadow-[#0F294A]/25 hover:shadow-md active:scale-[0.97] inline-flex items-center gap-2 transition-all"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
