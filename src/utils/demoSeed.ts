import type { HandoverReport, UserProfile } from '../types/handover';
import { getTodayDateString } from './handoverLogic';

export const DEMO_ACCOUNTS: {
  label: string;
  email: string;
  profile: UserProfile;
}[] = [
  {
    label: 'Operator Shift 1 — Budi Santoso',
    email: 'shift1.operator@military-stability.local',
    profile: {
      id: 'demo-user-shift-1',
      email: 'shift1.operator@military-stability.local',
      fullName: 'Budi Santoso',
      role: 'operator',
      defaultShift: 'Shift 1',
      canEditAll: false,
    },
  },
  {
    label: 'Operator Shift 2 — Rina Wijaya',
    email: 'shift2.operator@military-stability.local',
    profile: {
      id: 'demo-user-shift-2',
      email: 'shift2.operator@military-stability.local',
      fullName: 'Rina Wijaya',
      role: 'operator',
      defaultShift: 'Shift 2',
      canEditAll: false,
    },
  },
  {
    label: 'Supervisor Produksi — Hendra Kusuma',
    email: 'supervisor@military-stability.local',
    profile: {
      id: 'demo-user-supervisor',
      email: 'supervisor@military-stability.local',
      fullName: 'Hendra Kusuma',
      role: 'supervisor',
      defaultShift: 'Shift 3',
      canEditAll: true,
    },
  },
];

export function createInitialDemoReports(now: Date = new Date()): HandoverReport[] {
  const today = getTodayDateString(now);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = getTodayDateString(yesterdayDate);

  return [
    // OVERHAUL — Mesin 1 (AST 9-16L): Case berkelanjutan dari Shift 3 kemarin -> berlanjut ke Shift 1 hari ini
    {
      id: '10000001-0000-4000-8000-000000000001',
      reportDate: yesterday,
      shift: 'Shift 3',
      category: 'OVERHAUL',
      machine: 'AST 9-16L',
      information: 'persiapan rangka & pasang komponen utama selesai',
      issue: '',
      followUp: 'lanjut press 10T di shift 1',
      isCompleted: false,
      createdBy: 'demo-user-supervisor',
      createdByName: 'Hendra Kusuma',
      updatedBy: 'demo-user-supervisor',
      updatedByName: 'Hendra Kusuma',
      createdAt: `${yesterday}T22:45:00.000Z`,
      updatedAt: `${yesterday}T22:55:00.000Z`,
    },
    {
      id: '10000001-0000-4000-8000-000000000002',
      reportDate: today,
      shift: 'Shift 1',
      category: 'OVERHAUL',
      machine: 'AST 9-16L',
      information: 'sudah press 10T',
      issue: '',
      followUp: 'lanjut military shift 2',
      isCompleted: false,
      createdBy: 'demo-user-shift-1',
      createdByName: 'Budi Santoso',
      updatedBy: 'demo-user-shift-1',
      updatedByName: 'Budi Santoso',
      createdAt: `${today}T06:45:00.000Z`,
      updatedAt: `${today}T06:55:00.000Z`,
    },
    // OVERHAUL — Mesin 2 (AST4S 22-16L) dimulai Shift 1 hari ini
    {
      id: '10000001-0000-4000-8000-000000000003',
      reportDate: today,
      shift: 'Shift 1',
      category: 'OVERHAUL',
      machine: 'AST4S 22-16L',
      information: 'Pembongkaran modul feeder utama dan pembersihan jalur pneumatic selesai.',
      issue: 'Keausan ringan bushing roller kiri.',
      followUp: 'Shift 2 lanjut uji run-in tanpa beban 30 menit.',
      isCompleted: false,
      createdBy: 'demo-user-shift-1',
      createdByName: 'Budi Santoso',
      updatedBy: 'demo-user-shift-1',
      updatedByName: 'Budi Santoso',
      createdAt: `${today}T08:15:00.000Z`,
      updatedAt: `${today}T08:20:00.000Z`,
    },
    // OVERHAUL — Mesin 3 (AST 25-12L) dimulai Shift 1 hari ini
    {
      id: '10000001-0000-4000-8000-000000000004',
      reportDate: today,
      shift: 'Shift 1',
      category: 'OVERHAUL',
      machine: 'AST 25-12L',
      information: 'Penggantian oli gearbox & kalibrasi sensor proximity home.',
      issue: '',
      followUp: 'Shift 2 lanjut cek kestabilan putaran awal.',
      isCompleted: false,
      createdBy: 'demo-user-shift-1',
      createdByName: 'Budi Santoso',
      updatedBy: 'demo-user-shift-1',
      updatedByName: 'Budi Santoso',
      createdAt: `${today}T09:10:00.000Z`,
      updatedAt: `${today}T09:20:00.000Z`,
    },
    // STABILITY TINGGI — Mesin AST 67-16L dimulai Shift 1 hari ini
    {
      id: '10000001-0000-4000-8000-000000000005',
      reportDate: today,
      shift: 'Shift 1',
      category: 'STABILITY TINGGI',
      machine: 'AST 67-16L',
      information: 'Setel parameter stability awal suhu 40C/75%RH.',
      issue: '',
      followUp: 'Pantau tren kestabilan di Shift 2.',
      isCompleted: false,
      createdBy: 'demo-user-shift-1',
      createdByName: 'Budi Santoso',
      updatedBy: 'demo-user-shift-1',
      updatedByName: 'Budi Santoso',
      createdAt: `${today}T10:00:00.000Z`,
      updatedAt: `${today}T10:10:00.000Z`,
    },
    // CASE PERBAIKAN PART — Mesin AST 14-12L dimulai Shift 1 hari ini
    {
      id: '10000001-0000-4000-8000-000000000006',
      reportDate: today,
      shift: 'Shift 1',
      category: 'CASE PERBAIKAN PART',
      machine: 'AST 14-12L',
      information: 'Penggantian bracket sensor optik & kabel M12 selesai.',
      issue: 'Isolasi kabel sebelumnya terjepit.',
      followUp: 'Pastikan uji sensor stabil saat start Shift 2.',
      isCompleted: false,
      createdBy: 'demo-user-shift-1',
      createdByName: 'Budi Santoso',
      updatedBy: 'demo-user-shift-1',
      updatedByName: 'Budi Santoso',
      createdAt: `${today}T10:25:00.000Z`,
      updatedAt: `${today}T10:35:00.000Z`,
    },
    // COMMISSIONING / TRIAL / CHANGE OVER (Kemarin sudah selesai -> hari ini kosong)
    {
      id: '10000001-0000-4000-8000-000000000007',
      reportDate: yesterday,
      shift: 'Shift 3',
      category: 'COMMISSIONING / TRIAL / CHANGE OVER',
      machine: 'AST 50-16L',
      information: 'Trial run format kemasan baru dan verifikasi 500 unit lulus QC.',
      issue: '',
      followUp: 'Selesai, siap produksi reguler.',
      isCompleted: true,
      createdBy: 'demo-user-supervisor',
      createdByName: 'Hendra Kusuma',
      updatedBy: 'demo-user-supervisor',
      updatedByName: 'Hendra Kusuma',
      createdAt: `${yesterday}T22:20:00.000Z`,
      updatedAt: `${yesterday}T22:45:00.000Z`,
    },
  ];
}
