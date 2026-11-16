import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Pencil, Save, ShieldCheck, XCircle } from 'lucide-react';
import {
  APK_MACHINES,
  AST_MACHINES,
  CATEGORIES,
  MACHINE_OPTIONS,
  OTHER_MACHINES,
  SHIFTS,
  type CategoryType,
  type HandoverFormInput,
  type HandoverReport,
  type ShiftType,
  type UserProfile,
} from '../types/handover';
import {
  canSubmitReport,
  categoryRequiresMachine,
  getCurrentShiftStatus,
  getOpenOperatorShiftSlots,
  getOperationalDateString,
  getShiftScheduleForDate,
  hasFullShiftAccess,
  isOperatorShiftInputAllowed,
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
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const liveStatus = useMemo(() => getCurrentShiftStatus(now), [now]);
  const todayStr = useMemo(() => getOperationalDateString(now), [now]);
  const fullAccess = hasFullShiftAccess(currentUser);
  const openOperatorSlots = useMemo(
    () => (fullAccess ? [] : getOpenOperatorShiftSlots(now)),
    [fullAccess, now]
  );

  const defaultOperatorSlot = useMemo(() => {
    if (openOperatorSlots.length === 0) return null;
    return (
      openOperatorSlots.find((s) => !s.isGracePeriod) ?? openOperatorSlots[0]
    );
  }, [openOperatorSlots]);

  const [reportDate, setReportDate] = useState(
    () => defaultOperatorSlot?.reportDate ?? todayStr
  );
  const [shift, setShift] = useState<ShiftType>(
    () => defaultOperatorSlot?.shift ?? liveStatus.primaryShift
  );
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

  // Operator hanya bisa input pada shift yang masih dalam jendela aktif/+4 jam;
  // saat mengedit laporan lama miliknya, tanggal & shift dikunci sesuai laporan asli.
  const operatorClosedNow =
    !fullAccess && !editingReport && openOperatorSlots.length === 0;
  const lockDateAndShiftOnEdit = Boolean(editingReport && !fullAccess);

  const openDates = useMemo(() => {
    const unique = Array.from(new Set(openOperatorSlots.map((s) => s.reportDate)));
    return unique.sort();
  }, [openOperatorSlots]);

  useEffect(() => {
    const freshNow = new Date();
    const freshToday = getOperationalDateString(freshNow);
    const freshStatus = getCurrentShiftStatus(freshNow);
    const freshSlots = fullAccess ? [] : getOpenOperatorShiftSlots(freshNow);
    const freshDefaultSlot =
      freshSlots.find((s) => !s.isGracePeriod) ?? freshSlots[0] ?? null;

    if (editingReport) {
      setReportDate(editingReport.reportDate || freshToday);
      setShift(editingReport.shift || freshStatus.primaryShift);
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
      const targetDate = presetValues.reportDate || freshToday;
      const targetShift = presetValues.shift || freshStatus.primaryShift;
      if (fullAccess || isOperatorShiftInputAllowed(targetDate, targetShift, freshNow)) {
        setReportDate(targetDate);
        setShift(targetShift);
      } else if (freshDefaultSlot) {
        setReportDate(freshDefaultSlot.reportDate);
        setShift(freshDefaultSlot.shift);
      } else {
        setReportDate(targetDate);
        setShift(targetShift);
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
      if (fullAccess) {
        setReportDate(freshToday);
        setShift(freshStatus.primaryShift);
      } else if (freshDefaultSlot) {
        setReportDate(freshDefaultSlot.reportDate);
        setShift(freshDefaultSlot.shift);
      } else {
        setReportDate(freshToday);
        setShift(freshStatus.primaryShift);
      }
      setMachine('');
      setIsCompleted(false);
      setFieldErrors({});
      setSubmitError(null);
    }
  }, [editingReport, presetValues, fullAccess]);

  const machineRequired = categoryRequiresMachine(category);
  const isCustomLegacyMachine =
    Boolean(machine) &&
    !MACHINE_OPTIONS.includes(machine as (typeof MACHINE_OPTIONS)[number]);

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

    const permission = canSubmitReport({
      user: currentUser,
      input: payload,
      editingReport,
      now: new Date(),
    });
    if (!permission.allowed) {
      setSubmitError(permission.reason || 'Anda tidak memiliki izin untuk menyimpan laporan ini.');
      return;
    }

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900">
              {editingReport ? 'Edit Laporan Handover' : 'Input Laporan Handover'}
            </h2>
            {fullAccess && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-[11px] font-semibold text-[#0F294A]">
                <ShieldCheck className="w-3.5 h-3.5" />
                Akses Penuh ({currentUser.role === 'admin' ? 'Admin' : 'Supervisor'})
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Pembuat:{' '}
            <span className="font-medium text-slate-800">
              {editingReport ? editingReport.createdByName : currentUser.fullName}
            </span>
          </p>
        </div>

        {operatorClosedNow && (
          <div
            role="alert"
            className="mb-5 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm leading-relaxed"
          >
            Saat ini di luar jendela input shift reguler (batas maksimal <strong>+4 jam</strong> setelah shift selesai). Hubungi <strong>Admin</strong> atau <strong>Supervisor</strong> untuk penginputan di luar jadwal. Pengeditan laporan milik Anda tetap bisa dilakukan kapan pun melalui menu History atau Dashboard.
          </div>
        )}

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
              disabled={lockDateAndShiftOnEdit}
              min={!fullAccess && !editingReport && openDates.length > 0 ? openDates[0] : undefined}
              max={
                !fullAccess && !editingReport && openDates.length > 0
                  ? openDates[openDates.length - 1]
                  : undefined
              }
              onChange={(e) => {
                const nextDate = e.target.value;
                setReportDate(nextDate);
                if (!fullAccess && !editingReport) {
                  const slotForCurrentShift = openOperatorSlots.find(
                    (s) => s.reportDate === nextDate && s.shift === shift
                  );
                  if (!slotForCurrentShift) {
                    const firstOpenOnDate = openOperatorSlots.find(
                      (s) => s.reportDate === nextDate
                    );
                    if (firstOpenOnDate) {
                      setShift(firstOpenOnDate.shift);
                    }
                  }
                }
              }}
              className={`w-full min-h-[44px] px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F294A] ${
                lockDateAndShiftOnEdit ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
              }`}
            />
            {lockDateAndShiftOnEdit && (
              <p className="mt-1 text-[11px] text-slate-500">
                Pengeditan tersedia kapan pun; tanggal &amp; shift terkunci sesuai laporan asli (Admin/Supervisor dapat mengubahnya bebas).
              </p>
            )}
            {fieldErrors.reportDate && (
              <p className="mt-1 text-xs text-rose-600">{fieldErrors.reportDate}</p>
            )}
          </div>

          {/* Shift (Admin/Supervisor bebas; Operator mengikuti jadwal +4 jam saat input baru) */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <span className="block text-sm font-medium text-slate-700">
                Shift ({parseLocalDate(reportDate).getDay() === 6 ? 'Jadwal Sabtu' : 'Jadwal Senin - Jumat'})
              </span>
              {fullAccess ? (
                <span className="text-[11px] font-medium text-[#0F294A]">
                  Bebas pilih shift
                </span>
              ) : editingReport ? (
                <span className="text-[11px] font-medium text-slate-500">
                  Mengikuti shift laporan asli
                </span>
              ) : (
                <span className="text-[11px] font-medium text-[#0F294A]">
                  Input aktif hingga +4 jam setelah selesai
                </span>
              )}
            </div>
            <div role="group" aria-label="Pilih Shift" className="grid grid-cols-3 gap-2">
              {SHIFTS.map((s) => {
                const active =
                  shift === s &&
                  (fullAccess ||
                    Boolean(editingReport) ||
                    isOperatorShiftInputAllowed(reportDate, s, now));
                const slotForDate = openOperatorSlots.find(
                  (slot) => slot.shift === s && slot.reportDate === reportDate
                );
                const fallbackSlot = openOperatorSlots.find((slot) => slot.shift === s);
                const openSlot = slotForDate ?? fallbackSlot ?? null;

                const disabled = lockDateAndShiftOnEdit
                  ? true
                  : !fullAccess && !editingReport && !openSlot;

                return (
                  <button
                    key={s}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setShift(s);
                      if (!fullAccess && !editingReport && openSlot) {
                        setReportDate(openSlot.reportDate);
                      }
                    }}
                    aria-pressed={active}
                    className={`min-h-[54px] px-2 py-2 rounded-lg border transition-colors text-center ${
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
                      {!fullAccess && !editingReport && openSlot
                        ? openSlot.isGracePeriod
                          ? `+4j s/d ${openSlot.graceDeadlineLabel}`
                          : `s/d +4j (${openSlot.graceDeadlineLabel})`
                        : shiftSchedule[s]}
                    </span>
                  </button>
                );
              })}
            </div>
            {fieldErrors.shift && (
              <p className="mt-1 text-xs text-rose-600">{fieldErrors.shift}</p>
            )}
          </div>

          {/* Kategori & Dropdown Mesin Lengkap */}
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
              <select
                id="input-machine"
                value={machine}
                onChange={(e) => setMachine(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
              >
                <option value="">
                  {machineRequired ? '-- Pilih Mesin (Wajib) --' : '-- Pilih Mesin (Opsional) --'}
                </option>
                {isCustomLegacyMachine && (
                  <option value={machine}>{machine}</option>
                )}
                <optgroup label={`Seri AST (${AST_MACHINES.length} Mesin)`}>
                  {AST_MACHINES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={`Seri APK (${APK_MACHINES.length} Mesin)`}>
                  {APK_MACHINES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={`Mesin / Line Lainnya (${OTHER_MACHINES.length} Mesin)`}>
                  {OTHER_MACHINES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </optgroup>
              </select>
              {fieldErrors.machine && (
                <p className="mt-1 text-xs text-rose-600">{fieldErrors.machine}</p>
              )}
            </div>
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
              Jika dicentang, shift ini berwarna hijau muda (OK) dan mesin otomatis hilang dari Dashboard keesokan harinya (tetap tersimpan di History &amp; Report). Jika belum dicentang, case tetap tampil di Dashboard walaupun sudah berganti hari.
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
              disabled={submitting || operatorClosedNow}
              className="min-h-[44px] px-6 py-2.5 rounded-lg bg-[#0F294A] hover:bg-[#163864] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
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
