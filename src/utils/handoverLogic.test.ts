import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  canEditReport,
  categoryRequiresMachine,
  computeDashboardSummary,
  computeOverhaulMatrix,
  filterAndSortReports,
  getCurrentShiftStatus,
  getOperationalDateString,
  groupActiveDashboardCases,
  isReportResultOk,
  isShiftResultOk,
  validateHandoverInput,
} from './handoverLogic';
import { buildHandoverFilename, buildHandoverWorkbook } from './excelExport';
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
    isCompleted: false,
    createdBy: 'user-shift-3',
    createdByName: 'Andi Pratama',
    updatedBy: 'user-shift-3',
    updatedByName: 'Andi Pratama',
    createdAt: '2026-11-11T23:00:00.000Z',
    updatedAt: '2026-11-11T23:15:00.000Z',
  },
];

test('categoryRequiresMachine hanya wajib untuk OVERHAUL', () => {
  assert.equal(categoryRequiresMachine('OVERHAUL'), true);
  assert.equal(categoryRequiresMachine('STABILITY TINGGI'), false);
  assert.equal(categoryRequiresMachine('CASE PERBAIKAN PART'), false);
  assert.equal(categoryRequiresMachine('COMMISSIONING / TRIAL / CHANGE OVER'), false);
});

test('validateHandoverInput mewajibkan mesin pada OVERHAUL dan mengizinkan mesin pada kategori lain', () => {
  const missingMachine = validateHandoverInput({
    reportDate: '2026-11-12',
    shift: 'Shift 1',
    category: 'OVERHAUL',
    machine: '',
    information: 'Kalibrasi sensor',
    issue: '',
    followUp: '',
  });
  assert.equal(missingMachine.valid, false);
  assert.ok(missingMachine.errors.machine);

  const stabilityWithMachine = validateHandoverInput({
    reportDate: '2026-11-12',
    shift: 'Shift 2',
    category: 'STABILITY TINGGI',
    machine: 'AST 67-16L',
    information: 'Monitoring kestabilan batch.',
    issue: '',
    followUp: '',
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
    // Kemarin Shift 3 (belum selesai) -> harus terbawa hari ini!
    {
      ...sampleReports[2],
      id: 'prev-s3',
      reportDate: '2026-11-12',
      shift: 'Shift 3',
      category: 'OVERHAUL',
      machine: 'AST 9-16L',
      information: 'persiapan rangka selesai',
      followUp: 'lanjut press shift 1',
      isCompleted: false,
    },
    // Case baru dimulai hari ini (2026-11-13) di Shift 1
    {
      ...sampleReports[0],
      id: 'today-s1-new',
      reportDate: '2026-11-13',
      shift: 'Shift 1',
      category: 'STABILITY TINGGI',
      machine: 'AST 67-16L',
      information: 'mulai stability',
      isCompleted: false,
    },
    // Case kemarin yang sudah selesai -> tidak boleh terbawa ke hari ini!
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

  // 1. Pagi hari ini (2026-11-13 pukul 08:00 = Shift 1):
  // - OVERHAUL AST 9-16L: 2 baris (Kemarin Shift 3 + Hari ini Shift 1 canFill=true)
  // - STABILITY TINGGI AST 67-16L: hanya 1 baris (Shift 1)
  // - COMMISSIONING: kosong (0 grup)
  const atShift1 = groupActiveDashboardCases(reports, new Date(2026, 10, 13, 8, 0));
  assert.equal(atShift1['OVERHAUL'][0].rows.length, 2);
  assert.equal(atShift1['OVERHAUL'][0].rows[0].isCarryOver, true);
  assert.equal(atShift1['OVERHAUL'][0].rows[0].shift, 'Shift 3');
  assert.equal(atShift1['OVERHAUL'][0].rows[1].shift, 'Shift 1');
  assert.equal(atShift1['OVERHAUL'][0].rows[1].canFill, true);
  assert.equal(atShift1['STABILITY TINGGI'][0].rows.length, 1);
  assert.equal(atShift1['COMMISSIONING / TRIAL / CHANGE OVER'].length, 0);

  // 2. Siang hari ini (2026-11-13 pukul 15:00 = Shift 2):
  // - OVERHAUL AST 9-16L: 3 baris (Kemarin Shift 3, Shift 1, Shift 2 canFill=true)
  // - STABILITY TINGGI AST 67-16L: 2 baris (Shift 1, Shift 2 canFill=true)
  const atShift2 = groupActiveDashboardCases(reports, new Date(2026, 10, 13, 15, 0));
  assert.equal(atShift2['OVERHAUL'][0].rows.length, 3);
  assert.equal(atShift2['OVERHAUL'][0].rows[2].shift, 'Shift 2');
  assert.equal(atShift2['OVERHAUL'][0].rows[2].canFill, true);
  assert.equal(atShift2['STABILITY TINGGI'][0].rows.length, 2);

  // 3. Malam hari ini (2026-11-13 pukul 22:30 = Shift 3):
  // - OVERHAUL AST 9-16L: maksimal 4 baris (Kemarin Shift 3, Shift 1, Shift 2, Shift 3)
  const atShift3 = groupActiveDashboardCases(reports, new Date(2026, 10, 13, 22, 30));
  assert.equal(atShift3['OVERHAUL'][0].rows.length, 4);
  assert.equal(atShift3['OVERHAUL'][0].rows[3].shift, 'Shift 3');
  assert.equal(atShift3['OVERHAUL'][0].rows[3].canFill, true);
});

test('filterAndSortReports menyaring berdasarkan tanggal, shift, kategori, dan keyword serta mengurutkan terbaru', () => {
  const filtered = filterAndSortReports(sampleReports, {
    date: '',
    shift: 'ALL',
    category: 'ALL',
    keyword: 'press',
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'rep-1');

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
    role: 'operator',
    defaultShift: 'Shift 1',
    canEditAll: false,
  };
  const supervisor: UserProfile = {
    id: 'user-sup',
    email: 'sup@plant.id',
    fullName: 'Hendra',
    role: 'supervisor',
    defaultShift: 'Shift 1',
    canEditAll: true,
  };

  assert.equal(canEditReport(sampleReports[0], shift1User), true);
  assert.equal(canEditReport(sampleReports[1], shift1User), false);
  assert.equal(canEditReport(sampleReports[1], supervisor), true);
});

test('buildHandoverWorkbook membuat worksheet HANDOVER dan DETAIL DATA lengkap dengan autofilter & kolom', () => {
  const wb = buildHandoverWorkbook(sampleReports);
  assert.deepEqual(wb.SheetNames, ['HANDOVER', 'DETAIL DATA']);

  const handoverSheet = wb.Sheets['HANDOVER'];
  const handoverJson = XLSX.utils.sheet_to_json<string[]>(handoverSheet, { header: 1 });
  assert.deepEqual(handoverJson[0], [
    'Tanggal',
    'Shift',
    'Kategori',
    'Mesin',
    'Informasi',
    'Masalah',
    'Tindak Lanjut',
  ]);
  assert.equal(handoverJson.length, 4);
  assert.ok(handoverSheet['!autofilter']);
  assert.ok(Array.isArray(handoverSheet['!cols']) && handoverSheet['!cols'].length === 7);

  const detailSheet = wb.Sheets['DETAIL DATA'];
  const detailJson = XLSX.utils.sheet_to_json<string[]>(detailSheet, { header: 1 });
  assert.equal(detailJson[0].length, 11);
  assert.equal(detailJson[0][0], 'ID');
  assert.equal(detailJson[0][8], 'Pembuat');
  assert.equal(buildHandoverFilename('2026-11-13'), 'HANDOVER_2026-11-13.xlsx');
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

  // Masih Shift 3 dini hari (14 Nov 04:00 pagi) -> keduanya masih tampil, hanya yang dicentang isOk=true
  assert.equal(getOperationalDateString(new Date(2026, 10, 14, 4, 0)), '2026-11-13');
  const preDawn = groupActiveDashboardCases(
    [shift3CheckedOk, shift3UncheckedTextOk],
    new Date(2026, 10, 14, 4, 0)
  );
  assert.equal(preDawn['STABILITY TINGGI'].length, 1);
  assert.equal(preDawn['STABILITY TINGGI'][0].rows.at(-1)?.isOk, true);
  assert.equal(preDawn['OVERHAUL'].length, 1);
  assert.equal(preDawn['OVERHAUL'][0].rows.at(-1)?.isOk, false);

  // Jam 06:00 pagi tanggal 14 Nov (Shift 1 dimulai) -> yang dicentang selesai hilang, yang belum dicentang lanjut
  assert.equal(getOperationalDateString(new Date(2026, 10, 14, 6, 0)), '2026-11-14');
  const nextMorning = groupActiveDashboardCases(
    [shift3CheckedOk, shift3UncheckedTextOk],
    new Date(2026, 10, 14, 6, 0)
  );
  assert.equal(nextMorning['STABILITY TINGGI'].length, 0);
  assert.equal(nextMorning['OVERHAUL'].length, 1);

  // Yang sudah hilang dari Dashboard tetap ditemukan di History dan Report Excel
  const inHistory = filterAndSortReports([shift3CheckedOk], {
    date: '2026-11-13',
    shift: 'ALL',
    category: 'ALL',
    keyword: 'AST 67-16L',
  });
  assert.equal(inHistory.length, 1);

  const wb = buildHandoverWorkbook([shift3CheckedOk]);
  const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['HANDOVER'], { header: 1 });
  assert.equal(rows.length, 2);
});



