import { X, Pencil } from 'lucide-react';
import type { HandoverReport, UserProfile } from '../types/handover';
import { canEditReport, formatDateTimeId } from '../utils/handoverLogic';
import { CategoryTag, ShiftTag } from './StatusTag';

interface ReportDetailModalProps {
  report: HandoverReport | null;
  currentUser: UserProfile;
  onClose: () => void;
  onEdit: (report: HandoverReport) => void;
}

export function ReportDetailModal({
  report,
  currentUser,
  onClose,
  onEdit,
}: ReportDetailModalProps) {
  if (!report) return null;

  const editable = canEditReport(report, currentUser);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
    >
      <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-xl border border-slate-200 shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ShiftTag shift={report.shift} />
              <CategoryTag category={report.category} />
              {report.machine && (
                <span className="font-mono text-xs font-semibold text-[#0F294A] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {report.machine}
                </span>
              )}
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded border ${
                  report.isCompleted
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {report.isCompleted ? 'Case Selesai' : 'Berlanjut'}
              </span>
            </div>
            <h2
              id="detail-modal-title"
              className="mt-2 text-base sm:text-lg font-semibold text-slate-900"
            >
              Detail Laporan Handover
            </h2>
            <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
              Tanggal {report.reportDate} · ID {report.id.slice(0, 8)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup detail laporan"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 text-sm">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Informasi / Keterangan
            </h3>
            <p className="text-slate-900 whitespace-pre-wrap leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              {report.information}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Masalah
            </h3>
            <p className="text-slate-900 whitespace-pre-wrap leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              {report.issue || 'Tidak ada masalah tercatat.'}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Tindak Lanjut
            </h3>
            <p className="text-slate-900 whitespace-pre-wrap leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              {report.followUp || 'Belum ada catatan tindak lanjut.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 text-xs text-slate-600">
            <div>
              <span className="text-slate-400 block">Pembuat Laporan</span>
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

        <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between gap-3 bg-slate-50 rounded-b-xl">
          {!editable ? (
            <p className="text-xs text-slate-500">
              Hanya pembuat laporan atau Supervisor/Admin yang dapat mengedit laporan ini.
            </p>
          ) : (
            <span className="text-xs text-slate-500">Anda memiliki akses edit untuk laporan ini.</span>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium"
            >
              Tutup
            </button>
            {editable && (
              <button
                type="button"
                onClick={() => onEdit(report)}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-[#0F294A] hover:bg-[#163864] text-white text-sm font-semibold inline-flex items-center gap-2"
              >
                <Pencil className="w-4 h-4" />
                EDIT LAPORAN
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
