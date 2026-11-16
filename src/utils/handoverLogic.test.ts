import test from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx-js-style';
import {
  calculateShiftSpan,
  canEditReport,
  canSubmitReport,
  categoryRequiresMachine,
  computeCaseDurations,
  computeDashboardSummary,
  computeOverhaulMatrix,
  countMilitaryInReport,
  countStabilityInReport,
  extractOAuthErrorFromUrl,
  filterAndSortReports,
  getCurrentShiftStatus,
  getOpenOperatorShiftSlots,
  getOperationalDateString,
  groupActiveDashboardCases,
  hasFullShiftAccess,
  hasOpenEpisodeStartedRepair,
  isOhOnlyInformation,
  isOperatorShiftInputAllowed,
  isReportResultOk,
  isShiftResultOk,
  mapAuthErrorMessage,
  validateHandoverInput,
} from './handoverLogic';
import { buildHandoverFilename, buildHandoverWorkbook } from './excelExport';
import { normalizeUserRole } from '../services/handoverService';
import type { HandoverReport, UserProfile } from '../types/handover';

const sampleReports: HandoverReport[] = [
  {
    id: 'rep-1',
    reportDate: '2026-11-12',
    shift: 'Shift 1',
    category: 'OVERHAUL',
    machine: 'AST 9-16L',
    information: 'sudah press 10T',
    issue: '',
    followUp: 'lanjut military shift 2',
    palletLocation: 'Zona A - Rak 02',
    isCompleted: false,
    createdBy: 'user-shift-1',
    createdByName: 'Budi Santoso',
    updatedBy: 'user-shift-1',
    updatedByName: 'Budi Santoso',
    createdAt: '2026-11-12T07:30:00.000Z',
    updatedAt: '2026-11-12T07:45:00.000Z',
  },
  {
    id: 'rep-2',
    reportDate: '2026-11-12',
    shift: 'Shift 2',
    category: 'STABILITY TINGGI',
    machine: 'AST 67-16L',
    information: 'Uji kestabilan chamber suhu 40C/75%RH berjalan stabil.',
    issue: 'Tidak ada deviasi.',
    followUp: 'Catat log pembacaan tiap 2 jam.',
    palletLocation: 'Zona C - Palet 14',
    isCompleted: false,
    createdBy: 'user-shift-2',
    createdByName: 'Rina Wijaya',
    updatedBy: 'user-shift-2',
    updatedByName: 'Rina Wijaya',
    createdAt: '2026-11-12T15:10:00.000Z',
    updatedAt: '2026-11-12T15:20:00.000Z',
  },
  {
    id: 'rep-3',
    reportDate: '2026-11-11',
    shift: 'Shift 3',
    category: 'CASE PERBAIKAN PART',
    machine: 'AST 14-12L',
    information: 'Penggantian seal solenoid valve line B.',
    issue: 'Kebocoran minor pada fitting output.',
    followUp: 'Cek tekanan kerja saat start awal Shift 1.',
    palletLocation: 'Staging B2',
    isCompleted: false,
    createdBy: 'user-shift-3',
    createdByName: 'Andi Pratama',
    updatedBy: 'user-shift-3',
    updatedByName: 'Andi Pratama',
    createdAt: '2026-11-11T23:00:00.000Z',
    updatedAt: '2026-11-11T23:15:00.000Z',
  },
];

test('categoryRequiresMachine mewajibkan pemilihan mesin untuk seluruh kategori', () => {
  assert.equal(categoryRequiresMachine('OVERHAUL'), true);
  assert.equal(categoryRequiresMachine('STABILITY TINGGI'), true);
  assert.equal(categoryRequiresMachine('CASE PERBAIKAN PART'), true);
  assert.equal(categoryRequiresMachine('COMMISSIONING / TRIAL / CHANGE OVER'), true);
});

test('validateHandoverInput mewajibkan mesin pada semua kategori termasuk STABILITY TINGGI dan menerima lokasi palet', () => {
  const missingOverhaulMachine = validateHandoverInput({
    reportDate: '2026-11-12',
    shift: 'Shift 1',
    category: 'OVERHAUL',
    machine: '',
    information: 'Kalibrasi sensor',
    issue: '',
    followUp: '',
    palletLocation: '',
  });
  assert.equal(missingOverhaulMachine.valid, false);
  assert.ok(missingOverhaulMachine.errors.machine);

  const missingStabilityMachine = validateHandoverInput({
    reportDate: '2026-11-12',
    shift: 'Shift 2',
    category: 'STABILITY TINGGI',
    machine: '   ',
    information: 'Monitoring kestabilan batch.',
    issue: '',
    followUp: '',
    palletLocation: 'Rak A3',
  });
  assert.equal(missingStabilityMachine.valid, false);
  assert.equal(missingStabilityMachine.errors.machine, 'Mesin wajib dipilih.');

  const stabilityWithMachine = validateHandoverInput({
    reportDate: '2026-11-12',
    shift: 'Shift 2',
    category: 'STABILITY TINGGI',
    machine: 'AST 67-16L',
    information: 'Monitoring kestabilan batch.',
    issue: '',
    followUp: '',
    palletLocation: 'Zona C - Palet 14',
  });
  assert.equal(stabilityWithMachine.valid, true);
  assert.equal(stabilityWithMachine.sanitizedMachine, 'AST 67-16L');
});

test('computeDashboardSummary dan computeOverhaulMatrix menghitung statistik harian dengan benar', () => {
  const summary = computeDashboardSummary(sampleReports, '2026-11-12');
  assert.equal(summary.totalToday, 2);
  assert.equal(summary.byCategory.OVERHAUL, 1);
  assert.equal(summary.byCategory['STABILITY TINGGI'], 1);
  assert.equal(summary.byShiftToday['Shift 1'], 1);
  assert.equal(summary.byShiftToday['Shift 2'], 1);
  assert.equal(summary.byShiftToday['Shift 3'], 0);

  const matrix = computeOverhaulMatrix(sampleReports, '2026-11-12');
  assert.equal(matrix['AST 9-16L']['Shift 1'].length, 1);
  assert.equal(matrix['AST 25-12L']['Shift 1'].length, 0);
});

test('groupActiveDashboardCases hanya memunculkan shift berjalan, carry-over Shift 3 kemarin, dan maksimal 4 baris', () => {
  const reports: HandoverReport[] = [
    {
      ...sampleReports[2],
      id: 'prev-s3',
      reportDate: '2026-11-12',
      shift: 'Shift 3',
      category: 'OVERHAUL',
      machine: 'AST 9-16L',
      information: 'persiapan rangka selesai',
      followUp: 'lanjut press shift 1',
      palletLocation: 'Line Press 02',
      isCompleted: false,
    },
    {
      ...sampleReports[0],
      id: 'today-s1-new',
      reportDate: '2026-11-13',
      shift: 'Shift 1',
      category: 'STABILITY TINGGI',
      machine: 'AST 67-16L',
      information: 'mulai stability',
      palletLocation: 'Chamber 4',
      isCompleted: false,
    },
    {
      ...sampleReports[1],
      id: 'prev-done',
      reportDate: '2026-11-12',
      shift: 'Shift 3',
      category: 'COMMISSIONING / TRIAL / CHANGE OVER',
      machine: 'AST 50-16L',
      isCompleted: true,
    },
  ];

  const atShift1 = groupActiveDashboardCases(reports, new Date(2026, 10, 13, 8, 0));
  assert.equal(atShift1['OVERHAUL'][0].rows.length, 2);
  assert.equal(atShift1['OVERHAUL'][0].rows[0].isCarryOver, true);
  assert.equal(atShift1['OVERHAUL'][0].rows[0].shift, 'Shift 3');
  assert.equal(atShift1['OVERHAUL'][0].rows[1].shift, 'Shift 1');
  assert.equal(atShift1['OVERHAUL'][0].rows[1].canFill, true);
  assert.equal(atShift1['STABILITY TINGGI'][0].rows.length, 1);
  assert.equal(atShift1['COMMISSIONING / TRIAL / CHANGE OVER'].length, 0);

  const atShift2 = groupActiveDashboardCases(reports, new Date(2026, 10, 13, 15, 0));
  assert.equal(atShift2['OVERHAUL'][0].rows.length, 3);
  assert.equal(atShift2['OVERHAUL'][0].rows[2].shift, 'Shift 2');
  assert.equal(atShift2['OVERHAUL'][0].rows[2].canFill, true);
  assert.equal(atShift2['STABILITY TINGGI'][0].rows.length, 2);

  const atShift3 = groupActiveDashboardCases(reports, new Date(2026, 10, 13, 22, 30));
  assert.equal(atShift3['OVERHAUL'][0].rows.length, 4);
  assert.equal(atShift3['OVERHAUL'][0].rows[3].shift, 'Shift 3');
  assert.equal(atShift3['OVERHAUL'][0].rows[3].canFill, true);
});

test('filterAndSortReports menyaring berdasarkan tanggal, shift, kategori, keyword, dan lokasi palet serta mengurutkan terbaru', () => {
  const filtered = filterAndSortReports(sampleReports, {
    date: '',
    shift: 'ALL',
    category: 'ALL',
    keyword: 'press',
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'rep-1');

  const byPallet = filterAndSortReports(sampleReports, {
    date: '',
    shift: 'ALL',
    category: 'ALL',
    keyword: 'Palet 14',
  });
  assert.equal(byPallet.length, 1);
  assert.equal(byPallet[0].id, 'rep-2');

  const allSorted = filterAndSortReports(sampleReports, {
    date: '',
    shift: 'ALL',
    category: 'ALL',
    keyword: '',
  });
  assert.deepEqual(
    allSorted.map((r) => r.id),
    ['rep-2', 'rep-1', 'rep-3']
  );
});

test('canEditReport menerapkan otorisasi pembuat vs supervisor', () => {
  const shift1User: UserProfile = {
    id: 'user-shift-1',
    email: 'shift1@plant.id',
    fullName: 'Budi Santoso',
    role: 'pengawas',
    canEditAll: false,
  };
  const supervisor: UserProfile = {
    id: 'user-sup',
    email: 'sup@plant.id',
    fullName: 'Hendra',
    role: 'supervisor',
    canEditAll: true,
  };

  assert.equal(canEditReport(sampleReports[0], shift1User), true);
  assert.equal(canEditReport(sampleReports[1], shift1User), false);
  assert.equal(canEditReport(sampleReports[1], supervisor), true);
  assert.equal(normalizeUserRole('operator'), 'pengawas');
  assert.equal(normalizeUserRole('pengawas'), 'pengawas');
  assert.equal(normalizeUserRole('supervisor'), 'supervisor');
  assert.equal(normalizeUserRole('admin'), 'admin');
});

test('buildHandoverWorkbook menghasilkan 1 worksheet DETAIL DATA modern berwarna lengkap dengan Total Durasi', () => {
  const reportsForExport: HandoverReport[] = [
    ...sampleReports,
    {
      ...sampleReports[0],
      id: 'rep-4',
      reportDate: '2026-11-12',
      shift: 'Shift 3',
      category: 'COMMISSIONING / TRIAL / CHANGE OVER',
      machine: 'AST 50-16L',
      information: 'Trial berjalan sesuai target',
      palletLocation: 'Staging Area D',
      isCompleted: true,
    },
  ];

  const wb = buildHandoverWorkbook(reportsForExport);
  assert.deepEqual(wb.SheetNames, ['DETAIL DATA']);

  const detailSheet = wb.Sheets['DETAIL DATA'];
  const detailJson = XLSX.utils.sheet_to_json<(string | number)[]>(detailSheet, { header: 1 });
  assert.equal(detailJson[0][0], 'DETAIL DATA SHIFT HANDOVER — MILITARY & STABILITY');
  assert.deepEqual(detailJson[3], [
    'ID',
    'Tanggal',
    'Shift',
    'Kategori',
    'Mesin',
    'Update Shift / Informasi / Keterangan',
    'Masalah',
    'Tindak Lanjut',
    'Lokasi Palet',
    'Status',
    'Total Durasi',
    'Total Military',
    'Total Stability',
    'Pembuat',
    'Waktu Dibuat',
    'Waktu Diperbarui',
  ]);
  // 4 baris banner/spacer/header + 4 data + 1 baris TOTAL KESELURUHAN = 9 baris total
  assert.equal(detailJson.length, 9);
  assert.equal(detailSheet['!autofilter']?.ref, 'A4:P8');
  assert.ok(Array.isArray(detailSheet['!merges']) && detailSheet['!merges'].length === 2);
  assert.ok(Array.isArray(detailSheet['!cols']) && detailSheet['!cols'].length === 16);

  // Verifikasi cell styling & nilai (banner navy A1, header A4, status badge, total durasi, total military & stability)
  assert.equal(detailSheet['A1'].s?.fill?.fgColor?.rgb, '0F294A');
  assert.equal(detailSheet['A4'].s?.fill?.fgColor?.rgb, '1E3A5F');
  assert.equal(detailSheet['A4'].s?.font?.bold, true);
  assert.equal(detailSheet['J8'].v, 'OK (Selesai)');
  assert.equal(detailSheet['J8'].s?.fill?.fgColor?.rgb, 'BBF7D0');
  assert.equal(detailSheet['K8'].v, '1 Shift');
  assert.equal(detailSheet['K8'].s?.fill?.fgColor?.rgb, 'DCFCE7');
  assert.equal(detailSheet['M6'].v, 1); // rep-2 kategori STABILITY TINGGI
  assert.equal(detailJson[8][4], 'TOTAL KESELURUHAN');
  assert.equal(detailJson[8][11], 0);
  assert.equal(detailJson[8][12], 1);

  assert.equal(buildHandoverFilename('2026-11-13'), 'HANDOVER_2026-11-13.xlsx');

  // Pastikan xlsx-js-style bisa menulis dan membaca ulang buffer XLSX valid
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  assert.ok(buffer.byteLength > 2000);
  const reparsed = XLSX.read(buffer, { type: 'buffer' });
  assert.deepEqual(reparsed.SheetNames, ['DETAIL DATA']);
});

test('getCurrentShiftStatus mendeteksi jadwal Senin-Jumat (Shift 2 14:00-22:00) dan Sabtu dengan akurat', () => {
  const thuNoon = getCurrentShiftStatus(new Date(2026, 10, 12, 12, 45));
  assert.deepEqual(thuNoon.activeShifts, ['Shift 1']);
  assert.equal(thuNoon.schedule['Shift 2'], '14:00 - 22:00');

  const thuAfternoon = getCurrentShiftStatus(new Date(2026, 10, 12, 14, 15));
  assert.deepEqual(thuAfternoon.activeShifts, ['Shift 2']);

  const thuNight = getCurrentShiftStatus(new Date(2026, 10, 12, 23, 15));
  assert.deepEqual(thuNight.activeShifts, ['Shift 3']);

  const satMid = getCurrentShiftStatus(new Date(2026, 10, 14, 11, 30));
  assert.deepEqual(satMid.activeShifts, ['Shift 2']);
  assert.equal(satMid.schedule['Shift 1'], '06:00 - 11:00');
  assert.equal(satMid.schedule['Shift 3'], '16:00 - 21:00');
});

test('isReportResultOk dan isShiftResultOk hanya bernilai true jika isCompleted dicentang, bukan dari teks saja', () => {
  assert.equal(isReportResultOk({ isCompleted: false }), false);
  assert.equal(isReportResultOk({ isCompleted: true }), true);

  assert.equal(isShiftResultOk([]), false);
  assert.equal(isShiftResultOk([{ isCompleted: false }]), false);
  assert.equal(
    isShiftResultOk([{ isCompleted: false }, { isCompleted: true }]),
    true
  );
});

test('mesin yang dicentang selesai (OK) di Shift 3 tanggal 13 Nov tetap tampil s/d jam 05:59 dan hilang saat 14 Nov jam 06:00 Shift 1, sedangkan yang belum dicentang tetap lanjut', () => {
  const shift3CheckedOk: HandoverReport = {
    ...sampleReports[0],
    id: 'nov13-s3-checked-ok',
    reportDate: '2026-11-13',
    shift: 'Shift 3',
    category: 'STABILITY TINGGI',
    machine: 'AST 67-16L',
    information: 'uji stability selesai',
    followUp: 'siap produksi',
    isCompleted: true,
  };

  const shift3UncheckedTextOk: HandoverReport = {
    ...sampleReports[0],
    id: 'nov13-s3-text-only',
    reportDate: '2026-11-13',
    shift: 'Shift 3',
    category: 'OVERHAUL',
    machine: 'AST 9-16L',
    information: 'hasil press OK tapi belum selesai total',
    followUp: 'lanjut military shift 1',
    isCompleted: false,
  };

  assert.equal(getOperationalDateString(new Date(2026, 10, 14, 4, 0)), '2026-11-13');
  const preDawn = groupActiveDashboardCases(
    [shift3CheckedOk, shift3UncheckedTextOk],
    new Date(2026, 10, 14, 4, 0)
  );
  assert.equal(preDawn['STABILITY TINGGI'].length, 1);
  assert.equal(preDawn['STABILITY TINGGI'][0].rows.at(-1)?.isOk, true);
  assert.equal(preDawn['OVERHAUL'].length, 1);
  assert.equal(preDawn['OVERHAUL'][0].rows.at(-1)?.isOk, false);

  assert.equal(getOperationalDateString(new Date(2026, 10, 14, 6, 0)), '2026-11-14');
  const nextMorning = groupActiveDashboardCases(
    [shift3CheckedOk, shift3UncheckedTextOk],
    new Date(2026, 10, 14, 6, 0)
  );
  assert.equal(nextMorning['STABILITY TINGGI'].length, 0);
  assert.equal(nextMorning['OVERHAUL'].length, 1);

  const inHistory = filterAndSortReports([shift3CheckedOk], {
    date: '2026-11-13',
    shift: 'ALL',
    category: 'ALL',
    keyword: 'AST 67-16L',
  });
  assert.equal(inHistory.length, 1);

  const wb = buildHandoverWorkbook([shift3CheckedOk]);
  const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['DETAIL DATA'], { header: 1 });
  // 4 baris header/banner + 1 baris data + 1 baris TOTAL KESELURUHAN
  assert.equal(rows.length, 6);
});

test('Admin dan Supervisor punya akses full (pilih shift & tanggal input bebas, edit bebas)', () => {
  const admin: UserProfile = {
    id: 'admin-1',
    email: 'suryadi.k94@gmail.com',
    fullName: 'Suryadi (Admin)',
    role: 'admin',
    canEditAll: true,
  };
  const supervisor: UserProfile = {
    id: 'sup-1',
    email: 'sup@plant.id',
    fullName: 'Hendra',
    role: 'supervisor',
    canEditAll: true,
  };

  assert.equal(hasFullShiftAccess(admin), true);
  assert.equal(hasFullShiftAccess(supervisor), true);

  const lateTime = new Date(2026, 10, 13, 23, 30);
  assert.equal(
    canSubmitReport({
      user: admin,
      input: { reportDate: '2026-11-01', shift: 'Shift 1' },
      now: lateTime,
    }).allowed,
    true
  );
  assert.equal(
    canSubmitReport({
      user: supervisor,
      input: { reportDate: '2026-11-13', shift: 'Shift 1' },
      now: lateTime,
    }).allowed,
    true
  );

  assert.equal(
    canSubmitReport({
      user: supervisor,
      input: { reportDate: '2026-11-10', shift: 'Shift 2' },
      editingReport: sampleReports[0],
      now: lateTime,
    }).allowed,
    true
  );
});

test('Pengawas dibatasi batas input +4 jam untuk Shift 1, 2, 3 (weekday & Sabtu), namun bisa edit laporan sendiri kapan pun', () => {
  const op1: UserProfile = {
    id: 'user-shift-1',
    email: 'op1@plant.id',
    fullName: 'Budi Santoso',
    role: 'pengawas',
    canEditAll: false,
  };
  const op2: UserProfile = {
    id: 'user-shift-2',
    email: 'op2@plant.id',
    fullName: 'Rina Wijaya',
    role: 'pengawas',
    canEditAll: false,
  };

  assert.equal(
    isOperatorShiftInputAllowed('2026-11-13', 'Shift 1', new Date(2026, 10, 13, 18, 0, 0)),
    true
  );
  assert.equal(
    isOperatorShiftInputAllowed('2026-11-13', 'Shift 1', new Date(2026, 10, 13, 18, 1, 0)),
    false
  );

  assert.equal(
    isOperatorShiftInputAllowed('2026-11-13', 'Shift 2', new Date(2026, 10, 14, 2, 0, 0)),
    true
  );
  assert.equal(
    isOperatorShiftInputAllowed('2026-11-13', 'Shift 2', new Date(2026, 10, 14, 2, 1, 0)),
    false
  );

  assert.equal(
    isOperatorShiftInputAllowed('2026-11-13', 'Shift 3', new Date(2026, 10, 14, 10, 0, 0)),
    true
  );
  assert.equal(
    isOperatorShiftInputAllowed('2026-11-13', 'Shift 3', new Date(2026, 10, 14, 10, 1, 0)),
    false
  );

  assert.equal(
    isOperatorShiftInputAllowed('2026-11-14', 'Shift 1', new Date(2026, 10, 14, 15, 0, 0)),
    true
  );
  assert.equal(
    isOperatorShiftInputAllowed('2026-11-14', 'Shift 1', new Date(2026, 10, 14, 15, 1, 0)),
    false
  );
  assert.equal(
    isOperatorShiftInputAllowed('2026-11-14', 'Shift 3', new Date(2026, 10, 15, 1, 0, 0)),
    true
  );
  assert.equal(
    isOperatorShiftInputAllowed('2026-11-14', 'Shift 3', new Date(2026, 10, 15, 1, 1, 0)),
    false
  );

  const morningSlots = getOpenOperatorShiftSlots(new Date(2026, 10, 14, 8, 30, 0));
  assert.deepEqual(
    morningSlots.map((s) => `${s.reportDate}:${s.shift}:${s.isGracePeriod}`),
    ['2026-11-13:Shift 3:true', '2026-11-14:Shift 1:false']
  );

  const lateNew = canSubmitReport({
    user: op1,
    input: { reportDate: '2026-11-13', shift: 'Shift 1' },
    now: new Date(2026, 10, 13, 18, 5, 0),
  });
  assert.equal(lateNew.allowed, false);

  const lateOwnEdit = canSubmitReport({
    user: op1,
    input: { reportDate: sampleReports[0].reportDate, shift: sampleReports[0].shift },
    editingReport: sampleReports[0],
    now: new Date(2026, 10, 22, 12, 0, 0),
  });
  assert.equal(lateOwnEdit.allowed, true);

  const otherEdit = canSubmitReport({
    user: op2,
    input: { reportDate: sampleReports[0].reportDate, shift: sampleReports[0].shift },
    editingReport: sampleReports[0],
    now: new Date(2026, 10, 22, 12, 0, 0),
  });
  assert.equal(otherEdit.allowed, false);
});

test('case yang belum ditandai selesai tetap tampil di Dashboard walaupun sudah berganti banyak hari hingga ditandai selesai', () => {
  const oldUnfinishedCase: HandoverReport = {
    ...sampleReports[0],
    id: 'multi-day-open',
    reportDate: '2026-11-08',
    shift: 'Shift 2',
    category: 'CASE PERBAIKAN PART',
    machine: 'AST 14-12L',
    information: 'menunggu part valve pengganti',
    followUp: 'pasang part bila sudah datang',
    isCompleted: false,
  };

  const fiveDaysLater = groupActiveDashboardCases(
    [oldUnfinishedCase],
    new Date(2026, 10, 13, 9, 0)
  );
  assert.equal(fiveDaysLater['CASE PERBAIKAN PART'].length, 1);
  assert.equal(fiveDaysLater['CASE PERBAIKAN PART'][0].machineName, 'AST 14-12L');
  assert.equal(fiveDaysLater['CASE PERBAIKAN PART'][0].rows[0].isCarryOver, true);
  assert.equal(fiveDaysLater['CASE PERBAIKAN PART'][0].rows[0].carryOverLabel, '2026-11-08');

  const completedToday: HandoverReport = {
    ...oldUnfinishedCase,
    id: 'multi-day-closed',
    reportDate: '2026-11-13',
    shift: 'Shift 1',
    information: 'valve baru terpasang & normal',
    isCompleted: true,
  };

  const day13 = groupActiveDashboardCases(
    [oldUnfinishedCase, completedToday],
    new Date(2026, 10, 13, 10, 0)
  );
  assert.equal(day13['CASE PERBAIKAN PART'].length, 1);
  assert.equal(day13['CASE PERBAIKAN PART'][0].isCompleted, true);

  const day14 = groupActiveDashboardCases(
    [oldUnfinishedCase, completedToday],
    new Date(2026, 10, 14, 6, 0)
  );
  assert.equal(day14['CASE PERBAIKAN PART'].length, 0);
});

test('calculateShiftSpan dan computeCaseDurations menghitung total durasi per case dalam satuan Shift dengan akurat', () => {
  assert.equal(calculateShiftSpan('2026-11-12', 'Shift 1', '2026-11-12', 'Shift 1'), 1);
  assert.equal(calculateShiftSpan('2026-11-12', 'Shift 1', '2026-11-12', 'Shift 3'), 3);
  assert.equal(calculateShiftSpan('2026-11-12', 'Shift 3', '2026-11-13', 'Shift 1'), 2);
  assert.equal(calculateShiftSpan('2026-11-12', 'Shift 1', '2026-11-13', 'Shift 2'), 5);

  const durationReports: HandoverReport[] = [
    // Episode 1 AST 9-16L (OVERHAUL): 11 Nov Shift 3 -> 12 Nov Shift 2 (selesai) = 3 Shift
    {
      ...sampleReports[0],
      id: 'd-ep1-1',
      reportDate: '2026-11-11',
      shift: 'Shift 3',
      category: 'OVERHAUL',
      machine: 'AST 9-16L',
      isCompleted: false,
    },
    {
      ...sampleReports[0],
      id: 'd-ep1-2',
      reportDate: '2026-11-12',
      shift: 'Shift 2',
      category: 'OVERHAUL',
      machine: 'AST 9-16L',
      isCompleted: true,
    },
    // Episode 2 AST 9-16L (OVERHAUL baru): dimulai 13 Nov Shift 1 -> masih berjalan pada 13 Nov Shift 3 = 3 Shift
    {
      ...sampleReports[0],
      id: 'd-ep2-1',
      reportDate: '2026-11-13',
      shift: 'Shift 1',
      category: 'OVERHAUL',
      machine: 'AST 9-16L',
      isCompleted: false,
    },
    // Case selesai di 1 shift yang sama (AST 67-16L) = 1 Shift
    {
      ...sampleReports[1],
      id: 'd-single',
      reportDate: '2026-11-12',
      shift: 'Shift 1',
      category: 'STABILITY TINGGI',
      machine: 'AST 67-16L',
      isCompleted: true,
    },
  ];

  const nowAtShift3 = new Date(2026, 10, 13, 22, 30);
  const durations = computeCaseDurations(durationReports, nowAtShift3);
  assert.equal(durations.length, 3);

  // Case berjalan muncul paling atas
  assert.equal(durations[0].machineName, 'AST 9-16L');
  assert.equal(durations[0].isCompleted, false);
  assert.equal(durations[0].startDate, '2026-11-13');
  assert.equal(durations[0].startShift, 'Shift 1');
  assert.equal(durations[0].durationShifts, 3);
  assert.equal(durations[0].reportCount, 1);

  const ep1 = durations.find((d) => d.startDate === '2026-11-11');
  assert.ok(ep1);
  assert.equal(ep1.isCompleted, true);
  assert.equal(ep1.endDate, '2026-11-12');
  assert.equal(ep1.endShift, 'Shift 2');
  assert.equal(ep1.durationShifts, 3);
  assert.equal(ep1.reportCount, 2);

  const single = durations.find((d) => d.machineName === 'AST 67-16L');
  assert.ok(single);
  assert.equal(single.isCompleted, true);
  assert.equal(single.durationShifts, 1);
});

test('hari Minggu tidak dihitung jika tidak ada shift yang update, namun dihitung untuk shift Minggu yang memiliki update', () => {
  // 2026-11-14 = Sabtu, 2026-11-15 = Minggu, 2026-11-16 = Senin
  // Tanpa update di hari Minggu: Sabtu Shift 3 -> Senin Shift 1 = 2 Shift
  assert.equal(calculateShiftSpan('2026-11-14', 'Shift 3', '2026-11-16', 'Shift 1'), 2);

  // Dengan update pada Minggu Shift 1: Sabtu Shift 3 -> Senin Shift 1 = 3 Shift
  assert.equal(
    calculateShiftSpan(
      '2026-11-14',
      'Shift 3',
      '2026-11-16',
      'Shift 1',
      new Set(['2026-11-15::Shift 1'])
    ),
    3
  );

  const weekendOpenCase: HandoverReport = {
    ...sampleReports[0],
    id: 'sun-skip-1',
    reportDate: '2026-11-13', // Jumat
    shift: 'Shift 1',
    category: 'OVERHAUL',
    machine: 'AST 25-12L',
    isCompleted: false,
  };

  // Diperiksa pada Minggu 15 Nov jam 10:00 tanpa laporan Minggu:
  // Jumat (3) + Sabtu (3) + Minggu tanpa update (0) = 6 Shift
  const sundayNoUpdate = computeCaseDurations(
    [weekendOpenCase],
    new Date(2026, 10, 15, 10, 0)
  );
  assert.equal(sundayNoUpdate[0].durationShifts, 6);

  // Jika selesai Senin 16 Nov Shift 1 tanpa update Minggu:
  // Jumat (3) + Sabtu (3) + Minggu (0) + Senin Shift 1 (1) = 7 Shift
  const closedMonday: HandoverReport = {
    ...weekendOpenCase,
    id: 'sun-skip-2',
    reportDate: '2026-11-16',
    shift: 'Shift 1',
    isCompleted: true,
  };
  const monWithoutSunday = computeCaseDurations(
    [weekendOpenCase, closedMonday],
    new Date(2026, 10, 16, 10, 0)
  );
  assert.equal(monWithoutSunday[0].durationShifts, 7);

  // Jika ada update pada Minggu 15 Nov Shift 1:
  // Jumat (3) + Sabtu (3) + Minggu Shift 1 (1) + Senin Shift 1 (1) = 8 Shift
  const sundayShift1Report: HandoverReport = {
    ...weekendOpenCase,
    id: 'sun-active-1',
    reportDate: '2026-11-15',
    shift: 'Shift 1',
    isCompleted: false,
  };
  const monWithSundayShift1 = computeCaseDurations(
    [weekendOpenCase, sundayShift1Report, closedMonday],
    new Date(2026, 10, 16, 10, 0)
  );
  assert.equal(monWithSundayShift1[0].durationShifts, 8);
});

test('extractOAuthErrorFromUrl, mapAuthErrorMessage, dan default role pengawas bekerja dengan benar', () => {
  assert.equal(extractOAuthErrorFromUrl('', ''), null);
  assert.equal(extractOAuthErrorFromUrl('?code=abc123', ''), null);
  assert.equal(
    extractOAuthErrorFromUrl('?error=access_denied&error_description=User%20cancelled', ''),
    'Login dengan Google dibatalkan.'
  );
  assert.equal(
    extractOAuthErrorFromUrl('', '#error=server_error&error_description=Unsupported+provider%3A+provider+is+not+enabled'),
    'Login Google belum diaktifkan. Aktifkan Google Sign-In pada Firebase Console → Authentication → Sign-in method.'
  );

  assert.equal(
    mapAuthErrorMessage('Firebase: Error (auth/popup-closed-by-user).'),
    'Login dengan Google dibatalkan.'
  );
  assert.equal(
    mapAuthErrorMessage('Firebase: Error (auth/operation-not-allowed).'),
    'Metode login Email/Password belum diaktifkan di Firebase Console (Authentication → Sign-in method). Gunakan tombol Google atau aktifkan Email/Password terlebih dahulu.'
  );
  assert.equal(
    mapAuthErrorMessage('Missing or insufficient permissions.'),
    'Akses ditolak oleh Firestore Security Rules. Pastikan email akun terverifikasi dan Anda memiliki izin untuk aksi ini.'
  );

  assert.equal(normalizeUserRole(undefined), 'pengawas');
  assert.equal(normalizeUserRole(''), 'pengawas');
  assert.equal(normalizeUserRole('operator'), 'pengawas');
  assert.equal(normalizeUserRole('supervisor'), 'supervisor');
  assert.equal(normalizeUserRole('admin'), 'admin');
});

test('perhitungan Total Durasi dimulai setelah update OH atau saat Hari pertama perbaikan = Ya', () => {
  assert.equal(isOhOnlyInformation('OH'), true);
  assert.equal(isOhOnlyInformation('Status OH'), true);
  assert.equal(isOhOnlyInformation('Setting PMA sudah press 10T masih bocor L2N3'), false);

  // Contoh kasus user:
  // 1) Shift 2 16-11-2026 AST 47-16L berisi update "OH" -> belum terhitung Total Durasi (0 Shift)
  const ohInitial: HandoverReport = {
    ...sampleReports[0],
    id: 'oh-1',
    reportDate: '2026-11-16',
    shift: 'Shift 2',
    category: 'OVERHAUL',
    machine: 'AST 47-16L',
    information: 'OH',
    followUp: 'Lanjut perbaikan',
    isCompleted: false,
  };

  const onlyOhResult = computeCaseDurations(
    [ohInitial],
    new Date(2026, 10, 16, 18, 0)
  );
  assert.equal(onlyOhResult.length, 1);
  assert.equal(onlyOhResult[0].hasStartedRepair, false);
  assert.equal(onlyOhResult[0].durationShifts, 0);
  assert.deepEqual(onlyOhResult[0].countedReportIds, []);
  assert.equal(hasOpenEpisodeStartedRepair([ohInitial], 'OVERHAUL', 'AST 47-16L'), false);

  // 2) Shift 1 17-11-2026 AST 47-16L berisi update "Setting PMA..." -> mulai Shift ke-1
  const firstRepair: HandoverReport = {
    ...sampleReports[0],
    id: 'oh-2',
    reportDate: '2026-11-17',
    shift: 'Shift 1',
    category: 'OVERHAUL',
    machine: 'AST 47-16L',
    information: 'Setting PMA sudah press 10T masih bocor L2N3',
    isCompleted: false,
  };

  const atFirstRepair = computeCaseDurations(
    [ohInitial, firstRepair],
    new Date(2026, 10, 17, 10, 0)
  );
  assert.equal(atFirstRepair.length, 1);
  assert.equal(atFirstRepair[0].hasStartedRepair, true);
  assert.equal(atFirstRepair[0].startDate, '2026-11-17');
  assert.equal(atFirstRepair[0].startShift, 'Shift 1');
  assert.equal(atFirstRepair[0].durationShifts, 1);
  assert.deepEqual(atFirstRepair[0].countedReportIds, ['oh-2']);
  assert.equal(
    hasOpenEpisodeStartedRepair([ohInitial, firstRepair], 'OVERHAUL', 'AST 47-16L'),
    true
  );

  // 3) Selesai pada Shift 2 17-11-2026 -> Total Durasi = 2 Shift
  const closingRepair: HandoverReport = {
    ...sampleReports[0],
    id: 'oh-3',
    reportDate: '2026-11-17',
    shift: 'Shift 2',
    category: 'OVERHAUL',
    machine: 'AST 47-16L',
    information: 'Military OK',
    isCompleted: true,
  };
  const completedAfterOh = computeCaseDurations(
    [ohInitial, firstRepair, closingRepair],
    new Date(2026, 10, 18, 8, 0)
  );
  assert.equal(completedAfterOh[0].durationShifts, 2);
  assert.deepEqual(completedAfterOh[0].countedReportIds, ['oh-2', 'oh-3']);

  // 4) Uji flag eksplisit isRepairStart ("Hari pertama perbaikan?"):
  // Jika Tidak (false) semua -> tidak dihitung (0 Shift)
  const notStartedExplicit: HandoverReport = {
    ...ohInitial,
    id: 'exp-1',
    machine: 'AST 9-16L',
    information: 'Tunggu sparepart PMA',
    isRepairStart: false,
  };
  const explicitFalseRes = computeCaseDurations(
    [notStartedExplicit],
    new Date(2026, 10, 17, 10, 0)
  );
  assert.equal(explicitFalseRes[0].hasStartedRepair, false);
  assert.equal(explicitFalseRes[0].durationShifts, 0);

  // Jika Shift berikutnya Ya (true) -> mulai hitung dari shift tersebut
  const startedExplicit: HandoverReport = {
    ...firstRepair,
    id: 'exp-2',
    machine: 'AST 9-16L',
    isRepairStart: true,
    isCompleted: true,
  };
  const explicitTrueRes = computeCaseDurations(
    [notStartedExplicit, startedExplicit],
    new Date(2026, 10, 17, 10, 0)
  );
  assert.equal(explicitTrueRes[0].hasStartedRepair, true);
  assert.equal(explicitTrueRes[0].durationShifts, 1);
  assert.deepEqual(explicitTrueRes[0].countedReportIds, ['exp-2']);
});

test('countMilitaryInReport, countStabilityInReport, dan ekspor kolom Total Military / Stability di Excel', () => {
  const repMultiMilitary: HandoverReport = {
    ...sampleReports[0],
    id: 'mil-1',
    category: 'OVERHAUL',
    information: [
      '-military gagal (bocor 4 box line 3,6 ph)',
      '-perbaikan press 20T ok',
      '-military gagal (bocor 2 box line 7,10 ph)',
      '-press 10T bocor line 8',
    ].join('\n'),
    followUp: 'lanjut military shift 2', // rencana tindak lanjut tidak ikut dihitung ganda
    isRepairStart: true,
  };
  const repStabilityText: HandoverReport = {
    ...sampleReports[0],
    id: 'stab-1',
    shift: 'Shift 2',
    category: 'OVERHAUL',
    information: 'hasil military OK\nhasil stability OK',
    isCompleted: true,
  };
  const repStabilityCat: HandoverReport = {
    ...sampleReports[1],
    id: 'stab-2',
    category: 'STABILITY TINGGI',
    information: 'Uji chamber suhu 40C berjalan lancar.',
    isCompleted: false,
  };

  assert.equal(countMilitaryInReport(repMultiMilitary), 2);
  assert.equal(countStabilityInReport(repMultiMilitary), 0);
  assert.equal(countMilitaryInReport(repStabilityText), 1);
  assert.equal(countStabilityInReport(repStabilityText), 1);
  assert.equal(countStabilityInReport(repStabilityCat), 1);

  const wb = buildHandoverWorkbook([repMultiMilitary, repStabilityText, repStabilityCat]);
  const ws = wb.Sheets['DETAIL DATA'];
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });
  // Baris 5 (idx 4) -> repMultiMilitary: Military = 2, Stability = 0
  assert.equal(rows[4][11], 2);
  assert.equal(rows[4][12], 0);
  // Baris 6 (idx 5) -> repStabilityText: Military = 1, Stability = 1
  assert.equal(rows[5][11], 1);
  assert.equal(rows[5][12], 1);
  // Baris 7 (idx 6) -> repStabilityCat: Military = 0, Stability = 1
  assert.equal(rows[6][11], 0);
  assert.equal(rows[6][12], 1);
  // Baris TOTAL KESELURUHAN (idx 7): Total Military = 3, Total Stability = 2
  assert.equal(rows[7][4], 'TOTAL KESELURUHAN');
  assert.equal(rows[7][11], 3);
  assert.equal(rows[7][12], 2);
});




