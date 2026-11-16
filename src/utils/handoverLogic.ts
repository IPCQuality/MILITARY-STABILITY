import {
  CATEGORIES,
  OVERHAUL_MACHINES,
  SHIFTS,
  type CategoryType,
  type HandoverFormInput,
  type HandoverReport,
  type HistoryFilters,
  type ShiftType,
  type UserProfile,
} from '../types/handover';

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

// Hari operasional pabrik dimulai pukul 06:00 (Shift 1) sampai pukul 05:59 besok (akhir Shift 3)
export function getOperationalDateString(now: Date = new Date()): string {
  const shifted = new Date(now);
  if (shifted.getHours() < 6) {
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
  }

  if (!input.information || input.information.trim().length === 0) {
    errors.information = 'Hasil / keterangan shift wajib diisi.';
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
  const isPreDawnShift3 = now.getHours() < 6;
  const fullAccess = hasFullShiftAccess(user);

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
      const todayItems = bucket.items.filter(
        (r) =>
          r.reportDate === today ||
          (isPreDawnShift3 && r.reportDate === calendarToday)
      );
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
      // Case dianggap tuntas hanya jika laporan pada shift terakhir sebelumnya sudah dicentang selesai (isCompleted)
      const finishedPrev =
        latestPrev !== null &&
        prevItems.some(
          (r) =>
            r.reportDate === latestPrev.reportDate &&
            r.shift === latestPrev.shift &&
            Boolean(r.isCompleted)
        );

      // Selama belum ditandai selesai, case tetap dibawa ke Dashboard walaupun sudah berganti hari (>1 hari)
      const hasCarryOver = latestPrev !== null && !finishedPrev;

      // Jika tidak ada laporan hari ini DAN tidak ada case yang belum selesai dari hari sebelumnya, hilangkan dari Dashboard
      if (todayItems.length === 0 && !hasCarryOver) {
        continue;
      }

      const todayCompleted = todayItems.some((r) => r.isCompleted);
      const rows: DashboardShiftRow[] = [];

      // 1. Jika masih ada case belum selesai dari hari sebelumnya, tampilkan catatan shift terakhirnya
      if (hasCarryOver && latestPrev) {
        const prevDateObj = parseLocalDateParts(latestPrev.reportDate) ?? yesterdayDate;
        const prevSchedule = getShiftScheduleForDate(prevDateObj);
        rows.push({
          key: `carryover-${latestPrev.id}`,
          shift: latestPrev.shift,
          reportDate: latestPrev.reportDate,
          isCarryOver: true,
          carryOverLabel:
            latestPrev.reportDate === yesterday ? 'Kemarin' : latestPrev.reportDate,
          hours: prevSchedule[latestPrev.shift],
          reports: [latestPrev],
          isRunningShift: false,
          canFill: false,
          isOk: isShiftResultOk([latestPrev]),
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
          : s === activeShift;

        // Tampilkan baris shift jika: (a) ada laporan pada shift itu hari ini,
        // (b) itu adalah shift berjalan saat ini (kecuali case sudah ditandai selesai di shift sebelumnya hari ini),
        // atau (c) shift antara awal case hari ini dan shift berjalan
        if (sReports.length === 0 && todayCompleted && !isRunning) {
          continue;
        }
        if (sReports.length === 0 && todayCompleted && isRunning) {
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

      result[category].push({
        machineName: bucket.displayName,
        rawMachine: bucket.rawMachine,
        isCompleted: todayCompleted,
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
      if (filters.shift !== 'ALL' && item.shift !== filters.shift) {
        return false;
      }
      if (filters.category !== 'ALL' && item.category !== filters.category) {
        return false;
      }
      if (kw) {
        const haystack = [
          item.machine ?? '',
          item.category,
          item.shift,
          item.information,
          item.issue,
          item.followUp,
          item.palletLocation,
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

  // Sabtu: Shift 1 06:00-11:00, Shift 2 11:00-16:00, Shift 3 16:00-21:00
  if (day === 6) {
    let activeShifts: ShiftType[] = [];
    let primaryShift: ShiftType = 'Shift 1';
    let statusText = 'Di luar jam shift Sabtu (21:00 - 06:00)';

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

  // Minggu: cek sisa Shift 3 (00:00 - 06:00) atau di luar jam reguler
  if (day === 0) {
    if (minutes < 360) {
      return {
        dayTypeLabel: 'Minggu (Dini Hari)',
        dateFormatted,
        currentTimeFormatted,
        activeShifts: ['Shift 3'],
        primaryShift: 'Shift 3',
        schedule: WEEKDAY_SHIFT_HOURS,
        statusText: `Shift 3 (${WEEKDAY_SHIFT_HOURS['Shift 3']})`,
      };
    }
    return {
      dayTypeLabel: 'Minggu',
      dateFormatted,
      currentTimeFormatted,
      activeShifts: [],
      primaryShift: 'Shift 1',
      schedule: WEEKDAY_SHIFT_HOURS,
      statusText: 'Hari Minggu (Di luar jam shift reguler)',
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
  activeSundayShifts?: Set<string>
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
    } else {
      count += 1;
    }
  }

  return Math.max(1, count);
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
  durationShifts: number;
  reportCount: number;
  reportIds: string[];
}

export function computeCaseDurations(
  reports: HandoverReport[],
  now: Date = new Date()
): CaseDurationItem[] {
  const activeSundayShifts = new Set<string>();
  const byCaseGroup = new Map<
    string,
    { category: CategoryType; machineName: string; items: HandoverReport[] }
  >();

  for (const rep of reports) {
    const dayNum = parseUtcDayNumber(rep.reportDate);
    if (dayNum > 0 && utcDayNumberToDateInfo(dayNum).dayOfWeek === 0) {
      activeSundayShifts.add(buildSundayShiftKey(rep.reportDate, rep.shift));
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
  const nowShift = getCurrentShiftStatus(now).primaryShift;
  const nowRank = getShiftSlotRank(nowDateStr, nowShift);

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
      const startRep = ep[0];
      const lastRep = ep[ep.length - 1];
      const isCompleted = ep.some((r) => Boolean(r.isCompleted));
      const closingRep =
        [...ep].reverse().find((r) => Boolean(r.isCompleted)) ?? lastRep;

      const endDate = isCompleted ? closingRep.reportDate : lastRep.reportDate;
      const endShift = isCompleted ? closingRep.shift : lastRep.shift;

      let effectiveEndDate = endDate;
      let effectiveEndShift = endShift;
      if (!isCompleted) {
        const lastRank = getShiftSlotRank(lastRep.reportDate, lastRep.shift);
        if (nowRank > lastRank) {
          effectiveEndDate = nowDateStr;
          effectiveEndShift = nowShift;
        }
      }

      durations.push({
        id: `${bucket.category}::${bucket.machineName}::${startRep.id}::${epIdx}`,
        category: bucket.category,
        machineName: bucket.machineName,
        startDate: startRep.reportDate,
        startShift: startRep.shift,
        endDate,
        endShift,
        isCompleted,
        durationShifts: calculateShiftSpan(
          startRep.reportDate,
          startRep.shift,
          effectiveEndDate,
          effectiveEndShift,
          activeSundayShifts
        ),
        reportCount: ep.length,
        reportIds: ep.map((r) => r.id),
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
    lower.includes('the client is offline')
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

