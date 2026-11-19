import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Clock,
  Hourglass,
  Minus,
  PauseCircle,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Wrench,
  XCircle,
} from 'lucide-react';
import {
  CATEGORIES,
  SHIFTS,
  type ActivityStage,
  type CategoryType,
  type HandoverFormInput,
  type HandoverReport,
  type MilitaryStatus,
  type ShiftType,
  type StabilityPhase,
  type StabilityStatus,
  type UserProfile,
} from '../types/handover';
import {
  canSubmitReport,
  categoryRequiresMachine,
  formatDisplayDate,
  formatWorkflowBadge,
  getActiveMachinesForCategory,
  getCaseWorkflowContext,
  getCurrentShiftStatus,
  getOpenOperatorShiftSlots,
  getOperationalDateString,
  getShiftScheduleForDate,
  hasFullShiftAccess,
  hasOpenEpisodeStartedRepair,
  isOhOnlyInformation,
  isOperatorShiftInputAllowed,
  validateHandoverInput,
} from '../utils/handoverLogic';
import { MachinePicker } from './MachinePicker';

interface HandoverFormViewProps {
  currentUser: UserProfile;
  reports?: HandoverReport[];
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
  reports = [],
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

  // Tahapan Terstruktur (SOP)
  const [activityStage, setActivityStage] = useState<ActivityStage>('REPAIR');
  const [stageManuallyPicked, setStageManuallyPicked] = useState(false);
  const [militaryRound, setMilitaryRound] = useState<number>(1);
  const [militaryStatus, setMilitaryStatus] = useState<MilitaryStatus>('PENDING');
  const [militaryLeakBoxes, setMilitaryLeakBoxes] = useState<string>('1');
  const [stabilityPhase, setStabilityPhase] = useState<StabilityPhase>('4_HOURS');
  const [stabilityStatus, setStabilityStatus] = useState<StabilityStatus>('PENDING');

  const [information, setInformation] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [palletLocation, setPalletLocation] = useState('');
  const [palletManuallyEdited, setPalletManuallyEdited] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof HandoverFormInput, string>>
  >({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const infoTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const followUpTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const resizeEl = (el: HTMLTextAreaElement | null, minHeight: number) => {
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
    };
    resizeEl(infoTextareaRef.current, 92);
    resizeEl(followUpTextareaRef.current, 68);
  }, [information, followUp, activityStage, editingReport]);

  const shiftSchedule = useMemo(
    () => getShiftScheduleForDate(parseLocalDate(reportDate)),
    [reportDate]
  );

  const operatorClosedNow =
    !fullAccess && !editingReport && openOperatorSlots.length === 0;
  const lockDateAndShiftOnEdit = Boolean(editingReport && !fullAccess);

  const openDates = useMemo(() => {
    const unique = Array.from(new Set(openOperatorSlots.map((s) => s.reportDate)));
    return unique.sort();
  }, [openOperatorSlots]);

  const wfContext = useMemo(
    () => getCaseWorkflowContext(reports, category, machine),
    [reports, category, machine]
  );

  const isOverhaul = category === 'OVERHAUL';

  // Saat kategori berubah ke non-Overhaul, pastikan stabilityPhase langsung ke 8 Jam
  useEffect(() => {
    if (!isOverhaul && stabilityPhase === '4_HOURS') {
      setStabilityPhase('8_HOURS');
    }
  }, [isOverhaul, stabilityPhase]);

  // Reset tanda edit manual lokasi palet hanya ketika mesin atau kategori berganti
  useEffect(() => {
    if (!editingReport) {
      setPalletManuallyEdited(false);
    }
  }, [machine, category, editingReport]);

  // Saat mesin berubah (input baru), sarankan tahapan kerja alami & nomor military
  useEffect(() => {
    if (editingReport) return;
    if (!machine) {
      setPalletLocation('');
      return;
    }

    if (!stageManuallyPicked) {
      setActivityStage(wfContext.suggestedStage);
    }
    setMilitaryRound(wfContext.suggestedMilitaryRound);

    if (!isOverhaul) {
      setStabilityPhase('8_HOURS');
    } else {
      setStabilityPhase(wfContext.suggestedStabilityPhase);
    }

    if (!palletManuallyEdited) {
      setPalletLocation(wfContext.lastPalletLocation || '');
    }
  }, [
    machine,
    category,
    isOverhaul,
    editingReport,
    stageManuallyPicked,
    palletManuallyEdited,
    wfContext.suggestedStage,
    wfContext.suggestedMilitaryRound,
    wfContext.suggestedStabilityPhase,
    wfContext.lastPalletLocation,
  ]);

  // Inisialisasi editing atau preset (JANGAN masukkan `category` agar dropdown Kategori bisa diubah bebas)
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

      const initialStage: ActivityStage =
        editingReport.activityStage ||
        (isOhOnlyInformation(editingReport.information ?? '')
          ? 'OH'
          : editingReport.category === 'STABILITY TINGGI'
            ? 'STABILITY'
            : /\bmilitary\b/i.test(editingReport.information)
              ? 'MILITARY'
              : /\bstability\b/i.test(editingReport.information)
                ? 'STABILITY'
                : 'REPAIR');

      setActivityStage(initialStage);
      setStageManuallyPicked(true);
      setMilitaryRound(editingReport.militaryRound ?? 1);
      setMilitaryStatus(editingReport.militaryStatus ?? 'PENDING');
      setMilitaryLeakBoxes(
        String(
          editingReport.militaryLeakBoxes && editingReport.militaryLeakBoxes > 0
            ? editingReport.militaryLeakBoxes
            : 1
        )
      );
      setStabilityPhase(
        editingReport.stabilityPhase ??
          (editingReport.category === 'OVERHAUL' ? '4_HOURS' : '8_HOURS')
      );
      setStabilityStatus(editingReport.stabilityStatus ?? 'PENDING');

      setInformation(editingReport.information ?? '');
      setFollowUp(editingReport.followUp ?? '');
      setPalletLocation(editingReport.palletLocation ?? '');
      setPalletManuallyEdited(true);
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
      const nextCat = presetValues.category || 'OVERHAUL';
      setCategory(nextCat);
      setMachine(presetValues.machine ?? '');
      setInformation(presetValues.information ?? '');
      setFollowUp(presetValues.followUp ?? '');
      setPalletLocation(presetValues.palletLocation ?? '');
      setPalletManuallyEdited(Boolean(presetValues.palletLocation));
      setIsCompleted(Boolean(presetValues.isCompleted));

      if (presetValues.activityStage) {
        setActivityStage(presetValues.activityStage);
        setStageManuallyPicked(true);
      } else {
        setActivityStage('REPAIR');
        setStageManuallyPicked(false);
      }
      setMilitaryStatus('PENDING');
      setMilitaryLeakBoxes('1');
      setStabilityPhase(nextCat === 'OVERHAUL' ? '4_HOURS' : '8_HOURS');
      setStabilityStatus('PENDING');
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
      setPalletLocation('');
      setPalletManuallyEdited(false);
      setIsCompleted(false);
      setActivityStage('REPAIR');
      setStageManuallyPicked(false);
      setMilitaryRound(1);
      setMilitaryStatus('PENDING');
      setMilitaryLeakBoxes('1');
      setStabilityPhase('4_HOURS');
      setStabilityStatus('PENDING');
      setFieldErrors({});
      setSubmitError(null);
    }
  }, [editingReport, presetValues, fullAccess]);

  const showPalletLocationField =
    activityStage === 'MILITARY' || activityStage === 'STABILITY';

  const canMarkCompleted =
    activityStage !== 'OH' &&
    activityStage !== 'MILITARY' &&
    !(isOverhaul && (activityStage !== 'STABILITY' || stabilityPhase !== '8_HOURS')) &&
    !(activityStage === 'STABILITY' && (stabilityStatus !== 'OK' || (isOverhaul && stabilityPhase !== '8_HOURS')));

  const completedLockReason = useMemo(() => {
    if (canMarkCompleted) return null;
    if (activityStage === 'OH') {
      return 'Tahap OH (menunggu perbaikan) belum dapat ditandai selesai.';
    }
    if (activityStage === 'MILITARY') {
      return 'Tahap Military wajib dilanjutkan ke Stability sebelum mesin selesai.';
    }
    if (isOverhaul && activityStage === 'REPAIR') {
      return 'Kasus Overhaul wajib melalui Military & Stability 8 Jam sebelum selesai.';
    }
    if (isOverhaul && activityStage === 'STABILITY' && stabilityPhase === '4_HOURS') {
      return 'Pada Overhaul, Stability 4 Jam harus lanjut ke 8 Jam sebelum selesai.';
    }
    if (activityStage === 'STABILITY' && stabilityStatus !== 'OK') {
      return 'Hanya bisa ditandai selesai jika hasil Stability sudah OK.';
    }
    return 'Tahap saat ini belum memenuhi syarat untuk ditandai selesai.';
  }, [canMarkCompleted, activityStage, isOverhaul, stabilityPhase, stabilityStatus]);

  useEffect(() => {
    if (!canMarkCompleted && isCompleted) {
      setIsCompleted(false);
    }
  }, [canMarkCompleted, isCompleted]);

  const sameSlotReports = useMemo(() => {
    if (editingReport || !machine.trim() || !reportDate) return [];
    const normMachine = machine.trim().toUpperCase();
    return reports.filter(
      (r) =>
        r.reportDate === reportDate &&
        r.shift === shift &&
        r.category === category &&
        (r.machine ?? '').trim().toUpperCase() === normMachine
    );
  }, [editingReport, reports, reportDate, shift, category, machine]);

  const machineRequired = categoryRequiresMachine(category);
  const activeMachinesForCategory = useMemo(
    () => getActiveMachinesForCategory(reports, category),
    [reports, category]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const effectivePalletLocation = showPalletLocationField ? palletLocation.trim() : '';
    const otherReports = editingReport
      ? reports.filter((r) => r.id !== editingReport.id)
      : reports;
    const effectiveRepairStart =
      activityStage !== 'OH' &&
      !hasOpenEpisodeStartedRepair(otherReports, category, machine);

    const payload: HandoverFormInput = {
      reportDate,
      shift,
      category,
      machine: machine.trim() || null,
      information: information.trim(),
      followUp: followUp.trim(),
      palletLocation: effectivePalletLocation,
      isCompleted: canMarkCompleted ? isCompleted : false,
      isRepairStart: effectiveRepairStart,
      activityStage,
      militaryRound: activityStage === 'MILITARY' ? militaryRound : undefined,
      militaryStatus: activityStage === 'MILITARY' ? militaryStatus : undefined,
      militaryLeakBoxes:
        activityStage === 'MILITARY' && militaryStatus === 'LEAK'
          ? parseInt(militaryLeakBoxes, 10) || 0
          : undefined,
      stabilityPhase:
        activityStage === 'STABILITY'
          ? isOverhaul
            ? stabilityPhase
            : '8_HOURS'
          : undefined,
      stabilityStatus: activityStage === 'STABILITY' ? stabilityStatus : undefined,
    };

    const permission = canSubmitReport({
      user: currentUser,
      input: payload,
      editingReport,
      now: new Date(),
    });
    if (!permission.allowed) {
      setSubmitError(
        permission.reason || 'Anda tidak memiliki izin untuk menyimpan laporan ini.'
      );
      return;
    }

    const validation = validateHandoverInput(payload);
    if (!validation.valid) {
      setFieldErrors(validation.errors);
      return;
    }

    if (showPalletLocationField && !effectivePalletLocation) {
      setFieldErrors((prev) => ({
        ...prev,
        palletLocation: 'Lokasi palet wajib diisi saat mengambil military atau stability.',
      }));
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
        setFollowUp('');
        setPalletLocation('');
        setIsCompleted(false);
        setStageManuallyPicked(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const infoPlaceholder =
    activityStage === 'OH'
      ? 'Contoh: OH / menunggu perbaikan...'
      : activityStage === 'MILITARY'
        ? `Tulis catatan Military #${militaryRound}...`
        : activityStage === 'STABILITY'
          ? `Tulis catatan Stability ${stabilityPhase === '4_HOURS' ? '4 Jam' : '8 Jam'}...`
          : 'Tulis kondisi / hasil perbaikan mesin...';

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {operatorClosedNow && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm"
        >
          {now.getDay() === 0
            ? 'Hari Minggu libur operasional. Pengawas dibatasi; hubungi Admin atau Supervisor jika terdapat shift lembur.'
            : 'Di luar batas input shift (+4 jam). Hubungi Admin atau Supervisor.'}
        </div>
      )}

      {submitError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm"
        >
          {submitError}
        </div>
      )}

      {sameSlotReports.length > 0 && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm"
        >
          Sudah ada <span className="font-semibold">{sameSlotReports.length} laporan</span> untuk{' '}
          <span className="font-mono font-semibold">{machine}</span> pada {shift} ({reportDate}).
          Jika hanya ingin merevisi, gunakan tombol Edit di Dashboard/History agar data tidak ganda.
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-slate-200/90 shadow-xs divide-y divide-slate-200 overflow-hidden"
      >
        {/* 1. JADWAL & MESIN */}
        <section className="p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="input-report-date"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Tanggal
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
                className={`w-full min-h-[42px] px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F294A] ${
                  lockDateAndShiftOnEdit ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
                }`}
              />
              {fieldErrors.reportDate && (
                <p className="mt-1 text-xs text-rose-600">{fieldErrors.reportDate}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="input-category"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Kategori
              </label>
              <select
                id="input-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryType)}
                className="w-full min-h-[42px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
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
          </div>

          {/* Shift Selector */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">Shift</span>
            <div role="group" aria-label="Pilih Shift" className="grid grid-cols-3 gap-2.5">
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
                    className={`min-h-[50px] px-2 py-2 rounded-xl border transition-all active:scale-[0.98] text-center ${
                      active
                        ? 'bg-[#0F294A] text-white border-[#0F294A] shadow-md shadow-[#0F294A]/20'
                        : disabled
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-white text-slate-700 border-slate-200 shadow-xs hover:shadow-sm hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-xs sm:text-sm font-semibold">{s}</span>
                    <span
                      className={`block text-[10px] font-mono tabular-nums mt-0.5 ${
                        active ? 'text-slate-200' : 'text-slate-400'
                      }`}
                    >
                      {!fullAccess && !editingReport && openSlot
                        ? `s/d ${openSlot.graceDeadlineLabel}`
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

          {/* Pilih Mesin */}
          <div>
            <label
              htmlFor="input-machine"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Mesin {machineRequired ? <span className="text-rose-600">*</span> : ''}
            </label>
            <MachinePicker
              id="input-machine"
              value={machine}
              required={machineRequired}
              activeMachines={activeMachinesForCategory}
              onChange={(nextMachine) => {
                setMachine(nextMachine);
                if (!editingReport) {
                  setPalletManuallyEdited(false);
                  setStageManuallyPicked(false);
                }
              }}
            />
            {machine && wfContext.lastReport && (
              <div className="mt-2.5 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-semibold text-slate-900">Riwayat Terakhir:</span>
                  <span className="font-mono text-slate-700">
                    {wfContext.lastReport.shift} ({formatDisplayDate(wfContext.lastReport.reportDate)})
                  </span>
                  {formatWorkflowBadge(wfContext.lastReport) && (
                    <span className="font-medium text-[#0F294A]">
                      · {formatWorkflowBadge(wfContext.lastReport)?.badgeLabel}
                    </span>
                  )}
                </div>
                <span className="text-slate-500 tabular-nums">
                  PIC: {wfContext.lastReport.createdByName}
                </span>
              </div>
            )}
            {fieldErrors.machine && (
              <p className="mt-1 text-xs text-rose-600">{fieldErrors.machine}</p>
            )}
          </div>
        </section>

        {/* 2. TAHAP & HASIL */}
        <section className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700">Tahap Kerja</span>
            {machine && wfContext.militaryCount > 0 && (
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {wfContext.militaryCount}x Military
              </span>
            )}
          </div>

          <div
            role="group"
            aria-label="Pilih Tahap Shift Ini"
            className="grid grid-cols-2 sm:grid-cols-4 gap-2"
          >
            <button
              type="button"
              onClick={() => {
                setStageManuallyPicked(true);
                setActivityStage('OH');
                setIsCompleted(false);
                if (!information.trim()) {
                  setInformation('OH');
                }
              }}
              aria-pressed={activityStage === 'OH'}
              className={`min-h-[46px] px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] whitespace-nowrap ${
                activityStage === 'OH'
                  ? 'bg-slate-800 text-white border-slate-800 shadow-md shadow-slate-900/20'
                  : 'bg-white text-slate-700 border-slate-200 shadow-xs hover:shadow-sm hover:bg-slate-50'
              }`}
            >
              <PauseCircle className="w-4 h-4 shrink-0" />
              <span>OH</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStageManuallyPicked(true);
                setActivityStage('REPAIR');
                setIsCompleted(false);
                if (isOhOnlyInformation(information)) {
                  setInformation('');
                }
              }}
              aria-pressed={activityStage === 'REPAIR'}
              className={`min-h-[46px] px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] whitespace-nowrap ${
                activityStage === 'REPAIR'
                  ? 'bg-[#0F294A] text-white border-[#0F294A] shadow-md shadow-[#0F294A]/20'
                  : 'bg-white text-slate-700 border-slate-200 shadow-xs hover:shadow-sm hover:bg-slate-50'
              }`}
            >
              <Wrench className="w-4 h-4 shrink-0" />
              <span>Perbaikan</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStageManuallyPicked(true);
                setActivityStage('MILITARY');
                setIsCompleted(false);
                if (isOhOnlyInformation(information)) {
                  setInformation('');
                }
              }}
              aria-pressed={activityStage === 'MILITARY'}
              className={`min-h-[46px] px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] whitespace-nowrap ${
                activityStage === 'MILITARY'
                  ? 'bg-[#0F294A] text-white border-[#0F294A] shadow-md shadow-[#0F294A]/20'
                  : 'bg-white text-slate-700 border-slate-200 shadow-xs hover:shadow-sm hover:bg-slate-50'
              }`}
            >
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span>Military</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStageManuallyPicked(true);
                setActivityStage('STABILITY');
                if (stabilityStatus !== 'OK' || (isOverhaul && stabilityPhase !== '8_HOURS')) {
                  setIsCompleted(false);
                }
                if (isOhOnlyInformation(information)) {
                  setInformation('');
                }
              }}
              aria-pressed={activityStage === 'STABILITY'}
              className={`min-h-[46px] px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] whitespace-nowrap ${
                activityStage === 'STABILITY'
                  ? 'bg-[#0F294A] text-white border-[#0F294A] shadow-md shadow-[#0F294A]/20'
                  : 'bg-white text-slate-700 border-slate-200 shadow-xs hover:shadow-sm hover:bg-slate-50'
              }`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span>Stability</span>
            </button>
          </div>

          {activityStage === 'MILITARY' && (
            <div className="pt-1 space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-700">Military Ke-</span>
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Kurangi nomor military"
                    onClick={() => setMilitaryRound((prev) => Math.max(1, prev - 1))}
                    className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 shadow-xs hover:shadow-sm active:scale-[0.95] flex items-center justify-center text-slate-700 transition-all"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    aria-label="Nomor pengambilan military"
                    min={1}
                    max={50}
                    value={militaryRound}
                    onChange={(e) =>
                      setMilitaryRound(
                        Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1))
                      )
                    }
                    className="w-14 h-9 px-2 text-sm font-mono font-bold text-center border border-slate-300 rounded-xl bg-white"
                  />
                  <button
                    type="button"
                    aria-label="Tambah nomor military"
                    onClick={() => setMilitaryRound((prev) => Math.min(50, prev + 1))}
                    className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 shadow-xs hover:shadow-sm active:scale-[0.95] flex items-center justify-center text-slate-700 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {fieldErrors.militaryRound && (
                <p className="text-xs text-rose-600">{fieldErrors.militaryRound}</p>
              )}

              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Hasil Uji
                </span>
                {!editingReport && wfContext.hasPendingMilitary && (
                  <div className="mb-2.5 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                    Palet <strong>Military #{militaryRound}</strong> dari shift sebelumnya belum diuji. Klik <strong>OK (0%)</strong> jika lulus, atau <strong>Ada Bocor</strong> jika ada kebocoran.
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMilitaryStatus('PENDING');
                      setIsCompleted(false);
                      if (!information.trim() || information.startsWith('Ambil Military')) {
                        setInformation(
                          `Ambil Military Ke-${militaryRound}: Palet siap, belum diuji.`
                        );
                      }
                    }}
                    className={`min-h-[42px] px-2.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                      militaryStatus === 'PENDING'
                        ? 'bg-slate-800 text-white border-slate-800 shadow-md shadow-slate-900/20'
                        : 'bg-white text-slate-700 border-slate-200 shadow-xs hover:shadow-sm hover:bg-slate-50'
                    }`}
                  >
                    <Hourglass className="w-3.5 h-3.5 shrink-0" />
                    <span>Belum Diuji</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMilitaryStatus('OK');
                      if (!information.trim() || information.startsWith('Ambil Military')) {
                        setInformation(
                          `Ambil Military Ke-${militaryRound}: 0% Bocor (OK).`
                        );
                      }
                    }}
                    className={`min-h-[42px] px-2.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                      militaryStatus === 'OK'
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-md shadow-emerald-700/25'
                        : 'bg-white text-slate-700 border-slate-200 shadow-xs hover:shadow-sm hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>OK (0%)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMilitaryStatus('LEAK');
                      setIsCompleted(false);
                      if (!parseInt(militaryLeakBoxes, 10)) {
                        setMilitaryLeakBoxes('1');
                      }
                      if (!information.trim() || information.startsWith('Ambil Military')) {
                        setInformation(
                          `Ambil Military Ke-${militaryRound}: Ada bocor.`
                        );
                      }
                    }}
                    className={`min-h-[42px] px-2.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                      militaryStatus === 'LEAK'
                        ? 'bg-rose-700 text-white border-rose-700 shadow-md shadow-rose-700/25'
                        : 'bg-white text-slate-700 border-slate-200 shadow-xs hover:shadow-sm hover:bg-slate-50'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Ada Bocor</span>
                  </button>
                </div>
              </div>

              {militaryStatus === 'LEAK' && (
                <div className="space-y-1.5">
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 text-xs sm:text-sm">
                    <label htmlFor="input-leak-boxes" className="text-rose-900 font-medium">
                      Jumlah Bocor <span className="text-rose-600">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="input-leak-boxes"
                        type="number"
                        min={1}
                        max={500}
                        value={militaryLeakBoxes}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            setMilitaryLeakBoxes('');
                            return;
                          }
                          const parsed = parseInt(raw, 10);
                          if (!Number.isNaN(parsed)) {
                            setMilitaryLeakBoxes(String(Math.min(500, Math.max(1, parsed))));
                          }
                        }}
                        placeholder="1"
                        className="w-20 px-2.5 py-1.5 text-sm font-mono font-bold text-center border border-rose-300 rounded-xl bg-white text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                      <span className="text-rose-800 text-xs font-medium">Box</span>
                    </div>
                  </div>
                  {fieldErrors.militaryLeakBoxes && (
                    <p className="text-xs text-rose-600">{fieldErrors.militaryLeakBoxes}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {activityStage === 'STABILITY' && (
            <div className="pt-1 space-y-3.5">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-slate-700">Durasi</span>
                  {!isOverhaul && (
                    <span className="text-xs font-semibold text-teal-800">8 Jam</span>
                  )}
                </div>

                {isOverhaul && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setStabilityPhase('4_HOURS');
                        setIsCompleted(false);
                        if (!information.trim() || information.includes('Stability')) {
                          setInformation('Uji Stability 4 Jam.');
                        }
                      }}
                      className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                        stabilityPhase === '4_HOURS'
                          ? 'bg-[#0F294A] text-white border-[#0F294A] shadow-md shadow-[#0F294A]/20'
                          : 'bg-white text-slate-700 border-slate-200 shadow-xs hover:shadow-sm hover:bg-slate-50'
                      }`}
                    >
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>4 Jam</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setStabilityPhase('8_HOURS');
                        if (stabilityStatus === 'OK') {
                          setIsCompleted(true);
                        }
                        if (!information.trim() || information.includes('Stability')) {
                          setInformation('Uji Stability 8 Jam.');
                        }
                      }}
                      className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                        stabilityPhase === '8_HOURS'
                          ? 'bg-[#0F294A] text-white border-[#0F294A] shadow-md shadow-[#0F294A]/20'
                          : 'bg-white text-slate-700 border-slate-200 shadow-xs hover:shadow-sm hover:bg-slate-50'
                      }`}
                    >
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>8 Jam</span>
                    </button>
                  </div>
                )}
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Hasil Uji
                </span>
                {!editingReport && wfContext.hasPendingStability && (
                  <div className="mb-2.5 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                    Uji <strong>Stability {stabilityPhase === '4_HOURS' ? '4 Jam' : '8 Jam'}</strong> dari shift sebelumnya belum diuji. Klik <strong>OK</strong> jika stabil, atau <strong>Bocor</strong> jika ada kebocoran.
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStabilityStatus('PENDING');
                      setIsCompleted(false);
                      if (!information.trim() || information.startsWith('Uji Stability')) {
                        setInformation(
                          `Uji Stability ${stabilityPhase === '4_HOURS' ? '4 Jam' : '8 Jam'}: Palet siap, belum diuji.`
                        );
                      }
                    }}
                    className={`min-h-[42px] px-2.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                      stabilityStatus === 'PENDING'
                        ? 'bg-slate-800 text-white border-slate-800 shadow-md shadow-slate-900/20'
                        : 'bg-white text-slate-700 border-slate-200 shadow-xs hover:shadow-sm hover:bg-slate-50'
                    }`}
                  >
                    <Hourglass className="w-3.5 h-3.5 shrink-0" />
                    <span>Belum Diuji</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStabilityStatus('OK');
                      if (stabilityPhase === '8_HOURS') {
                        setIsCompleted(true);
                      }
                      if (!information.trim() || information.startsWith('Uji Stability')) {
                        setInformation(
                          `Uji Stability ${stabilityPhase === '4_HOURS' ? '4 Jam' : '8 Jam'}: Stabil (OK).`
                        );
                      }
                    }}
                    className={`min-h-[42px] px-2.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                      stabilityStatus === 'OK'
                        ? 'bg-teal-700 text-white border-teal-700 shadow-md shadow-teal-700/25'
                        : 'bg-white text-slate-700 border-slate-200 shadow-xs hover:shadow-sm hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>OK</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStabilityStatus('LEAK');
                      setIsCompleted(false);
                      if (!information.trim() || information.startsWith('Uji Stability')) {
                        setInformation(
                          `Uji Stability ${stabilityPhase === '4_HOURS' ? '4 Jam' : '8 Jam'}: Ada bocor.`
                        );
                      }
                    }}
                    className={`min-h-[42px] px-2.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                      stabilityStatus === 'LEAK'
                        ? 'bg-rose-700 text-white border-rose-700 shadow-md shadow-rose-700/25'
                        : 'bg-white text-slate-700 border-slate-200 shadow-xs hover:shadow-sm hover:bg-slate-50'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Bocor</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 3. CATATAN & STATUS */}
        <section className="p-5 sm:p-6 space-y-4">
          <div>
            <label
              htmlFor="input-information"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Keterangan <span className="text-rose-600">*</span>
            </label>
            <textarea
              ref={infoTextareaRef}
              id="input-information"
              rows={3}
              maxLength={2000}
              value={information}
              onChange={(e) => setInformation(e.target.value)}
              placeholder={infoPlaceholder}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
            />
            {fieldErrors.information && (
              <p className="mt-1 text-xs text-rose-600">{fieldErrors.information}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="input-followup"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Tindak Lanjut <span className="text-slate-400 font-normal">(Opsional)</span>
            </label>
            <textarea
              ref={followUpTextareaRef}
              id="input-followup"
              rows={2}
              maxLength={2000}
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              placeholder="Rencana untuk shift berikutnya..."
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
            />
            {fieldErrors.followUp && (
              <p className="mt-1 text-xs text-rose-600">{fieldErrors.followUp}</p>
            )}
          </div>

          {showPalletLocationField && (
            <div>
              <label
                htmlFor="input-pallet-location"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Lokasi Palet <span className="text-rose-600">*</span>
              </label>
              <input
                id="input-pallet-location"
                type="text"
                maxLength={200}
                value={palletLocation}
                onChange={(e) => {
                  setPalletManuallyEdited(true);
                  setPalletLocation(e.target.value);
                }}
                placeholder="Contoh: Staging Line A / Rak 02"
                className="w-full min-h-[42px] px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
              />
              {fieldErrors.palletLocation && (
                <p className="mt-1 text-xs text-rose-600">{fieldErrors.palletLocation}</p>
              )}
            </div>
          )}

          <div>
            <label
              className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                !canMarkCompleted
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : isCompleted
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs cursor-pointer'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70 cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                checked={canMarkCompleted && isCompleted}
                disabled={!canMarkCompleted}
                onChange={(e) => setIsCompleted(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 disabled:opacity-50"
              />
              <span className="text-xs sm:text-sm font-semibold">
                Selesai (OK / Siap Produksi)
              </span>
            </label>
            {!canMarkCompleted && completedLockReason && (
              <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                <span>{completedLockReason}</span>
              </p>
            )}
            {fieldErrors.isCompleted && (
              <p className="mt-1 text-xs text-rose-600">{fieldErrors.isCompleted}</p>
            )}
          </div>
        </section>

        {/* Footer Actions */}
        <div className="px-5 py-4 sm:px-6 bg-slate-50/80 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-6 py-2.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold shadow-xs hover:shadow-sm active:scale-[0.98] inline-flex items-center justify-center gap-2 transition-all"
          >
            <span>Batal</span>
          </button>
          <button
            type="submit"
            disabled={submitting || operatorClosedNow}
            className="min-h-[44px] px-7 py-2.5 rounded-full bg-[#0F294A] hover:bg-[#163864] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-md shadow-[#0F294A]/25 hover:shadow-lg active:scale-[0.98] inline-flex items-center justify-center gap-2 transition-all"
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
                  ? 'Simpan Perubahan'
                  : 'Simpan Laporan'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
