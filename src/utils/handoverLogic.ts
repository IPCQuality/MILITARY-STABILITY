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

export function getTodayDateString(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Hari operasional pabrik dimulai pukul 06:00 (Shift 1) sampai pukul 05:59 besok (akhir Shift 3)
export function getOperationalDateString(now: Date = new Date()): string {
  const shifted = new Date(now);
  if (shifted.getHours() < 6) {
    shifted.setDate(shifted.getDate() - 1);
  }
  return getTodayDateString(shifted);
}

export function categoryRequiresMachine(category: CategoryType): boolean {
  return category === 'OVERHAUL';
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
    errors.machine = 'Kode/nama mesin wajib diisi untuk kategori OVERHAUL.';
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
  now: Date = new Date()
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
  const yesterdaySchedule = getShiftScheduleForDate(yesterdayDate);
  const isPreDawnShift3 = now.getHours() < 6;

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
      // Case dianggap tuntas untuk hari sebelumnya hanya jika sudah dicentang selesai (isCompleted)
      const finishedPrev =
        latestPrev !== null &&
        (Boolean(latestPrev.isCompleted) ||
          prevItems.some((r) => r.reportDate === yesterday && Boolean(r.isCompleted)));

      // Case berkelanjutan hanya jika catatan kemarin belum dicentang selesai
      const hasCarryOver =
        latestPrev !== null &&
        !finishedPrev &&
        latestPrev.reportDate === yesterday;

      // Jika tidak ada laporan hari ini DAN tidak ada case berkelanjutan dari kemarin, hilangkan dari Dashboard hari ini
      if (todayItems.length === 0 && !hasCarryOver) {
        continue;
      }

      const todayCompleted = todayItems.some((r) => r.isCompleted);
      const rows: DashboardShiftRow[] = [];

      // 1. Jika berkelanjutan dari kemarin, tampilkan catatan shift terakhir kemarin (biasanya Shift 3)
      if (hasCarryOver && latestPrev) {
        rows.push({
          key: `carryover-${latestPrev.id}`,
          shift: latestPrev.shift,
          reportDate: latestPrev.reportDate,
          isCarryOver: true,
          carryOverLabel: 'Kemarin',
          hours: yesterdaySchedule[latestPrev.shift],
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

        rows.push({
          key: `today-${s}`,
          shift: s,
          reportDate: today,
          isCarryOver: false,
          hours: liveStatus.schedule[s],
          reports: sReports,
          isRunningShift: isRunning,
          canFill: isRunning && !todayCompleted,
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

export function canEditReport(
  report: HandoverReport,
  user: UserProfile | null
): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'supervisor' || user.canEditAll) {
    return true;
  }
  return report.createdBy === user.id;
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
