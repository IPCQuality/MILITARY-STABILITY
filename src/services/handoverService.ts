import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type {
  CategoryType,
  HandoverFormInput,
  HandoverReport,
  ShiftType,
  UserProfile,
  UserRole,
} from '../types/handover';
import { createInitialDemoReports, DEMO_ACCOUNTS } from '../utils/demoSeed';
import { validateHandoverInput } from '../utils/handoverLogic';

export const DEFAULT_SUPABASE_URL = 'https://dkyjfoxruqoqlhxrmcac.supabase.co';
const CONFIG_STORAGE_KEY = 'ms_handover_supabase_config_v1';
const DEMO_REPORTS_KEY = 'ms_handover_demo_reports_v2';
const LEGACY_DEMO_REPORTS_KEY = 'ms_handover_demo_reports_v1';
const DEMO_SESSION_KEY = 'ms_handover_demo_session_v1';

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

interface DbHandoverRow {
  id: string;
  report_date: string;
  shift: ShiftType;
  category: CategoryType;
  machine: string | null;
  information: string;
  issue: string;
  follow_up: string;
  is_completed: boolean;
  created_by: string;
  created_by_name: string;
  updated_by: string | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
}

interface DbProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  default_shift: ShiftType;
  can_edit_all: boolean;
}

function mapDbRowToReport(row: DbHandoverRow): HandoverReport {
  return {
    id: row.id,
    reportDate: row.report_date ?? '',
    shift: row.shift ?? 'Shift 1',
    category: row.category ?? 'OVERHAUL',
    machine: row.machine ?? null,
    information: row.information ?? '',
    issue: row.issue ?? '',
    followUp: row.follow_up ?? '',
    isCompleted: Boolean(row.is_completed),
    createdBy: row.created_by ?? '',
    createdByName: row.created_by_name ?? '',
    updatedBy: row.updated_by ?? null,
    updatedByName: row.updated_by_name ?? null,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}

export function isDangerousSecretKey(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('sb_secret_')) return true;
  // Detect JWT with service_role claim if pasted accidentally
  const parts = trimmed.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload?.role === 'service_role') {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
}

export function getStoredSupabaseConfig(): SupabaseConfig {
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

  let stored: Partial<SupabaseConfig> = {};
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
      if (raw) {
        stored = JSON.parse(raw) as Partial<SupabaseConfig>;
      }
    } catch {
      stored = {};
    }
  }

  const url = (stored.url || envUrl || DEFAULT_SUPABASE_URL).trim();
  const rawKey = (stored.publishableKey || envKey || '').trim();
  const validKey =
    rawKey && rawKey !== 'YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY' && !isDangerousSecretKey(rawKey)
      ? rawKey
      : '';

  return { url, publishableKey: validKey };
}

export function saveSupabaseConfig(config: SupabaseConfig): { ok: boolean; error?: string } {
  const trimmedUrl = config.url.trim();
  const trimmedKey = config.publishableKey.trim();

  if (!trimmedUrl.startsWith('https://')) {
    return { ok: false, error: 'Project URL Supabase harus diawali https://.' };
  }

  if (isDangerousSecretKey(trimmedKey)) {
    return {
      ok: false,
      error:
        'Dilarang menggunakan service_role / secret key di frontend! Gunakan hanya Publishable Key atau anon public key.',
    };
  }

  const nextKey = `${trimmedUrl}::${trimmedKey}`;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      CONFIG_STORAGE_KEY,
      JSON.stringify({ url: trimmedUrl, publishableKey: trimmedKey })
    );
  }
  if (cachedClientKey && cachedClientKey !== nextKey) {
    cachedClientKey = '';
    cachedClient = null;
  }
  return { ok: true };
}

export function isSupabaseConfigured(): boolean {
  const cfg = getStoredSupabaseConfig();
  return Boolean(cfg.url && cfg.publishableKey);
}

let cachedClient: SupabaseClient | null = null;
let cachedClientKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const cfg = getStoredSupabaseConfig();
  if (!cfg.url || !cfg.publishableKey) {
    return null;
  }
  const key = `${cfg.url}::${cfg.publishableKey}`;
  if (cachedClient && cachedClientKey === key) {
    return cachedClient;
  }
  cachedClient = createClient(cfg.url, cfg.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  cachedClientKey = key;
  return cachedClient;
}

export function mapAuthErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'Email atau kata sandi tidak sesuai. Periksa kembali kredensial Anda.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Email akun belum dikonfirmasi. Cek inbox atau hubungi Admin Supabase.';
  }
  if (lower.includes('signups not allowed')) {
    return 'Pendaftaran akun mandiri sedang dinonaktifkan oleh Admin.';
  }
  if (lower.includes('user already registered')) {
    return 'Email ini sudah terdaftar. Silakan login dengan akun tersebut.';
  }
  if (lower.includes('jwt') || lower.includes('expired') || lower.includes('refresh_token')) {
    return 'Sesi login Anda telah berakhir. Silakan login ulang.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Gagal terhubung ke server Supabase. Periksa koneksi internet dan konfigurasi URL/Key.';
  }
  return message;
}

// ============================================================================
// Demo Sandbox Persistence (digunakan hanya saat Publishable Key belum diisi
// atau pengguna memilih Mode Demo Lokal)
// ============================================================================

function normalizeDemoReport(raw: Partial<HandoverReport>): HandoverReport {
  const nowIso = new Date().toISOString();
  return {
    id: raw.id || `demo-${Date.now()}`,
    reportDate: raw.reportDate ?? '',
    shift: raw.shift ?? 'Shift 1',
    category: raw.category ?? 'OVERHAUL',
    machine: raw.machine ?? null,
    information: raw.information ?? '',
    issue: raw.issue ?? '',
    followUp: raw.followUp ?? '',
    isCompleted: Boolean(raw.isCompleted),
    createdBy: raw.createdBy ?? '',
    createdByName: raw.createdByName ?? '',
    updatedBy: raw.updatedBy ?? null,
    updatedByName: raw.updatedByName ?? null,
    createdAt: raw.createdAt ?? nowIso,
    updatedAt: raw.updatedAt ?? nowIso,
  };
}

function getDemoReports(): HandoverReport[] {
  if (typeof window === 'undefined') return createInitialDemoReports();
  try {
    window.localStorage.removeItem(LEGACY_DEMO_REPORTS_KEY);
    const raw = window.localStorage.getItem(DEMO_REPORTS_KEY);
    if (!raw) {
      const seeded = createInitialDemoReports();
      window.localStorage.setItem(DEMO_REPORTS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return createInitialDemoReports();
    }
    return (parsed as Partial<HandoverReport>[]).map(normalizeDemoReport);
  } catch {
    return createInitialDemoReports();
  }
}

function saveDemoReports(reports: HandoverReport[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEMO_REPORTS_KEY, JSON.stringify(reports));
}

export function getDemoSessionUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function signInDemoAccount(email: string): UserProfile {
  const found = DEMO_ACCOUNTS.find((a) => a.email === email) ?? DEMO_ACCOUNTS[0];
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(found.profile));
  }
  return found.profile;
}

export function signOutDemoAccount(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(DEMO_SESSION_KEY);
  }
}

export function resetDemoData(): void {
  if (typeof window === 'undefined') return;
  const seeded = createInitialDemoReports();
  saveDemoReports(seeded);
}

// ============================================================================
// Unified Auth & Data Operations (Supabase Cloud vs Local Demo Sandbox)
// ============================================================================

export async function fetchUserProfileFromSupabase(
  client: SupabaseClient,
  session: Session
): Promise<UserProfile> {
  const user = session.user;
  const fallbackName =
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split('@')[0] ||
    'Operator';
  const fallbackShift =
    (user.user_metadata?.default_shift as ShiftType | undefined) || 'Shift 1';

  const { data, error } = await client
    .from('profiles')
    .select('id, email, full_name, role, default_shift, can_edit_all')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data) {
    return {
      id: user.id,
      email: user.email ?? '',
      fullName: fallbackName,
      role: 'operator',
      defaultShift: fallbackShift,
      canEditAll: false,
    };
  }

  const row = data as DbProfileRow;
  return {
    id: row.id,
    email: row.email || user.email || '',
    fullName: row.full_name || fallbackName,
    role: row.role || 'operator',
    defaultShift: row.default_shift || fallbackShift,
    canEditAll: Boolean(row.can_edit_all),
  };
}

export async function signInSupabase(
  email: string,
  password: string
): Promise<{ user?: UserProfile; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      error: 'Publishable Key Supabase belum dikonfigurasi. Isi di halaman Settings atau gunakan Mode Demo.',
    };
  }

  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error || !data.session) {
    return { error: mapAuthErrorMessage(error?.message || 'Gagal login.') };
  }

  const profile = await fetchUserProfileFromSupabase(client, data.session);
  return { user: profile };
}

export async function signUpSupabase(params: {
  email: string;
  password: string;
  fullName: string;
  defaultShift: ShiftType;
}): Promise<{ user?: UserProfile; needsEmailConfirm?: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      error: 'Publishable Key Supabase belum dikonfigurasi.',
    };
  }

  const { data, error } = await client.auth.signUp({
    email: params.email.trim(),
    password: params.password,
    options: {
      data: {
        full_name: params.fullName.trim(),
        default_shift: params.defaultShift,
      },
    },
  });

  if (error) {
    return { error: mapAuthErrorMessage(error.message) };
  }

  if (!data.session) {
    return { needsEmailConfirm: true };
  }

  const profile = await fetchUserProfileFromSupabase(client, data.session);
  return { user: profile };
}

export async function signOutUnified(mode: 'supabase' | 'demo'): Promise<void> {
  if (mode === 'demo') {
    signOutDemoAccount();
    return;
  }
  const client = getSupabaseClient();
  if (client) {
    await client.auth.signOut();
  }
}

export async function loadReportsUnified(
  mode: 'supabase' | 'demo'
): Promise<{ reports: HandoverReport[]; error?: string }> {
  if (mode === 'demo') {
    return { reports: getDemoReports() };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { reports: [], error: 'Konfigurasi Supabase belum lengkap.' };
  }

  const { data, error } = await client
    .from('handover_reports')
    .select(
      'id, report_date, shift, category, machine, information, issue, follow_up, is_completed, created_by, created_by_name, updated_by, updated_by_name, created_at, updated_at'
    )
    .order('report_date', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    return {
      reports: [],
      error: mapAuthErrorMessage(error.message),
    };
  }

  return {
    reports: ((data ?? []) as DbHandoverRow[]).map(mapDbRowToReport),
  };
}

export async function createReportUnified(
  mode: 'supabase' | 'demo',
  input: HandoverFormInput,
  user: UserProfile
): Promise<{ report?: HandoverReport; error?: string }> {
  const validation = validateHandoverInput(input);
  if (!validation.valid) {
    const firstErr = Object.values(validation.errors)[0] || 'Data laporan tidak valid.';
    return { error: firstErr };
  }

  if (mode === 'demo') {
    const nowIso = new Date().toISOString();
    const newReport: HandoverReport = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `demo-${Date.now()}`,
      reportDate: input.reportDate,
      shift: input.shift,
      category: input.category,
      machine: validation.sanitizedMachine,
      information: input.information.trim(),
      issue: input.issue.trim(),
      followUp: input.followUp.trim(),
      isCompleted: Boolean(input.isCompleted),
      createdBy: user.id,
      createdByName: user.fullName,
      updatedBy: user.id,
      updatedByName: user.fullName,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const existing = getDemoReports();
    saveDemoReports([newReport, ...existing]);
    return { report: newReport };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { error: 'Klien Supabase tidak tersedia.' };
  }

  const { data, error } = await client
    .from('handover_reports')
    .insert({
      report_date: input.reportDate,
      shift: input.shift,
      category: input.category,
      machine: validation.sanitizedMachine,
      information: input.information.trim(),
      issue: input.issue.trim(),
      follow_up: input.followUp.trim(),
      is_completed: Boolean(input.isCompleted),
      created_by: user.id,
      created_by_name: user.fullName,
      updated_by: user.id,
      updated_by_name: user.fullName,
    })
    .select(
      'id, report_date, shift, category, machine, information, issue, follow_up, is_completed, created_by, created_by_name, updated_by, updated_by_name, created_at, updated_at'
    )
    .single();

  if (error || !data) {
    return { error: mapAuthErrorMessage(error?.message || 'Gagal menyimpan laporan ke Supabase.') };
  }

  return { report: mapDbRowToReport(data as DbHandoverRow) };
}

export async function updateReportUnified(
  mode: 'supabase' | 'demo',
  reportId: string,
  input: HandoverFormInput,
  user: UserProfile
): Promise<{ report?: HandoverReport; error?: string }> {
  const validation = validateHandoverInput(input);
  if (!validation.valid) {
    const firstErr = Object.values(validation.errors)[0] || 'Data laporan tidak valid.';
    return { error: firstErr };
  }

  if (mode === 'demo') {
    const reports = getDemoReports();
    const idx = reports.findIndex((r) => r.id === reportId);
    if (idx === -1) {
      return { error: 'Laporan tidak ditemukan.' };
    }
    const existing = reports[idx];
    const isAllowed =
      user.role === 'admin' ||
      user.role === 'supervisor' ||
      user.canEditAll ||
      existing.createdBy === user.id;

    if (!isAllowed) {
      return { error: 'Anda tidak memiliki izin untuk mengedit laporan pengguna lain.' };
    }

    const updated: HandoverReport = {
      ...existing,
      reportDate: input.reportDate,
      shift: input.shift,
      category: input.category,
      machine: validation.sanitizedMachine,
      information: input.information.trim(),
      issue: input.issue.trim(),
      followUp: input.followUp.trim(),
      isCompleted: Boolean(input.isCompleted),
      updatedBy: user.id,
      updatedByName: user.fullName,
      updatedAt: new Date().toISOString(),
    };
    reports[idx] = updated;
    saveDemoReports(reports);
    return { report: updated };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { error: 'Klien Supabase tidak tersedia.' };
  }

  const { data, error } = await client
    .from('handover_reports')
    .update({
      report_date: input.reportDate,
      shift: input.shift,
      category: input.category,
      machine: validation.sanitizedMachine,
      information: input.information.trim(),
      issue: input.issue.trim(),
      follow_up: input.followUp.trim(),
      is_completed: Boolean(input.isCompleted),
      updated_by: user.id,
      updated_by_name: user.fullName,
    })
    .eq('id', reportId)
    .select(
      'id, report_date, shift, category, machine, information, issue, follow_up, is_completed, created_by, created_by_name, updated_by, updated_by_name, created_at, updated_at'
    )
    .single();

  if (error || !data) {
    return {
      error: mapAuthErrorMessage(
        error?.message || 'Gagal memperbarui laporan. Pastikan Anda memiliki izin edit.'
      ),
    };
  }

  return { report: mapDbRowToReport(data as DbHandoverRow) };
}

export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      ok: false,
      message: 'Publishable Key belum diisi. Masukkan key di kolom di atas terlebih dahulu.',
    };
  }

  try {
    const { error } = await client.auth.getSession();
    if (error) {
      return { ok: false, message: mapAuthErrorMessage(error.message) };
    }
    const { error: dbError, status } = await client
      .from('handover_reports')
      .select('id')
      .limit(1);

    if (dbError || status === 404) {
      const msg = (dbError?.message || '').toLowerCase();
      const code = dbError?.code || '';
      if (
        status === 404 ||
        code === 'PGRST205' ||
        code === '42P01' ||
        msg.includes('relation') ||
        msg.includes('does not exist') ||
        msg.includes('schema cache')
      ) {
        return {
          ok: false,
          message:
            'Koneksi Auth Supabase terhubung, namun tabel handover_reports & profiles belum dibuat. Jalankan isi file supabase-schema.sql di Supabase SQL Editor terlebih dahulu.',
        };
      }
      if (status === 401 || status === 403 || msg.includes('permission denied') || msg.includes('rls')) {
        return {
          ok: true,
          message:
            'Koneksi Supabase & RLS aktif terdeteksi. Silakan login dengan akun terdaftar untuk membaca data.',
        };
      }
      return { ok: false, message: dbError?.message || `Gagal mengecek tabel (HTTP ${status}).` };
    }

    return {
      ok: true,
      message: 'Koneksi Supabase Cloud dan tabel handover_reports siap digunakan.',
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Gagal menghubungi server Supabase.',
    };
  }
}
