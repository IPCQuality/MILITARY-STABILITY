import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Pencil, Save, XCircle } from 'lucide-react';
import {
  CATEGORIES,
  SHIFTS,
  SUGGESTED_MACHINES,
  type CategoryType,
  type HandoverFormInput,
  type HandoverReport,
  type ShiftType,
  type UserProfile,
} from '../types/handover';
import {
  categoryRequiresMachine,
  getCurrentShiftStatus,
  getOperationalDateString,
  getShiftScheduleForDate,
  validateHandoverInput,
} from '../utils/handoverLogic';

interface HandoverFormViewProps {
  currentUser: UserProfile;
  editingReport: HandoverReport | null;
  presetValues?: Partial<HandoverFormInput> | null;
  onSubmitReport: (
    input: HandoverFormInput,
    editingId: string | null
  ) => Promise<{ ok: boolean; error?: string }>;
  onCancel: () => void;
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

export function HandoverFormView({
  currentUser,
  editingReport,
  presetValues,
  onSubmitReport,
  onCancel,
}: HandoverFormViewProps) {
  const liveStatus = useMemo(() => getCurrentShiftStatus(), []);
  const todayStr = getOperationalDateString();

  const [reportDate, setReportDate] = useState(todayStr);
  const [shift, setShift] = useState<ShiftType>(liveStatus.primaryShift);
  const [category, setCategory] = useState<CategoryType>('OVERHAUL');
  const [machine, setMachine] = useState('');
  const [information, setInformation] = useState('');
  const [issue, setIssue] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof HandoverFormInput, string>>
  >({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const shiftSchedule = useMemo(
    () => getShiftScheduleForDate(parseLocalDate(reportDate)),
    [reportDate]
  );

  // Untuk pengisian update baru di hari ini, kunci ke shift berjalan bila sedang dalam jam shift aktif
  const lockToRunningShift =
    !editingReport &&
    reportDate === todayStr &&
    liveStatus.activeShifts.length > 0;

  useEffect(() => {
    if (editingReport) {
      setReportDate(editingReport.reportDate || todayStr);
      setShift(editingReport.shift || liveStatus.primaryShift);
      setCategory(editingReport.category || 'OVERHAUL');
      setMachine(editingReport.machine ?? '');
      setInformation(editingReport.information ?? '');
      setIssue(editingReport.issue ?? '');
      setFollowUp(editingReport.followUp ?? '');
      setIsCompleted(Boolean(editingReport.isCompleted));
      setFieldErrors({});
      setSubmitError(null);
      return;
    }

    if (presetValues) {
      const targetDate = presetValues.reportDate || todayStr;
      setReportDate(targetDate);
      if (targetDate === todayStr && liveStatus.activeShifts.length > 0) {
        setShift(liveStatus.primaryShift);
      } else {
        setShift(presetValues.shift || liveStatus.primaryShift);
      }
      setCategory(presetValues.category || 'OVERHAUL');
      setMachine(presetValues.machine ?? '');
      setInformation(presetValues.information ?? '');
      setIssue(presetValues.issue ?? '');
      setFollowUp(presetValues.followUp ?? '');
      setIsCompleted(Boolean(presetValues.isCompleted));
      setFieldErrors({});
      setSubmitError(null);
    } else {
      setReportDate(todayStr);
      setShift(liveStatus.primaryShift);
      setMachine('');
      setIsCompleted(false);
    }
  }, [editingReport, presetValues, todayStr, liveStatus.activeShifts.length, liveStatus.primaryShift]);

  const machineRequired = categoryRequiresMachine(category);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const payload: HandoverFormInput = {
      reportDate,
      shift,
      category,
      machine: machine.trim() || null,
      information,
      issue,
      followUp,
      isCompleted,
    };

    const validation = validateHandoverInput(payload);
    if (!validation.valid) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const result = await onSubmitReport(payload, editingReport ? editingReport.id : null);
      if (!result.ok) {
        setSubmitError(result.error || 'Gagal menyimpan laporan.');
        return;
      }
      if (!editingReport) {
        setInformation('');
        setIssue('');
        setFollowUp('');
        setIsCompleted(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-slate-300 p-5 sm:p-7">
        <div className="border-b border-slate-200 pb-4 mb-5">
          <h2 className="text-lg font-bold text-slate-900">
            {editingReport ? 'Edit Laporan Handover' : 'Input Laporan Handover'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Pembuat:{' '}
            <span className="font-medium text-slate-800">
              {editingReport ? editingReport.createdByName : currentUser.fullName}
            </span>
          </p>
        </div>

        {submitError && (
          <div
            role="alert"
            className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm"
          >
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Tanggal */}
          <div>
            <label
              htmlFor="input-report-date"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Tanggal Laporan
            </label>
            <input
              id="input-report-date"
              type="date"
              value={reportDate}
              onChange={(e) => {
                const nextDate = e.target.value;
                setReportDate(nextDate);
                if (nextDate === todayStr && liveStatus.activeShifts.length > 0 && !editingReport) {
                  setShift(liveStatus.primaryShift);
                }
              }}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
            />
            {fieldErrors.reportDate && (
              <p className="mt-1 text-xs text-rose-600">{fieldErrors.reportDate}</p>
            )}
          </div>

          {/* Shift (Untuk laporan baru hari ini, hanya shift berjalan yang aktif) */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="block text-sm font-medium text-slate-700">
                Shift ({parseLocalDate(reportDate).getDay() === 6 ? 'Jadwal Sabtu' : 'Jadwal Senin - Jumat'})
              </span>
              {lockToRunningShift && (
                <span className="text-[11px] font-medium text-[#0F294A]">
                  Hanya shift berjalan ({liveStatus.primaryShift})
                </span>
              )}
            </div>
            <div role="group" aria-label="Pilih Shift" className="grid grid-cols-3 gap-2">
              {SHIFTS.map((s) => {
                const active = shift === s;
                const disabled = lockToRunningShift && !liveStatus.activeShifts.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={disabled}
                    onClick={() => setShift(s)}
                    aria-pressed={active}
                    className={`min-h-[52px] px-2.5 py-2 rounded-lg border transition-colors text-center ${
                      active
                        ? 'bg-[#0F294A] text-white border-[#0F294A]'
                        : disabled
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-xs sm:text-sm font-semibold">{s}</span>
                    <span
                      className={`block text-[10px] font-mono tabular-nums mt-0.5 ${
                        active ? 'text-slate-200' : 'text-slate-400'
                      }`}
                    >
                      {shiftSchedule[s]}
                    </span>
                  </button>
                );
              })}
            </div>
            {fieldErrors.shift && (
              <p className="mt-1 text-xs text-rose-600">{fieldErrors.shift}</p>
            )}
          </div>

          {/* Kategori & Mesin */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="input-category"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Kategori Pekerjaan
              </label>
              <select
                id="input-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryType)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {fieldErrors.category && (
                <p className="mt-1 text-xs text-rose-600">{fieldErrors.category}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="input-machine"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Mesin {machineRequired ? '(Wajib)' : '(Opsional)'}
              </label>
              <input
                id="input-machine"
                type="text"
                list="machine-suggestions"
                value={machine}
                onChange={(e) => setMachine(e.target.value)}
                placeholder="Contoh: AST 9-16L atau AST4S 22-16L"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
              />
              <datalist id="machine-suggestions">
                {SUGGESTED_MACHINES.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              {fieldErrors.machine && (
                <p className="mt-1 text-xs text-rose-600">{fieldErrors.machine}</p>
              )}
            </div>
          </div>

          {/* Pilihan cepat mesin umum */}
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_MACHINES.map((m) => {
              const selected = machine.trim().toUpperCase() === m.toUpperCase();
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMachine(m)}
                  className={`px-2.5 py-1 text-[11px] font-mono rounded border transition-colors ${
                    selected
                      ? 'bg-[#0F294A] text-white border-[#0F294A]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>

          {/* Hasil Shift */}
          <div>
            <label
              htmlFor="input-information"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Hasil / Update Shift
            </label>
            <textarea
              id="input-information"
              rows={3}
              value={information}
              onChange={(e) => setInformation(e.target.value)}
              placeholder="Contoh: sudah press 10T / hasil military OK / hasil stability OK"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
            />
            {fieldErrors.information && (
              <p className="mt-1 text-xs text-rose-600">{fieldErrors.information}</p>
            )}
          </div>

          {/* Instruksi Langkah Selanjutnya */}
          <div>
            <label
              htmlFor="input-followup"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Instruksi Langkah Selanjutnya
            </label>
            <textarea
              id="input-followup"
              rows={2}
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              placeholder="Contoh: lanjut military shift 2 / lanjut stability 8 jam shift 3"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
            />
          </div>

          {/* Masalah */}
          <div>
            <label
              htmlFor="input-issue"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Masalah / Temuan (Opsional)
            </label>
            <textarea
              id="input-issue"
              rows={2}
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="Catat kendala teknis bila ada..."
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
            />
          </div>

          {/* Status Case Selesai vs Berlanjut */}
          <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={isCompleted}
              onChange={(e) => setIsCompleted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0F294A] focus:ring-[#0F294A]"
            />
            <span className="text-xs sm:text-sm text-slate-700 leading-snug">
              <strong className="text-slate-900 block">
                Tandai case / pekerjaan selesai (OK)
              </strong>
              Jika dicentang, shift ini berwarna hijau muda (OK) dan mesin otomatis hilang dari Dashboard keesokan harinya (tetap tersimpan di History &amp; Report).
            </span>
          </label>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[44px] px-5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              BATAL
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] px-6 py-2.5 rounded-lg bg-[#0F294A] hover:bg-[#163864] disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              {editingReport ? (
                <Pencil className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>
                {submitting
                  ? 'Menyimpan...'
                  : editingReport
                    ? 'EDIT LAPORAN'
                    : 'SIMPAN LAPORAN'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
