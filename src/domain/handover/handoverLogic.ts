import {
  CATEGORIES,
  OVERHAUL_MACHINES,
  SHIFTS,
  type ActivityStage,
  type CategoryType,
  type HandoverFormInput,
  type HandoverReport,
  type HistoryFilters,
  type MilitaryStatus,
  type ShiftType,
  type StabilityPhase,
  type StabilityStatus,
  type UserProfile,
} from '../../shared/types/handover';

export const SHIFT_INPUT_GRACE_HOURS = 4;

export function getTodayDateString(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTimeHHMM(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function parseLocalDateParts(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

// Hari operasional pabrik dimulai pukul 06:00 (Shift 1) sampai pukul 05:59 besok (akhir Shift 3).
// Catatan: Hanya Shift 3 Senin–Jumat yang berlanjut hingga 06:00 keesokan paginya (Selasa–Sabtu).
// Pada Minggu & Senin dini hari (00:00–05:59), tidak ada Shift 3 yang berjalan dari malam sebelumnya.
export function getOperationalDateString(now: Date = new Date()): string {
  const shifted = new Date(now);
  const day = shifted.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  if (shifted.getHours() < 6 && day >= 2 && day <= 6) {
    shifted.setDate(shifted.getDate() - 1);
  }
  return getTodayDateString(shifted);
}

export function categoryRequiresMachine(_category?: CategoryType): boolean {
  return true;
}

export interface ValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof HandoverFormInput, string>>;
  sanitizedMachine: string | null;
}

export function validateHandoverInput(input: HandoverFormInput): ValidationResult {
  const errors: Partial<Record<keyof HandoverFormInput, string>> = {};

  if (!input.reportDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.reportDate)) {
    errors.reportDate = 'Tanggal laporan wajib diisi (format YYYY-MM-DD).';
  }

  if (!SHIFTS.includes(input.shift)) {
    errors.shift = 'Shift wajib dipilih.';
  }

  if (!CATEGORIES.includes(input.category)) {
    errors.category = 'Kategori laporan wajib dipilih.';
  }

  const trimmedMachine = (input.machine ?? '').trim();
  const sanitizedMachine = trimmedMachine.length > 0 ? trimmedMachine : null;

  if (categoryRequiresMachine(input.category) && !sanitizedMachine) {
    errors.machine = 'Mesin wajib dipilih.';
  } else if (sanitizedMachine && sanitizedMachine.length > 64) {
    errors.machine = 'Nama mesin maksimal 64 karakter.';
  }

  const trimmedInfo = (input.information ?? '').trim();
  if (trimmedInfo.length === 0) {
    errors.information = 'Hasil / keterangan shift wajib diisi.';
  } else if (trimmedInfo.length > 2000) {
    errors.information = 'Keterangan maksimal 2000 karakter.';
  }

  const trimmedFollowUp = (input.followUp ?? '').trim();
  if (trimmedFollowUp.length > 2000) {
    errors.followUp = 'Tindak lanjut maksimal 2000 karakter.';
  }

  const trimmedPallet = (input.palletLocation ?? '').trim();
  if (trimmedPallet.length > 200) {
    errors.palletLocation = 'Lokasi palet maksimal 200 karakter.';
  }

  const trimmedLeakLine = (input.leakLine ?? '').trim();
  if (trimmedLeakLine.length > 200) {
    errors.leakLine = 'Line / Nozzle yang bocor maksimal 200 karakter.';
  }

  if (input.isCompleted) {
    if (input.activityStage === 'OH') {
      errors.isCompleted =
        'Tahap OH (belum mulai perbaikan) tidak dapat langsung ditandai Selesai.';
    } else if (input.activityStage === 'MILITARY') {
      errors.isCompleted =
        'Tahap Military belum selesai; harus dilanjutkan ke tahap Stability sebelum mesin siap produksi.';
    } else if (input.activityStage === 'STABILITY') {
      if (input.stabilityStatus === 'LEAK' || input.stabilityStatus === 'PENDING') {
        errors.isCompleted =
          'Tidak dapat menandai Selesai saat hasil uji Stability masih Belum Diuji atau Bocor.';
      } else if (input.category === 'OVERHAUL' && input.stabilityPhase === '4_HOURS') {
        errors.isCompleted =
          'Pada Overhaul, Stability 4 Jam harus dilanjutkan ke 8 Jam sebelum dapat ditandai Selesai.';
      }
    } else if (input.category === 'OVERHAUL' && input.activityStage === 'REPAIR') {
      errors.isCompleted =
        'Kasus Overhaul wajib melalui tahap Military dan Stability 8 Jam sebelum dapat ditandai Selesai.';
    }
  }

  if (input.activityStage === 'MILITARY') {
    if (!trimmedPallet) {
      errors.palletLocation =
        'Lokasi palet wajib diisi saat mengambil military atau stability.';
    }
    if (
      typeof input.militaryRound === 'number' &&
      (!Number.isInteger(input.militaryRound) ||
        input.militaryRound < 1 ||
        input.militaryRound > 50)
    ) {
      errors.militaryRound = 'Nomor pengambilan Military harus antara 1 sampai 50.';
    }
    if (input.militaryStatus === 'LEAK') {
      if (
        typeof input.militaryLeakBoxes !== 'number' ||
        !Number.isInteger(input.militaryLeakBoxes) ||
        input.militaryLeakBoxes < 1 ||
        input.militaryLeakBoxes > 500
      ) {
        errors.militaryLeakBoxes =
          'Jumlah bocor wajib diisi antara 1 sampai 500 box.';
      }
    }
  } else if (input.activityStage === 'STABILITY') {
    if (!trimmedPallet) {
      errors.palletLocation =
        'Lokasi palet wajib diisi saat mengambil military atau stability.';
    }
    if (
      input.category !== 'OVERHAUL' &&
      (input.stabilityPhase === '4_HOURS' || input.stabilityPhase === '4_AND_8_HOURS')
    ) {
      errors.stabilityPhase =
        'Stability 4 Jam / 4 & 8 Jam hanya berlaku untuk kategori OVERHAUL.';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitizedMachine,
  };
}

export interface DashboardSummary {
  totalToday: number;
  byCategory: Record<CategoryType, number>;
  byShiftToday: Record<ShiftType, number>;
  totalAll: number;
}

export function computeDashboardSummary(
  reports: HandoverReport[],
  targetDate: string
): DashboardSummary {
  const byCategory: Record<CategoryType, number> = {
    OVERHAUL: 0,
    'STABILITY TINGGI': 0,
    'CASE PERBAIKAN PART': 0,
    'COMMISSIONING / TRIAL / CHANGE OVER': 0,
  };

  const byShiftToday: Record<ShiftType, number> = {
    'Shift 1': 0,
    'Shift 2': 0,
    'Shift 3': 0,
  };

  let totalToday = 0;

  for (const report of reports) {
    if (report.reportDate === targetDate) {
      totalToday += 1;
      byCategory[report.category] += 1;
      byShiftToday[report.shift] += 1;
    }
  }

  return {
    totalToday,
    byCategory,
    byShiftToday,
    totalAll: reports.length,
  };
}

export type OverhaulMachineMatrix = Record<
  string,
  Record<ShiftType, HandoverReport[]>
>;

export function computeOverhaulMatrix(
  reports: HandoverReport[],
  targetDate: string
): OverhaulMachineMatrix {
  const matrix: OverhaulMachineMatrix = {};

  for (const machine of OVERHAUL_MACHINES) {
    matrix[machine] = {
      'Shift 1': [],
      'Shift 2': [],
      'Shift 3': [],
    };
  }

  for (const report of reports) {
    if (
      report.reportDate === targetDate &&
      report.category === 'OVERHAUL' &&
      report.machine
    ) {
      if (!matrix[report.machine]) {
        matrix[report.machine] = {
          'Shift 1': [],
          'Shift 2': [],
          'Shift 3': [],
        };
      }
      matrix[report.machine][report.shift].push(report);
    }
  }

  return matrix;
}

// Status OK / selesai hanya ditentukan jika kotak "Tandai case / pekerjaan selesai" dicentang
export function isReportResultOk(report: Pick<HandoverReport, 'isCompleted'>): boolean {
  return Boolean(report.isCompleted);
}

export function isShiftResultOk(reports: Pick<HandoverReport, 'isCompleted'>[]): boolean {
  if (reports.length === 0) return false;
  return reports.some((r) => Boolean(r.isCompleted));
}

export interface DashboardShiftRow {
  key: string;
  shift: ShiftType;
  reportDate: string;
  isCarryOver: boolean;
  carryOverLabel?: string;
  hours: string;
  reports: HandoverReport[];
  isRunningShift: boolean;
  canFill: boolean;
  isOk: boolean;
}

export interface MachineShiftGroup {
  machineName: string;
  rawMachine: string | null;
  isCompleted: boolean;
  hasStartedRepair: boolean;
  durationShifts: number;
  rows: DashboardShiftRow[];
}

export function groupActiveDashboardCases(
  reports: HandoverReport[],
  now: Date = new Date(),
  user: UserProfile | null = null
): Record<CategoryType, MachineShiftGroup[]> {
  const calendarToday = getTodayDateString(now);
  const today = getOperationalDateString(now);
  const [ty, tm, td] = today.split('-').map(Number);
  const yesterdayDate = new Date(ty, (tm || 1) - 1, td || 1);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = getTodayDateString(yesterdayDate);
  const liveStatus = getCurrentShiftStatus(now);
  const activeShift = liveStatus.primaryShift;
  const activeShiftIdx = SHIFTS.indexOf(activeShift);
  const hasActiveWindow = liveStatus.activeShifts.length > 0;
  const isPreDawnShift3 = now.getHours() < 6 && today !== calendarToday;
  const fullAccess = hasFullShiftAccess(user);

  const durationByReportId = new Map<string, CaseDurationItem>();
  for (const dur of computeCaseDurations(reports, now)) {
    for (const repId of dur.reportIds) {
      durationByReportId.set(repId, dur);
    }
  }

  const result = {} as Record<CategoryType, MachineShiftGroup[]>;
  for (const category of CATEGORIES) {
    result[category] = [];
  }

  for (const category of CATEGORIES) {
    // Kelompokkan semua laporan kategori ini berdasarkan mesin
    const byMachine = new Map<
      string,
      { rawMachine: string | null; displayName: string; items: HandoverReport[] }
    >();

    for (const rep of reports) {
      if (rep.category !== category) continue;
      const rawMachine = rep.machine?.trim() || null;
      const key = rawMachine ? rawMachine.toUpperCase() : '__UMUM__';
      let bucket = byMachine.get(key);
      if (!bucket) {
        bucket = {
          rawMachine,
          displayName: rawMachine ?? 'Umum / Non-Mesin',
          items: [],
        };
        byMachine.set(key, bucket);
      }
      bucket.items.push(rep);
    }

    for (const bucket of byMachine.values()) {
      const todayItems = bucket.items
        .filter(
          (r) =>
            r.reportDate === today ||
            (isPreDawnShift3 && r.reportDate === calendarToday)
        )
        .sort((a, b) => {
          if (a.reportDate !== b.reportDate) {
            return a.reportDate.localeCompare(b.reportDate);
          }
          const shiftDiff = SHIFTS.indexOf(a.shift) - SHIFTS.indexOf(b.shift);
          if (shiftDiff !== 0) return shiftDiff;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

      const prevItems = bucket.items
        .filter(
          (r) =>
            r.reportDate < today &&
            !(isPreDawnShift3 && r.reportDate === calendarToday)
        )
        .sort((a, b) => {
          if (a.reportDate !== b.reportDate) {
            return b.reportDate.localeCompare(a.reportDate);
          }
          const shiftDiff = SHIFTS.indexOf(b.shift) - SHIFTS.indexOf(a.shift);
          if (shiftDiff !== 0) return shiftDiff;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });

      const latestPrev = prevItems[0] ?? null;
      const latestPrevShiftReports = latestPrev
        ? prevItems
            .filter(
              (r) =>
                r.reportDate === latestPrev.reportDate &&
                r.shift === latestPrev.shift
            )
            .sort(
              (a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            )
        : [];

      // Case dianggap tuntas hanya jika laporan pada shift terakhir sebelumnya sudah dicentang selesai (isCompleted)
      const finishedPrev =
        latestPrev !== null &&
        latestPrevShiftReports.some((r) => Boolean(r.isCompleted));

      // Selama belum ditandai selesai, case tetap dibawa ke Dashboard walaupun sudah berganti hari (>1 hari)
      const hasCarryOver = latestPrev !== null && !finishedPrev;

      // Jika tidak ada laporan hari ini DAN tidak ada case yang belum selesai dari hari sebelumnya, hilangkan dari Dashboard
      if (todayItems.length === 0 && !hasCarryOver) {
        continue;
      }

      // Status selesai hari ini ditentukan dari shift TERAKHIR yang memiliki laporan hari ini.
      // Jika Shift 1 selesai (OK) lalu Shift 2 muncul masalah baru (belum selesai), case kembali aktif!
      const latestTodayRep = todayItems[todayItems.length - 1] ?? null;
      const todayCompleted =
        latestTodayRep !== null &&
        todayItems
          .filter(
            (r) =>
              r.reportDate === latestTodayRep.reportDate &&
              r.shift === latestTodayRep.shift
          )
          .some((r) => Boolean(r.isCompleted));

      const rows: DashboardShiftRow[] = [];

      // 1. Jika masih ada case belum selesai dari hari sebelumnya, tampilkan seluruh catatan shift terakhirnya
      if (hasCarryOver && latestPrev && latestPrevShiftReports.length > 0) {
        const prevDateObj = parseLocalDateParts(latestPrev.reportDate) ?? yesterdayDate;
        const prevSchedule = getShiftScheduleForDate(prevDateObj);
        rows.push({
          key: `carryover-${latestPrev.reportDate}-${latestPrev.shift}`,
          shift: latestPrev.shift,
          reportDate: latestPrev.reportDate,
          isCarryOver: true,
          carryOverLabel:
            latestPrev.reportDate === yesterday
              ? 'Kemarin'
              : formatDisplayDate(latestPrev.reportDate),
          hours: prevSchedule[latestPrev.shift],
          reports: latestPrevShiftReports,
          isRunningShift: false,
          canFill: false,
          isOk: isShiftResultOk(latestPrevShiftReports),
        });
      }

      // 2. Tentukan rentang shift hari ini yang ditampilkan (hanya sampai shift berjalan, tidak mendahului shift)
      const shiftIndicesToday = todayItems.map((r) => SHIFTS.indexOf(r.shift));
      const minTodayIdx = hasCarryOver
        ? 0
        : shiftIndicesToday.length > 0
          ? Math.min(...shiftIndicesToday)
          : activeShiftIdx;

      const maxTodayIdx = Math.max(
        activeShiftIdx,
        shiftIndicesToday.length > 0 ? Math.max(...shiftIndicesToday) : 0
      );

      for (let idx = minTodayIdx; idx <= maxTodayIdx; idx += 1) {
        const s = SHIFTS[idx];
        const sReports = todayItems.filter((r) => r.shift === s);
        const isRunning = hasActiveWindow
          ? liveStatus.activeShifts.includes(s)
          : false;

        if (sReports.length === 0 && todayCompleted) {
          continue;
        }

        const canFillRow =
          !todayCompleted &&
          (fullAccess || isRunning || isOperatorShiftInputAllowed(today, s, now));

        rows.push({
          key: `today-${s}`,
          shift: s,
          reportDate: today,
          isCarryOver: false,
          hours: liveStatus.schedule[s],
          reports: sReports,
          isRunningShift: isRunning,
          canFill: canFillRow,
          isOk: isShiftResultOk(sReports),
        });
      }

      // Maksimal 4 baris/kolom shift untuk case berkelanjutan (1 carry-over + max 3 shift hari ini)
      const cappedRows = rows.slice(-4);
      const latestRelevantReport = latestTodayRep ?? latestPrev;
      const matchedDuration = latestRelevantReport
        ? durationByReportId.get(latestRelevantReport.id)
        : undefined;

      result[category].push({
        machineName: bucket.displayName,
        rawMachine: bucket.rawMachine,
        isCompleted: todayCompleted,
        hasStartedRepair: matchedDuration ? matchedDuration.hasStartedRepair : false,
        durationShifts: matchedDuration ? matchedDuration.durationShifts : 0,
        rows: cappedRows,
      });
    }
  }

  return result;
}

export function filterAndSortReports(
  reports: HandoverReport[],
  filters: HistoryFilters
): HandoverReport[] {
  const kw = filters.keyword.trim().toLowerCase();

  return reports
    .filter((item) => {
      if (filters.date && item.reportDate !== filters.date) {
        return false;
      }
      if (filters.startDate && item.reportDate < filters.startDate) {
        return false;
      }
      if (filters.endDate && item.reportDate > filters.endDate) {
        return false;
      }
      if (filters.shift !== 'ALL' && item.shift !== filters.shift) {
        return false;
      }
      if (filters.category !== 'ALL' && item.category !== filters.category) {
        return false;
      }
      if (filters.status === 'OPEN' && item.isCompleted) {
        return false;
      }
      if (filters.status === 'COMPLETED' && !item.isCompleted) {
        return false;
      }
      if (kw) {
        const haystack = [
          item.machine ?? '',
          item.category,
          item.shift,
          item.information,
          item.followUp,
          item.palletLocation,
          item.leakLine ?? '',
          item.createdByName,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(kw)) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (a.reportDate !== b.reportDate) {
        return b.reportDate.localeCompare(a.reportDate);
      }
      const updatedDiff =
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      if (updatedDiff !== 0) {
        return updatedDiff;
      }
      return a.shift.localeCompare(b.shift);
    });
}

export function getActiveMachinesForCategory(
  reports: HandoverReport[],
  category: CategoryType
): string[] {
  const byMachine = new Map<string, { label: string; latestTime: number; reports: HandoverReport[] }>();

  for (const rep of reports) {
    if (rep.category !== category) continue;
    const raw = (rep.machine ?? '').trim();
    if (!raw) continue;
    const key = raw.toUpperCase();
    const t = new Date(rep.updatedAt || rep.createdAt).getTime() || 0;
    const existing = byMachine.get(key);
    if (!existing) {
      byMachine.set(key, { label: raw, latestTime: t, reports: [rep] });
    } else {
      existing.reports.push(rep);
      if (t >= existing.latestTime) {
        existing.latestTime = t;
        existing.label = raw;
      }
    }
  }

  const active: { label: string; latestTime: number }[] = [];
  for (const [, entry] of byMachine) {
    const sorted = [...entry.reports].sort((a, b) => {
      if (a.reportDate !== b.reportDate) {
        return a.reportDate.localeCompare(b.reportDate);
      }
      const shiftDiff = SHIFTS.indexOf(a.shift) - SHIFTS.indexOf(b.shift);
      if (shiftDiff !== 0) return shiftDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    let currentEp: HandoverReport[] = [];
    let completedRank: number | null = null;
    for (const r of sorted) {
      const rank = getShiftSlotRank(r.reportDate, r.shift);
      if (completedRank !== null && rank > completedRank) {
        currentEp = [];
        completedRank = null;
      }
      currentEp.push(r);
      if (isReportResultOk(r)) {
        completedRank = rank;
      }
    }

    if (completedRank === null && currentEp.length > 0) {
      active.push({ label: entry.label, latestTime: entry.latestTime });
    }
  }

  return active
    .sort((a, b) => b.latestTime - a.latestTime || a.label.localeCompare(b.label))
    .map((item) => item.label);
}

export function hasFullShiftAccess(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.role === 'supervisor' || Boolean(user.canEditAll);
}

export function canEditReport(
  report: HandoverReport,
  user: UserProfile | null
): boolean {
  if (!user) return false;
  if (hasFullShiftAccess(user)) {
    return true;
  }
  return report.createdBy === user.id;
}

export interface ShiftWindow {
  start: Date;
  end: Date;
  graceEnd: Date;
}

export function getShiftWindowForDate(
  reportDate: string,
  shift: ShiftType
): ShiftWindow | null {
  const baseDate = parseLocalDateParts(reportDate);
  if (!baseDate) return null;

  const day = baseDate.getDay();
  // Minggu tidak memiliki jadwal shift reguler baru
  if (day === 0) return null;

  const y = baseDate.getFullYear();
  const m = baseDate.getMonth();
  const d = baseDate.getDate();

  let startHour = 6;
  let endHour = 14;
  let endDayOffset = 0;

  if (day === 6) {
    // Sabtu: Shift 1 06:00-11:00, Shift 2 11:00-16:00, Shift 3 16:00-21:00
    if (shift === 'Shift 1') {
      startHour = 6;
      endHour = 11;
    } else if (shift === 'Shift 2') {
      startHour = 11;
      endHour = 16;
    } else {
      startHour = 16;
      endHour = 21;
    }
  } else {
    // Senin - Jumat: Shift 1 06:00-14:00, Shift 2 14:00-22:00, Shift 3 22:00-06:00
    if (shift === 'Shift 1') {
      startHour = 6;
      endHour = 14;
    } else if (shift === 'Shift 2') {
      startHour = 14;
      endHour = 22;
    } else {
      startHour = 22;
      endHour = 6;
      endDayOffset = 1;
    }
  }

  const start = new Date(y, m, d, startHour, 0, 0, 0);
  const end = new Date(y, m, d + endDayOffset, endHour, 0, 0, 0);
  const graceEnd = new Date(end.getTime() + SHIFT_INPUT_GRACE_HOURS * 60 * 60 * 1000);

  return { start, end, graceEnd };
}

export interface OpenShiftSlot {
  reportDate: string;
  shift: ShiftType;
  start: Date;
  end: Date;
  graceEnd: Date;
  isGracePeriod: boolean;
  graceDeadlineLabel: string;
}

export function isOperatorShiftInputAllowed(
  reportDate: string,
  shift: ShiftType,
  now: Date = new Date()
): boolean {
  const window = getShiftWindowForDate(reportDate, shift);
  if (!window) return false;
  const nowMs = now.getTime();
  return nowMs >= window.start.getTime() && nowMs <= window.graceEnd.getTime();
}

export function getOpenOperatorShiftSlots(now: Date = new Date()): OpenShiftSlot[] {
  const todayCal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayCal = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const candidateDates = [
    getTodayDateString(yesterdayCal),
    getTodayDateString(todayCal),
  ];

  const slots: OpenShiftSlot[] = [];
  const nowMs = now.getTime();

  for (const dateStr of candidateDates) {
    for (const shift of SHIFTS) {
      const window = getShiftWindowForDate(dateStr, shift);
      if (!window) continue;
      if (nowMs >= window.start.getTime() && nowMs <= window.graceEnd.getTime()) {
        slots.push({
          reportDate: dateStr,
          shift,
          start: window.start,
          end: window.end,
          graceEnd: window.graceEnd,
          isGracePeriod: nowMs > window.end.getTime(),
          graceDeadlineLabel: formatTimeHHMM(window.graceEnd),
        });
      }
    }
  }

  return slots;
}

export interface SubmissionPermissionResult {
  allowed: boolean;
  reason?: string;
}

export function canSubmitReport(params: {
  user: UserProfile | null;
  input: Pick<HandoverFormInput, 'reportDate' | 'shift'>;
  editingReport?: HandoverReport | null;
  now?: Date;
}): SubmissionPermissionResult {
  const { user, input, editingReport = null, now = new Date() } = params;

  if (!user) {
    return { allowed: false, reason: 'Sesi pengguna tidak ditemukan.' };
  }

  // Admin dan Supervisor punya akses penuh: bebas pilih shift/tanggal input & edit bebas
  if (hasFullShiftAccess(user)) {
    return { allowed: true };
  }

  // Pengeditan: bisa kapanpun selama dilakukan oleh pembuat laporan yang sama (atau Admin/Supervisor)
  if (editingReport) {
    if (!canEditReport(editingReport, user)) {
      return {
        allowed: false,
        reason: 'Hanya pembuat laporan atau Admin/Supervisor yang dapat mengedit laporan ini.',
      };
    }

    const unchangedTarget =
      input.reportDate === editingReport.reportDate && input.shift === editingReport.shift;
    if (!unchangedTarget && !isOperatorShiftInputAllowed(input.reportDate, input.shift, now)) {
      return {
        allowed: false,
        reason:
          'Pengawas hanya dapat mempertahankan tanggal & shift laporan asli saat mengedit, kecuali target shift masih dalam batas input +4 jam.',
      };
    }

    return { allowed: true };
  }

  // Penginputan baru oleh Pengawas: hanya selama shift berjalan hingga +4 jam setelah shift selesai
  if (isOperatorShiftInputAllowed(input.reportDate, input.shift, now)) {
    return { allowed: true };
  }

  const targetWindow = getShiftWindowForDate(input.reportDate, input.shift);
  if (targetWindow && now.getTime() > targetWindow.graceEnd.getTime()) {
    return {
      allowed: false,
      reason: `Batas input ${input.shift} tanggal ${input.reportDate} maksimal +4 jam setelah shift selesai (s/d pukul ${formatTimeHHMM(targetWindow.graceEnd)}). Hubungi Admin atau Supervisor.`,
    };
  }

  return {
    allowed: false,
    reason: `${input.shift} pada tanggal ${input.reportDate} belum dimulai atau di luar jadwal shift reguler (+4 jam).`,
  };
}

export function formatDateTimeId(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${mins}`;
}

export interface ActiveShiftStatus {
  dayTypeLabel: string;
  dateFormatted: string;
  currentTimeFormatted: string;
  activeShifts: ShiftType[];
  primaryShift: ShiftType;
  schedule: Record<ShiftType, string>;
  statusText: string;
}

export const WEEKDAY_SHIFT_HOURS: Record<ShiftType, string> = {
  'Shift 1': '06:00 - 14:00',
  'Shift 2': '14:00 - 22:00',
  'Shift 3': '22:00 - 06:00',
};

export const SATURDAY_SHIFT_HOURS: Record<ShiftType, string> = {
  'Shift 1': '06:00 - 11:00',
  'Shift 2': '11:00 - 16:00',
  'Shift 3': '16:00 - 21:00',
};

const DAY_NAMES_ID = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
] as const;

const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export function formatIndonesianDate(date: Date): string {
  const dayName = DAY_NAMES_ID[date.getDay()];
  const dayNum = date.getDate();
  const monthName = MONTH_NAMES_ID[date.getMonth()];
  const year = date.getFullYear();
  return `${dayName}, ${dayNum} ${monthName} ${year}`;
}

export const MONTH_SHORT_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const;

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr || '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const monthIdx = parseInt(m, 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return dateStr;
  const dayNum = parseInt(d, 10);
  return `${dayNum} ${MONTH_SHORT_ID[monthIdx]} ${y}`;
}

export function getShiftScheduleForDate(date: Date): Record<ShiftType, string> {
  if (date.getDay() === 6) {
    return SATURDAY_SHIFT_HOURS;
  }
  return WEEKDAY_SHIFT_HOURS;
}

export function getCurrentShiftStatus(now: Date = new Date()): ActiveShiftStatus {
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const currentTimeFormatted = `${hh}:${mm}`;
  const dateFormatted = formatIndonesianDate(now);

  // Sabtu: 00:00-05:59 adalah kelanjutan Shift 3 Jumat (22:00-06:00).
  // Shift Sabtu reguler: Shift 1 06:00-11:00, Shift 2 11:00-16:00, Shift 3 16:00-21:00.
  if (day === 6) {
    if (minutes < 360) {
      const friDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const friFormatted = formatIndonesianDate(friDate);
      return {
        dayTypeLabel: 'Jumat (Shift 3 Dini Hari)',
        dateFormatted: `${friFormatted} (Shift 3 Dini Hari)`,
        currentTimeFormatted,
        activeShifts: ['Shift 3'],
        primaryShift: 'Shift 3',
        schedule: WEEKDAY_SHIFT_HOURS,
        statusText: `Shift 3 (${WEEKDAY_SHIFT_HOURS['Shift 3']})`,
      };
    }

    let activeShifts: ShiftType[] = [];
    let primaryShift: ShiftType = 'Shift 3';
    let statusText =
      minutes >= 1260
        ? 'Shift 3 Selesai (Masa input s/d 01:00)'
        : 'Di luar jam shift Sabtu (21:00 - 06:00)';

    if (minutes >= 360 && minutes < 660) {
      activeShifts = ['Shift 1'];
      primaryShift = 'Shift 1';
      statusText = `Shift 1 (${SATURDAY_SHIFT_HOURS['Shift 1']})`;
    } else if (minutes >= 660 && minutes < 960) {
      activeShifts = ['Shift 2'];
      primaryShift = 'Shift 2';
      statusText = `Shift 2 (${SATURDAY_SHIFT_HOURS['Shift 2']})`;
    } else if (minutes >= 960 && minutes < 1260) {
      activeShifts = ['Shift 3'];
      primaryShift = 'Shift 3';
      statusText = `Shift 3 (${SATURDAY_SHIFT_HOURS['Shift 3']})`;
    }

    return {
      dayTypeLabel: 'Sabtu',
      dateFormatted,
      currentTimeFormatted,
      activeShifts,
      primaryShift,
      schedule: SATURDAY_SHIFT_HOURS,
      statusText,
    };
  }

  // Minggu: Sabtu Shift 3 selesai 21:00, sehingga seluruh hari Minggu di luar jam shift reguler
  if (day === 0) {
    return {
      dayTypeLabel: 'Minggu',
      dateFormatted,
      currentTimeFormatted,
      activeShifts: [],
      primaryShift: 'Shift 1',
      schedule: WEEKDAY_SHIFT_HOURS,
      statusText: 'Hari Minggu (Libur Operasional)',
    };
  }

  // Senin 00:00 - 05:59: Minggu malam tidak ada Shift 3 reguler
  if (day === 1 && minutes < 360) {
    return {
      dayTypeLabel: 'Senin (Dini Hari)',
      dateFormatted,
      currentTimeFormatted,
      activeShifts: [],
      primaryShift: 'Shift 1',
      schedule: WEEKDAY_SHIFT_HOURS,
      statusText: 'Di luar jam shift reguler (mulai 06:00)',
    };
  }

  // Senin - Jumat: Shift 1 06:00-14:00, Shift 2 14:00-22:00, Shift 3 22:00-06:00
  let activeShifts: ShiftType[] = [];
  let primaryShift: ShiftType = 'Shift 1';
  let statusText = '';

  if (minutes >= 360 && minutes < 840) {
    activeShifts = ['Shift 1'];
    primaryShift = 'Shift 1';
    statusText = `Shift 1 (${WEEKDAY_SHIFT_HOURS['Shift 1']})`;
  } else if (minutes >= 840 && minutes < 1320) {
    activeShifts = ['Shift 2'];
    primaryShift = 'Shift 2';
    statusText = `Shift 2 (${WEEKDAY_SHIFT_HOURS['Shift 2']})`;
  } else {
    activeShifts = ['Shift 3'];
    primaryShift = 'Shift 3';
    statusText = `Shift 3 (${WEEKDAY_SHIFT_HOURS['Shift 3']})`;
  }

  return {
    dayTypeLabel: 'Senin - Jumat',
    dateFormatted,
    currentTimeFormatted,
    activeShifts,
    primaryShift,
    schedule: WEEKDAY_SHIFT_HOURS,
    statusText,
  };
}

function parseUtcDayNumber(dateStr: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 0;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return 0;
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function utcDayNumberToDateInfo(dayNum: number): { dateStr: string; dayOfWeek: number } {
  const d = new Date(dayNum * 86400000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return {
    dateStr: `${yyyy}-${mm}-${dd}`,
    dayOfWeek: d.getUTCDay(), // 0 = Minggu
  };
}

export function getShiftSlotRank(dateStr: string, shift: ShiftType): number {
  return parseUtcDayNumber(dateStr) * SHIFTS.length + SHIFTS.indexOf(shift);
}

export function buildSundayShiftKey(dateStr: string, shift: ShiftType): string {
  return `${dateStr}::${shift}`;
}

export function calculateShiftSpan(
  startDate: string,
  startShift: ShiftType,
  endDate: string,
  endShift: ShiftType,
  activeSundayShifts?: Set<string>,
  activeDates?: Set<string>
): number {
  const startRank = getShiftSlotRank(startDate, startShift);
  const endRank = getShiftSlotRank(endDate, endShift);
  if (startRank <= 0 || endRank <= 0 || endRank < startRank) {
    return 1;
  }

  // Batasi iterasi maksimum agar aman untuk input ekstrem
  const maxSpan = 3650 * SHIFTS.length;
  if (endRank - startRank > maxSpan) {
    return endRank - startRank + 1;
  }

  let count = 0;
  for (let rank = startRank; rank <= endRank; rank += 1) {
    const dayNum = Math.floor(rank / SHIFTS.length);
    const shiftIdx = ((rank % SHIFTS.length) + SHIFTS.length) % SHIFTS.length;
    const shift = SHIFTS[shiftIdx];
    const { dateStr, dayOfWeek } = utcDayNumberToDateInfo(dayNum);

    if (dayOfWeek === 0) {
      // Hari Minggu: hanya dihitung jika ada shift yang melakukan update pada slot tersebut
      if (activeSundayShifts?.has(buildSundayShiftKey(dateStr, shift))) {
        count += 1;
      }
    } else if (activeDates && !activeDates.has(dateStr)) {
      // Hari libur / tanggal merah: 3 shift pada tanggal tersebut tidak ada yang mengisi -> jangan dihitung
      continue;
    } else {
      count += 1;
    }
  }

  return Math.max(1, count);
}

export function isOhOnlyInformation(info: string): boolean {
  const normalized = info.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return false;
  return /^(status|update|masih|posisi)?\s*oh[\s.,:;\-()]*$/.test(normalized);
}

export function requiresPalletLocation(
  category: CategoryType,
  information: string,
  activityStage?: ActivityStage
): boolean {
  if (activityStage === 'MILITARY' || activityStage === 'STABILITY') return true;
  if (activityStage === 'OH' || activityStage === 'REPAIR') return false;
  if (category === 'STABILITY TINGGI') return true;
  return /\b(military|stability)\b/i.test(information);
}

export function shouldShowRepairStartField(
  reports: HandoverReport[],
  category: CategoryType,
  machine: string | null,
  editingReport?: HandoverReport | null
): boolean {
  if (editingReport) {
    if (editingReport.isRepairStart === true) {
      return true;
    }
    const otherReports = reports.filter((r) => r.id !== editingReport.id);
    return !hasOpenEpisodeStartedRepair(otherReports, category, machine);
  }

  const trimmedMachine = (machine ?? '').trim();
  if (!trimmedMachine) {
    return false;
  }

  return !hasOpenEpisodeStartedRepair(reports, category, trimmedMachine);
}

export function countMilitaryInReport(
  report: Pick<HandoverReport, 'activityStage' | 'militaryStatus' | 'information'>
): number {
  if (report.activityStage === 'MILITARY') {
    if (report.militaryStatus === 'PENDING') {
      return 0;
    }
    return 1;
  }
  if (report.activityStage === 'OH' || report.activityStage === 'REPAIR') {
    return 0;
  }
  const infoLines = String(report.information ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return infoLines.filter((line) => /\bmilitary\b/i.test(line)).length;
}

export function countStabilityInReport(
  report: Pick<
    HandoverReport,
    'category' | 'activityStage' | 'stabilityStatus' | 'information'
  >
): number {
  if (report.activityStage === 'STABILITY') {
    if (report.stabilityStatus === 'PENDING') {
      return 0;
    }
    return 1;
  }
  if (
    report.activityStage === 'OH' ||
    report.activityStage === 'REPAIR' ||
    report.activityStage === 'MILITARY'
  ) {
    return 0;
  }
  const infoLines = String(report.information ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const infoMatches = infoLines.filter((line) => /\bstability\b/i.test(line)).length;
  if (infoMatches > 0) {
    return infoMatches;
  }

  if (report.category === 'STABILITY TINGGI') {
    return 1;
  }

  return 0;
}

function findEpisodeRepairStartIndex(ep: HandoverReport[]): number {
  // 1. Jika ada penanda eksplisit awal perbaikan (dan bukan tahap OH)
  const explicitStartIdx = ep.findIndex(
    (r) => r.isRepairStart === true && r.activityStage !== 'OH'
  );
  if (explicitStartIdx >= 0) {
    return explicitStartIdx;
  }

  // 2. Opsi A (Tahap Kerja Terstruktur): tahap 'OH' belum dihitung (0 Shift);
  // laporan pertama bertahap REPAIR / MILITARY / STABILITY otomatis menjadi Shift ke-1.
  const hasStructuredStage = ep.some((r) => Boolean(r.activityStage));
  if (hasStructuredStage) {
    return ep.findIndex(
      (r) =>
        r.activityStage === 'REPAIR' ||
        r.activityStage === 'MILITARY' ||
        r.activityStage === 'STABILITY' ||
        (!r.activityStage && r.isRepairStart !== false && !isOhOnlyInformation(r.information))
    );
  }

  // 3. Kompatibilitas data lama tanpa activityStage:
  // Jika semua laporan secara eksplisit menandai isRepairStart === false, durasi belum dimulai.
  const allExplicitFalse = ep.every((r) => r.isRepairStart === false);
  if (allExplicitFalse) {
    return -1;
  }

  // Untuk data tanpa flag eksplisit, lewati update awal berketerangan "OH";
  // update non-OH setelahnya menjadi Shift ke-1.
  const firstNonOhIdx = ep.findIndex(
    (r) => r.isRepairStart !== false && !isOhOnlyInformation(r.information)
  );
  return firstNonOhIdx;
}

export function hasOpenEpisodeStartedRepair(
  reports: HandoverReport[],
  category: CategoryType,
  machine: string | null
): boolean {
  const normalizedMachine = (machine ?? '').trim().toUpperCase();
  if (!normalizedMachine) return false;

  const matching = reports
    .filter(
      (r) =>
        r.category === category &&
        (r.machine ?? '').trim().toUpperCase() === normalizedMachine
    )
    .sort((a, b) => {
      if (a.reportDate !== b.reportDate) {
        return a.reportDate.localeCompare(b.reportDate);
      }
      const shiftDiff = SHIFTS.indexOf(a.shift) - SHIFTS.indexOf(b.shift);
      if (shiftDiff !== 0) return shiftDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  if (matching.length === 0) return false;

  let currentEp: HandoverReport[] = [];
  let completedRank: number | null = null;
  for (const rep of matching) {
    const repRank = getShiftSlotRank(rep.reportDate, rep.shift);
    if (completedRank !== null && repRank > completedRank) {
      currentEp = [];
      completedRank = null;
    }
    currentEp.push(rep);
    if (rep.isCompleted) {
      completedRank = completedRank === null ? repRank : Math.max(completedRank, repRank);
    }
  }

  if (currentEp.length === 0 || currentEp.some((r) => Boolean(r.isCompleted))) {
    return false;
  }

  return findEpisodeRepairStartIndex(currentEp) >= 0;
}

export interface CaseWorkflowContext {
  episodeReports: HandoverReport[];
  hasStartedRepair: boolean;
  militaryCount: number;
  suggestedMilitaryRound: number;
  lastMilitaryReport: HandoverReport | null;
  lastMilitaryStatus: MilitaryStatus | null;
  hasPassedMilitary: boolean;
  hasPassedStability4h: boolean;
  suggestedStage: ActivityStage;
  allowedStabilityPhases: StabilityPhase[];
  suggestedStabilityPhase: StabilityPhase;
  lastPalletLocation: string;
  lastFollowUp: string;
  hasPendingMilitary: boolean;
  hasPendingStability: boolean;
  lastReport: HandoverReport | null;
  hasActiveEpisode: boolean;
}

export function getCaseWorkflowContext(
  reports: HandoverReport[],
  category: CategoryType,
  machine: string | null
): CaseWorkflowContext {
  const normalizedMachine = (machine ?? '').trim().toUpperCase();
  const isOverhaul = category === 'OVERHAUL';
  const allowedStabilityPhases: StabilityPhase[] = isOverhaul
    ? ['4_HOURS', '8_HOURS', '4_AND_8_HOURS']
    : ['8_HOURS'];

  if (!normalizedMachine) {
    return {
      episodeReports: [],
      hasStartedRepair: false,
      militaryCount: 0,
      suggestedMilitaryRound: 1,
      lastMilitaryReport: null,
      lastMilitaryStatus: null,
      hasPassedMilitary: false,
      hasPassedStability4h: false,
      suggestedStage: 'REPAIR',
      allowedStabilityPhases,
      suggestedStabilityPhase: isOverhaul ? '4_HOURS' : '8_HOURS',
      lastPalletLocation: '',
      lastFollowUp: '',
      hasPendingMilitary: false,
      hasPendingStability: false,
      lastReport: null,
      hasActiveEpisode: false,
    };
  }

  const matching = reports
    .filter(
      (r) =>
        r.category === category &&
        (r.machine ?? '').trim().toUpperCase() === normalizedMachine
    )
    .sort((a, b) => {
      if (a.reportDate !== b.reportDate) {
        return a.reportDate.localeCompare(b.reportDate);
      }
      const shiftDiff = SHIFTS.indexOf(a.shift) - SHIFTS.indexOf(b.shift);
      if (shiftDiff !== 0) return shiftDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  let currentEp: HandoverReport[] = [];
  let completedRank: number | null = null;
  for (const rep of matching) {
    const repRank = getShiftSlotRank(rep.reportDate, rep.shift);
    if (completedRank !== null && repRank > completedRank) {
      currentEp = [];
      completedRank = null;
    }
    currentEp.push(rep);
    if (rep.isCompleted) {
      completedRank = completedRank === null ? repRank : Math.max(completedRank, repRank);
    }
  }

  if (currentEp.some((r) => Boolean(r.isCompleted))) {
    currentEp = [];
  }

  const hasStartedRepair = currentEp.length > 0 && findEpisodeRepairStartIndex(currentEp) >= 0;

  const militaryReports = currentEp.filter((r) => {
    if (r.activityStage === 'MILITARY') return true;
    if (!r.activityStage) return /\bmilitary\b/i.test(r.information);
    return false;
  });

  const testedMilitaryReports = militaryReports.filter(
    (r) => r.militaryStatus !== 'PENDING'
  );
  const militaryCount = testedMilitaryReports.length;
  const lastMilitaryReport = militaryReports[militaryReports.length - 1] ?? null;

  let lastMilitaryStatus: MilitaryStatus | null = null;
  if (lastMilitaryReport) {
    if (lastMilitaryReport.militaryStatus) {
      lastMilitaryStatus = lastMilitaryReport.militaryStatus;
    } else {
      const lower = lastMilitaryReport.information.toLowerCase();
      lastMilitaryStatus = lower.includes('bocor') || lower.includes('gagal') ? 'LEAK' : 'OK';
    }
  }

  // Jika military terakhir masih PENDING (belum diuji di shift sebelumnya),
  // shift berikutnya melanjutkan uji pada nomor round yang sama.
  const suggestedMilitaryRound =
    lastMilitaryStatus === 'PENDING'
      ? (lastMilitaryReport?.militaryRound ?? militaryCount + 1)
      : militaryCount + 1;

  // Temukan titik reset siklus terakhir (saat Military atau Stability dinyatakan LEAK / bocor).
  // Sesuai SOP: jika bocor di Military / Stability 4j / Stability 8j, siklus uji diulang dari Perbaikan -> Military -> Stability 4j (Overhaul) -> 8j.
  let lastLeakIdx = -1;
  for (let i = currentEp.length - 1; i >= 0; i -= 1) {
    const r = currentEp[i];
    const isMilitaryLeak =
      r.activityStage === 'MILITARY' && r.militaryStatus === 'LEAK';
    const isStabilityLeak =
      r.activityStage === 'STABILITY' && r.stabilityStatus === 'LEAK';
    const isLegacyLeak =
      !r.activityStage &&
      /\b(military|stability)\b/i.test(r.information) &&
      /(bocor|gagal)/i.test(r.information);
    if (isMilitaryLeak || isStabilityLeak || isLegacyLeak) {
      lastLeakIdx = i;
      break;
    }
  }

  const cycleReports =
    lastLeakIdx >= 0 ? currentEp.slice(lastLeakIdx + 1) : currentEp;

  const cycleMilitaryReports = cycleReports.filter((r) => {
    if (r.activityStage === 'MILITARY') return true;
    if (!r.activityStage) return /\bmilitary\b/i.test(r.information);
    return false;
  });

  let lastCycleMilitaryOkIdx = -1;
  for (let i = cycleReports.length - 1; i >= 0; i -= 1) {
    const r = cycleReports[i];
    if (r.activityStage === 'MILITARY' && r.militaryStatus === 'OK') {
      lastCycleMilitaryOkIdx = i;
      break;
    }
    if (!r.activityStage && /\bmilitary\b/i.test(r.information)) {
      const lower = r.information.toLowerCase();
      if (!lower.includes('bocor') && !lower.includes('gagal')) {
        lastCycleMilitaryOkIdx = i;
        break;
      }
    }
  }

  const hasPassedMilitary = lastCycleMilitaryOkIdx >= 0;

  const cycleStabilityScope =
    lastCycleMilitaryOkIdx >= 0
      ? cycleReports.slice(lastCycleMilitaryOkIdx + 1)
      : cycleReports;

  const cycleStabilityReports = cycleStabilityScope.filter((r) => {
    if (r.activityStage === 'STABILITY') return true;
    if (!r.activityStage) {
      return /\bstability\b/i.test(r.information) || r.category === 'STABILITY TINGGI';
    }
    return false;
  });

  const lastCycleStabilityReport =
    cycleStabilityReports[cycleStabilityReports.length - 1] ?? null;

  const hasPassedStability4h = cycleStabilityReports.some((r) => {
    if (
      (r.stabilityPhase === '4_HOURS' || r.stabilityPhase === '4_AND_8_HOURS') &&
      r.stabilityStatus === 'OK'
    ) {
      return true;
    }
    if (!r.stabilityPhase && isOverhaul) {
      const lower = r.information.toLowerCase();
      return lower.includes('4 jam') && !lower.includes('bocor');
    }
    return false;
  });

  let lastPalletLocation = '';
  for (let i = currentEp.length - 1; i >= 0; i -= 1) {
    const loc = (currentEp[i].palletLocation ?? '').trim();
    if (loc && loc !== '-') {
      lastPalletLocation = loc;
      break;
    }
  }

  let lastFollowUp = '';
  for (let i = currentEp.length - 1; i >= 0; i -= 1) {
    const fu = (currentEp[i].followUp ?? '').trim();
    if (fu && fu !== '-') {
      lastFollowUp = fu;
      break;
    }
  }

  let suggestedStage: ActivityStage = 'REPAIR';
  const latestReport = currentEp[currentEp.length - 1] ?? null;

  if (latestReport) {
    if (
      lastMilitaryReport &&
      lastMilitaryReport.id === latestReport.id &&
      lastMilitaryStatus === 'PENDING'
    ) {
      // Shift sebelumnya baru menyiapkan palet military, shift ini menginput hasil ujinya
      suggestedStage = 'MILITARY';
    } else if (
      lastMilitaryReport &&
      lastMilitaryReport.id === latestReport.id &&
      lastMilitaryStatus === 'LEAK'
    ) {
      suggestedStage = 'REPAIR';
    } else if (
      latestReport.activityStage === 'STABILITY' &&
      latestReport.stabilityStatus === 'PENDING'
    ) {
      // Stability sudah dimulai di shift sebelumnya, shift ini menginput hasilnya
      suggestedStage = 'STABILITY';
    } else if (
      latestReport.activityStage === 'STABILITY' &&
      latestReport.stabilityStatus === 'LEAK'
    ) {
      suggestedStage = 'REPAIR';
    } else if (
      hasPassedMilitary &&
      (cycleStabilityReports.length === 0 ||
        (latestReport.activityStage === 'MILITARY' &&
          latestReport.militaryStatus === 'OK'))
    ) {
      suggestedStage = 'STABILITY';
    } else if (
      isOverhaul &&
      hasPassedStability4h &&
      !cycleStabilityReports.some(
        (r) =>
          (r.stabilityPhase === '8_HOURS' || r.stabilityPhase === '4_AND_8_HOURS') &&
          r.stabilityStatus !== 'PENDING'
      )
    ) {
      suggestedStage = 'STABILITY';
    } else if (hasStartedRepair && !hasPassedMilitary) {
      // Setelah Perbaikan (termasuk perbaikan ulang pasca bocor), lanjut ambil Military
      const hasPendingCycleMil = cycleMilitaryReports.some(
        (r) => r.militaryStatus === 'PENDING'
      );
      suggestedStage = hasPendingCycleMil ? 'MILITARY' : 'MILITARY';
    }
  }

  let suggestedStabilityPhase: StabilityPhase = '8_HOURS';
  if (isOverhaul) {
    if (
      lastCycleStabilityReport &&
      lastCycleStabilityReport.stabilityStatus === 'PENDING' &&
      lastCycleStabilityReport.stabilityPhase
    ) {
      suggestedStabilityPhase = lastCycleStabilityReport.stabilityPhase;
    } else {
      suggestedStabilityPhase = hasPassedStability4h ? '8_HOURS' : '4_HOURS';
    }
  } else {
    suggestedStabilityPhase = '8_HOURS';
  }

  return {
    episodeReports: currentEp,
    hasStartedRepair,
    militaryCount,
    suggestedMilitaryRound,
    lastMilitaryReport,
    lastMilitaryStatus,
    hasPassedMilitary,
    hasPassedStability4h,
    suggestedStage,
    allowedStabilityPhases,
    suggestedStabilityPhase,
    lastPalletLocation,
    lastFollowUp,
    hasPendingMilitary: lastMilitaryStatus === 'PENDING',
    hasPendingStability: lastCycleStabilityReport?.stabilityStatus === 'PENDING',
    lastReport: latestReport,
    hasActiveEpisode: currentEp.length > 0,
  };
}

export function formatStabilityPhaseLabel(phase?: StabilityPhase): string {
  if (phase === '4_HOURS') return '4 Jam';
  if (phase === '4_AND_8_HOURS') return '4 & 8 Jam';
  return '8 Jam';
}

export function toggleOverhaulStabilityPhase(
  current: StabilityPhase,
  clicked: '4_HOURS' | '8_HOURS'
): StabilityPhase {
  const has4h = current === '4_HOURS' || current === '4_AND_8_HOURS';
  const has8h = current === '8_HOURS' || current === '4_AND_8_HOURS';

  if (clicked === '4_HOURS') {
    if (has4h && has8h) return '8_HOURS';
    if (!has4h && has8h) return '4_AND_8_HOURS';
    return '4_HOURS';
  }

  if (has4h && has8h) return '4_HOURS';
  if (has4h && !has8h) return '4_AND_8_HOURS';
  return '8_HOURS';
}

export function buildMilitaryAutoInfo(
  round: number,
  status: MilitaryStatus,
  line: string
): string {
  if (status === 'OK') {
    return `Ambil Military Ke-${round}: Nihil 0% (OK).`;
  }
  if (status === 'LEAK') {
    const cleaned = line.trim();
    return cleaned
      ? `Ambil Military Ke-${round}: Gagal, bocor ${cleaned}`
      : `Ambil Military Ke-${round}: Gagal, bocor`;
  }
  return `Ambil Military Ke-${round}: Palet siap, belum diuji.`;
}

export function buildStabilityAutoInfo(
  phase: StabilityPhase,
  status: StabilityStatus,
  line: string
): string {
  const label = formatStabilityPhaseLabel(phase);
  if (status === 'OK') {
    return `Uji Stability ${label}: Nihil 0% (OK).`;
  }
  if (status === 'LEAK') {
    const cleaned = line.trim();
    return cleaned
      ? `Uji Stability ${label}: Gagal, bocor ${cleaned}`
      : `Uji Stability ${label}: Gagal, bocor`;
  }
  return `Uji Stability ${label}: Palet siap, belum diuji.`;
}

export function formatReportInformationDisplay(info: string): string {
  const trimmed = info.trim();
  if (!trimmed) return info;
  if (
    trimmed.startsWith('Ambil Military Ke-') ||
    trimmed.startsWith('Uji Stability ')
  ) {
    return info.replace(/: Ada bocor\b/g, ': Gagal, bocor');
  }
  return info;
}

export function isAutoGeneratedStageInfo(info: string): boolean {
  const trimmed = info.trim();
  if (!trimmed) return false;
  return (
    isOhOnlyInformation(trimmed) ||
    trimmed.startsWith('Ambil Military Ke-') ||
    trimmed.startsWith('Uji Stability ')
  );
}

export function formatWorkflowBadge(
  report: Pick<
    HandoverReport,
    | 'activityStage'
    | 'militaryRound'
    | 'militaryStatus'
    | 'militaryLeakBoxes'
    | 'stabilityPhase'
    | 'stabilityStatus'
  >
): {
  badgeLabel: string;
  badgeClass: string;
} | null {
  if (report.activityStage === 'MILITARY') {
    const roundStr = report.militaryRound ? ` #${report.militaryRound}` : '';
    if (report.militaryStatus === 'PENDING') {
      return {
        badgeLabel: `Military${roundStr}: Belum Diuji`,
        badgeClass:
          'bg-slate-100 text-slate-700 border-slate-300 dark:bg-[#1D212A] dark:text-zinc-300 dark:border-zinc-700/80',
      };
    }
    const statusStr =
      report.militaryStatus === 'OK'
        ? 'OK 0%'
        : `Bocor ${report.militaryLeakBoxes ?? 0} Box`;
    return {
      badgeLabel: `Military${roundStr}: ${statusStr}`,
      badgeClass:
        report.militaryStatus === 'OK'
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-300/90 dark:border-emerald-800/50'
          : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/25 dark:text-rose-300/90 dark:border-rose-800/50',
    };
  }
  if (report.activityStage === 'STABILITY') {
    const phaseStr = formatStabilityPhaseLabel(report.stabilityPhase);
    if (report.stabilityStatus === 'PENDING') {
      return {
        badgeLabel: `Stability ${phaseStr}: Belum Diuji`,
        badgeClass:
          'bg-slate-100 text-slate-700 border-slate-300 dark:bg-[#1D212A] dark:text-zinc-300 dark:border-zinc-700/80',
      };
    }
    const statusStr = report.stabilityStatus === 'OK' ? 'OK' : 'Bocor';
    return {
      badgeLabel: `Stability ${phaseStr}: ${statusStr}`,
      badgeClass:
        report.stabilityStatus === 'OK'
          ? 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-900/25 dark:text-dark-accent dark:border-teal-800/50'
          : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/25 dark:text-rose-300/90 dark:border-rose-800/50',
    };
  }
  if (report.activityStage === 'OH') {
    return {
      badgeLabel: 'OH (Belum Perbaikan)',
      badgeClass:
        'bg-slate-100 text-slate-700 border-slate-300 dark:bg-[#1D212A] dark:text-zinc-300 dark:border-zinc-700/80',
    };
  }
  if (report.activityStage === 'REPAIR') {
    return {
      badgeLabel: 'Perbaikan / Setting',
      badgeClass:
        'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/25 dark:text-amber-200/90 dark:border-amber-800/50',
    };
  }
  return null;
}

export interface CaseDurationItem {
  id: string;
  category: CategoryType;
  machineName: string;
  startDate: string;
  startShift: ShiftType;
  endDate: string;
  endShift: ShiftType;
  isCompleted: boolean;
  hasStartedRepair: boolean;
  durationShifts: number;
  totalMilitary: number;
  totalStability: number;
  reportCount: number;
  reportIds: string[];
  countedReportIds: string[];
}

export function computeCaseDurations(
  reports: HandoverReport[],
  now: Date = new Date()
): CaseDurationItem[] {
  const activeSundayShifts = new Set<string>();
  const activeDates = new Set<string>();
  const byCaseGroup = new Map<
    string,
    { category: CategoryType; machineName: string; items: HandoverReport[] }
  >();

  for (const rep of reports) {
    const dayNum = parseUtcDayNumber(rep.reportDate);
    if (dayNum > 0) {
      activeDates.add(rep.reportDate);
      if (utcDayNumberToDateInfo(dayNum).dayOfWeek === 0) {
        activeSundayShifts.add(buildSundayShiftKey(rep.reportDate, rep.shift));
      }
    }

    const rawMachine = rep.machine?.trim() || null;
    const machineKey = rawMachine ? rawMachine.toUpperCase() : '__UMUM__';
    const groupKey = `${rep.category}::${machineKey}`;
    let bucket = byCaseGroup.get(groupKey);
    if (!bucket) {
      bucket = {
        category: rep.category,
        machineName: rawMachine ?? 'Umum / Non-Mesin',
        items: [],
      };
      byCaseGroup.set(groupKey, bucket);
    }
    bucket.items.push(rep);
  }

  const nowDateStr = getOperationalDateString(now);
  const nowStatus = getCurrentShiftStatus(now);
  const isInactiveSlot =
    nowStatus.activeShifts.length === 0 && !(now.getDay() === 6 && now.getHours() >= 21);

  let effectiveNowDateStr = nowDateStr;
  let effectiveNowShift: ShiftType = nowStatus.primaryShift;
  if (isInactiveSlot) {
    // Pada hari Minggu (libur) atau Senin 00:00–05:59 (sebelum Shift 1 Senin dimulai),
    // mundurkan batas waktu berjalan ke Shift 3 hari sebelumnya agar shift hari Sabtu yang
    // sudah lewat tetap dihitung, tanpa menghitung Shift 1 Senin sebelum jam 06:00.
    const prevCal = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    effectiveNowDateStr = getTodayDateString(prevCal);
    effectiveNowShift = 'Shift 3';
  }
  const nowRank = getShiftSlotRank(effectiveNowDateStr, effectiveNowShift);

  const durations: CaseDurationItem[] = [];

  for (const bucket of byCaseGroup.values()) {
    const sorted = [...bucket.items].sort((a, b) => {
      if (a.reportDate !== b.reportDate) {
        return a.reportDate.localeCompare(b.reportDate);
      }
      const shiftDiff = SHIFTS.indexOf(a.shift) - SHIFTS.indexOf(b.shift);
      if (shiftDiff !== 0) return shiftDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const episodes: HandoverReport[][] = [];
    let currentEp: HandoverReport[] = [];
    let completedRank: number | null = null;

    for (const rep of sorted) {
      const repRank = getShiftSlotRank(rep.reportDate, rep.shift);
      if (completedRank !== null && repRank > completedRank) {
        if (currentEp.length > 0) {
          episodes.push(currentEp);
        }
        currentEp = [];
        completedRank = null;
      }

      currentEp.push(rep);
      if (rep.isCompleted) {
        completedRank = completedRank === null ? repRank : Math.max(completedRank, repRank);
      }
    }

    if (currentEp.length > 0) {
      episodes.push(currentEp);
    }

    episodes.forEach((ep, epIdx) => {
      const firstRep = ep[0];
      const lastRep = ep[ep.length - 1];
      const isCompleted = ep.some((r) => Boolean(r.isCompleted));
      const closingRep =
        [...ep].reverse().find((r) => Boolean(r.isCompleted)) ?? lastRep;

      const repairStartIdx = findEpisodeRepairStartIndex(ep);
      const hasStartedRepair = repairStartIdx >= 0;
      const startRep = hasStartedRepair ? ep[repairStartIdx] : firstRep;

      const endDate = isCompleted ? closingRep.reportDate : lastRep.reportDate;
      const endShift = isCompleted ? closingRep.shift : lastRep.shift;

      let durationShifts = 0;
      if (hasStartedRepair) {
        let effectiveEndDate = endDate;
        let effectiveEndShift = endShift;
        if (!isCompleted) {
          const lastRank = getShiftSlotRank(lastRep.reportDate, lastRep.shift);
          if (nowRank > lastRank) {
            effectiveEndDate = effectiveNowDateStr;
            effectiveEndShift = effectiveNowShift;
          }
        }
        durationShifts = calculateShiftSpan(
          startRep.reportDate,
          startRep.shift,
          effectiveEndDate,
          effectiveEndShift,
          activeSundayShifts,
          activeDates
        );
      }

      const countedReportIds = hasStartedRepair
        ? ep.slice(repairStartIdx).map((r) => r.id)
        : [];
      const totalMilitary = ep.reduce(
        (sum, rep) => sum + countMilitaryInReport(rep),
        0
      );
      const totalStability = ep.reduce(
        (sum, rep) => sum + countStabilityInReport(rep),
        0
      );

      durations.push({
        id: `${bucket.category}::${bucket.machineName}::${firstRep.id}::${epIdx}`,
        category: bucket.category,
        machineName: bucket.machineName,
        startDate: startRep.reportDate,
        startShift: startRep.shift,
        endDate,
        endShift,
        isCompleted,
        hasStartedRepair,
        durationShifts,
        totalMilitary,
        totalStability,
        reportCount: ep.length,
        reportIds: ep.map((r) => r.id),
        countedReportIds,
      });
    });
  }

  return durations.sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? 1 : -1;
    }
    if (a.endDate !== b.endDate) {
      return b.endDate.localeCompare(a.endDate);
    }
    const shiftDiff = SHIFTS.indexOf(b.endShift) - SHIFTS.indexOf(a.endShift);
    if (shiftDiff !== 0) return shiftDiff;
    return b.durationShifts - a.durationShifts;
  });
}

export function getEpisodeReportsForReport(
  reports: HandoverReport[],
  targetReport: HandoverReport | null
): HandoverReport[] {
  if (!targetReport) return [];

  const normMachine = (targetReport.machine ?? '').trim().toUpperCase();
  const sorted = reports
    .filter(
      (r) =>
        r.category === targetReport.category &&
        (r.machine ?? '').trim().toUpperCase() === normMachine
    )
    .sort((a, b) => {
      if (a.reportDate !== b.reportDate) {
        return a.reportDate.localeCompare(b.reportDate);
      }
      const shiftDiff = SHIFTS.indexOf(a.shift) - SHIFTS.indexOf(b.shift);
      if (shiftDiff !== 0) return shiftDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  if (sorted.length === 0) return [];

  const episodes: HandoverReport[][] = [];
  let currentEp: HandoverReport[] = [];
  let completedRank: number | null = null;

  for (const rep of sorted) {
    const repRank = getShiftSlotRank(rep.reportDate, rep.shift);
    if (completedRank !== null && repRank > completedRank) {
      if (currentEp.length > 0) {
        episodes.push(currentEp);
      }
      currentEp = [];
      completedRank = null;
    }
    currentEp.push(rep);
    if (rep.isCompleted) {
      completedRank = completedRank === null ? repRank : Math.max(completedRank, repRank);
    }
  }

  if (currentEp.length > 0) {
    episodes.push(currentEp);
  }

  return episodes.find((ep) => ep.some((r) => r.id === targetReport.id)) ?? [targetReport];
}

export function mapAuthErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes('auth/invalid-credential') ||
    lower.includes('auth/wrong-password') ||
    lower.includes('auth/user-not-found') ||
    lower.includes('invalid login credentials')
  ) {
    return 'Email atau kata sandi tidak sesuai. Periksa kembali kredensial Anda.';
  }
  if (lower.includes('auth/email-already-in-use') || lower.includes('user already registered')) {
    return 'Email ini sudah terdaftar. Silakan login atau masuk dengan Google.';
  }
  if (lower.includes('auth/weak-password')) {
    return 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.';
  }
  if (lower.includes('auth/invalid-email')) {
    return 'Format email tidak valid.';
  }
  if (
    lower.includes('auth/popup-closed-by-user') ||
    lower.includes('auth/cancelled-popup-request') ||
    lower.includes('access_denied')
  ) {
    return 'Login dengan Google dibatalkan.';
  }
  if (lower.includes('auth/popup-blocked')) {
    return 'Popup login Google diblokir oleh browser. Izinkan popup untuk situs ini lalu coba lagi.';
  }
  if (lower.includes('auth/operation-not-allowed')) {
    return 'Metode login Email/Password belum diaktifkan di Firebase Console (Authentication → Sign-in method). Gunakan tombol Google atau aktifkan Email/Password terlebih dahulu.';
  }
  if (lower.includes('auth/too-many-requests')) {
    return 'Terlalu banyak percobaan login. Tunggu beberapa saat sebelum mencoba lagi.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Email akun belum diverifikasi. Cek inbox email Anda untuk mengaktifkan akun.';
  }
  if (
    lower.includes('provider is not enabled') ||
    lower.includes('unsupported provider')
  ) {
    return 'Login Google belum diaktifkan. Aktifkan Google Sign-In pada Firebase Console → Authentication → Sign-in method.';
  }
  if (lower.includes('quota exceeded')) {
    return 'Kuota harian Firestore tercapai (free tier). Kuota akan direset keesokan harinya.';
  }
  if (lower.includes('missing or insufficient permissions') || lower.includes('permission-denied')) {
    return 'Akses ditolak oleh Firestore Security Rules. Pastikan email akun terverifikasi dan Anda memiliki izin untuk aksi ini.';
  }
  if (lower.includes('jwt') || lower.includes('expired') || lower.includes('refresh_token')) {
    return 'Sesi login Anda telah berakhir. Silakan login ulang.';
  }
  if (
    lower.includes('auth/network-request-failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('the client is offline') ||
    lower.includes('code=unavailable') ||
    lower.includes('could not reach cloud firestore') ||
    lower.includes('the operation could not be completed')
  ) {
    return 'Gagal terhubung ke server Firebase. Periksa koneksi internet Anda.';
  }
  return message;
}

export function extractOAuthErrorFromUrl(search: string, hash: string): string | null {
  const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);

  const errCode = searchParams.get('error') || hashParams.get('error');
  const errDesc =
    searchParams.get('error_description') || hashParams.get('error_description');

  if (!errCode && !errDesc) {
    return null;
  }

  const combined = `${errCode ?? ''} ${errDesc ?? ''}`.trim();
  if (combined.toLowerCase().includes('access_denied')) {
    return 'Login dengan Google dibatalkan.';
  }
  return mapAuthErrorMessage(errDesc || errCode || 'Gagal autentikasi Google.');
}

