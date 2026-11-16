import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type {
  CategoryType,
  HandoverFormInput,
  HandoverReport,
  ShiftType,
  UserProfile,
  UserRole,
} from '../types/handover';
import { canSubmitReport, validateHandoverInput } from '../utils/handoverLogic';

export const DEFAULT_SUPABASE_URL = 'https://dkyjfoxruqoqlhxrmcac.supabase.co';
const LEGACY_LOCAL_KEYS = [
  'ms_handover_demo_reports_v1',
  'ms_handover_demo_reports_v2',
  'ms_handover_demo_session_v1',
  'ms_handover_supabase_config_v1',
];

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
  pallet_location?: string | null;
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
  can_edit_all: boolean;
}

export function clearLegacyDemoStorage(): void {
  if (typeof window === 'undefined') return;
  for (const key of LEGACY_LOCAL_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore storage access issues
    }
  }
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
    palletLocation: row.pallet_location ?? '',
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

function stripQuotes(val: string): string {
  return val
    .trim()
    .replace(/^(?:VITE_)?SUPABASE_[A-Z0-9_]*\s*=\s*/i, '')
    .replace(/^["']+|["']+$/g, '')
    .trim();
}

export function getSupabaseConfigIssue(): 'missing' | 'secret_key' | null {
  const rawKey = stripQuotes(
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || ''
  );
  if (!rawKey || rawKey === 'YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY') {
    return 'missing';
  }
  if (isDangerousSecretKey(rawKey)) {
    return 'secret_key';
  }
  return null;
}

export function getSupabaseEnvConfig(): SupabaseConfig {
  const envUrl = stripQuotes((import.meta.env.VITE_SUPABASE_URL as string | undefined) || '');
  const envKey = stripQuotes(
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || ''
  );

  const url = envUrl || DEFAULT_SUPABASE_URL;
  const validKey =
    envKey && envKey !== 'YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY' && !isDangerousSecretKey(envKey)
      ? envKey
      : '';

  return { url, publishableKey: validKey };
}

export function isSupabaseConfigured(): boolean {
  const cfg = getSupabaseEnvConfig();
  return Boolean(cfg.url && cfg.publishableKey);
}

let cachedClient: SupabaseClient | null = null;
let cachedClientKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const cfg = getSupabaseEnvConfig();
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
    return 'Email akun belum dikonfirmasi. Cek inbox email Anda atau konfirmasi manual di Supabase Authentication → Users.';
  }
  if (lower.includes('signups not allowed')) {
    return 'Pendaftaran akun mandiri sedang dinonaktifkan oleh Admin.';
  }
  if (lower.includes('user already registered')) {
    return 'Email ini sudah terdaftar. Silakan login dengan akun tersebut.';
  }
  if (lower.includes('database error saving new user')) {
    return 'Database Supabase gagal menyimpan profil user baru (trigger handle_new_user belum sinkron dengan tabel profiles). Jalankan ulang isi file supabase-schema.sql terbaru di Supabase SQL Editor.';
  }
  if (
    lower.includes('schema cache') ||
    lower.includes('does not exist') ||
    lower.includes('pgrst205')
  ) {
    return 'Tabel database Supabase belum dibuat. Jalankan isi file supabase-schema.sql di Supabase SQL Editor terlebih dahulu.';
  }
  if (lower.includes('jwt') || lower.includes('expired') || lower.includes('refresh_token')) {
    return 'Sesi login Anda telah berakhir. Silakan login ulang.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Gagal terhubung ke server Supabase. Periksa koneksi internet Anda.';
  }
  return message;
}

// ============================================================================
// Supabase Auth & Data Operations
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

  const { data, error } = await client
    .from('profiles')
    .select('id, email, full_name, role, can_edit_all')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data) {
    return {
      id: user.id,
      email: user.email ?? '',
      fullName: fallbackName,
      role: 'operator',
      canEditAll: false,
    };
  }

  const row = data as DbProfileRow;
  return {
    id: row.id,
    email: row.email || user.email || '',
    fullName: row.full_name || fallbackName,
    role: row.role || 'operator',
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
      error:
        'Konfigurasi environment VITE_SUPABASE_PUBLISHABLE_KEY belum terpasang pada build aplikasi ini.',
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
  role: UserRole;
}): Promise<{ user?: UserProfile; needsEmailConfirm?: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      error:
        'Konfigurasi environment VITE_SUPABASE_PUBLISHABLE_KEY belum terpasang pada build aplikasi ini.',
    };
  }

  const redirectUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : undefined;

  const { data, error } = await client.auth.signUp({
    email: params.email.trim(),
    password: params.password,
    options: {
      emailRedirectTo: redirectUrl,
      data: {
        full_name: params.fullName.trim(),
        role: params.role,
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

export async function signOutSupabase(): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    await client.auth.signOut();
  }
}

export async function loadProfilesSupabase(): Promise<{
  profiles: UserProfile[];
  error?: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return { profiles: [], error: 'Konfigurasi Supabase belum terpasang di build.' };
  }

  const { data, error } = await client
    .from('profiles')
    .select('id, email, full_name, role, can_edit_all')
    .order('full_name', { ascending: true });

  if (error) {
    return { profiles: [], error: mapAuthErrorMessage(error.message) };
  }

  return {
    profiles: ((data ?? []) as DbProfileRow[]).map((row) => ({
      id: row.id,
      email: row.email ?? '',
      fullName: row.full_name || 'Operator',
      role: row.role || 'operator',
      canEditAll: Boolean(row.can_edit_all),
    })),
  };
}

const REPORT_SELECT_WITH_PALLET =
  'id, report_date, shift, category, machine, information, issue, follow_up, pallet_location, is_completed, created_by, created_by_name, updated_by, updated_by_name, created_at, updated_at';

const REPORT_SELECT_LEGACY =
  'id, report_date, shift, category, machine, information, issue, follow_up, is_completed, created_by, created_by_name, updated_by, updated_by_name, created_at, updated_at';

function isMissingPalletColumnError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message ?? '').toLowerCase();
  return (err.code === '42703' || err.code === 'PGRST204') && msg.includes('pallet_location');
}

export async function loadReportsSupabase(): Promise<{
  reports: HandoverReport[];
  error?: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return { reports: [], error: 'Konfigurasi Supabase belum terpasang di build.' };
  }

  let { data, error } = await client
    .from('handover_reports')
    .select(REPORT_SELECT_WITH_PALLET)
    .order('report_date', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error && isMissingPalletColumnError(error)) {
    const fallback = await client
      .from('handover_reports')
      .select(REPORT_SELECT_LEGACY)
      .order('report_date', { ascending: false })
      .order('updated_at', { ascending: false });
    data = fallback.data as typeof data;
    error = fallback.error;
  }

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

export async function createReportSupabase(
  input: HandoverFormInput,
  user: UserProfile
): Promise<{ report?: HandoverReport; error?: string }> {
  const permission = canSubmitReport({
    user,
    input,
    editingReport: null,
  });
  if (!permission.allowed) {
    return { error: permission.reason || 'Anda tidak memiliki izin membuat laporan ini.' };
  }

  const validation = validateHandoverInput(input);
  if (!validation.valid) {
    const firstErr = Object.values(validation.errors)[0] || 'Data laporan tidak valid.';
    return { error: firstErr };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { error: 'Klien Supabase tidak tersedia.' };
  }

  const trimmedPallet = (input.palletLocation ?? '').trim();
  const basePayload = {
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
  };

  let { data, error } = await client
    .from('handover_reports')
    .insert({ ...basePayload, pallet_location: trimmedPallet })
    .select(REPORT_SELECT_WITH_PALLET)
    .single();

  if (error && isMissingPalletColumnError(error)) {
    if (trimmedPallet) {
      return {
        error:
          'Kolom Lokasi Palet (pallet_location) belum ada di Supabase. Jalankan ulang supabase-schema.sql di Supabase SQL Editor.',
      };
    }
    const fallback = await client
      .from('handover_reports')
      .insert(basePayload)
      .select(REPORT_SELECT_LEGACY)
      .single();
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error || !data) {
    return {
      error: mapAuthErrorMessage(error?.message || 'Gagal menyimpan laporan ke Supabase.'),
    };
  }

  return { report: mapDbRowToReport(data as DbHandoverRow) };
}

export async function updateReportSupabase(
  reportId: string,
  input: HandoverFormInput,
  user: UserProfile,
  existingReport?: HandoverReport
): Promise<{ report?: HandoverReport; error?: string }> {
  if (existingReport) {
    const permission = canSubmitReport({
      user,
      input,
      editingReport: existingReport,
    });
    if (!permission.allowed) {
      return { error: permission.reason || 'Anda tidak memiliki izin mengedit laporan ini.' };
    }
  }

  const validation = validateHandoverInput(input);
  if (!validation.valid) {
    const firstErr = Object.values(validation.errors)[0] || 'Data laporan tidak valid.';
    return { error: firstErr };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { error: 'Klien Supabase tidak tersedia.' };
  }

  const trimmedPallet = (input.palletLocation ?? '').trim();
  const basePayload = {
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
  };

  let { data, error } = await client
    .from('handover_reports')
    .update({ ...basePayload, pallet_location: trimmedPallet })
    .eq('id', reportId)
    .select(REPORT_SELECT_WITH_PALLET)
    .single();

  if (error && isMissingPalletColumnError(error)) {
    if (trimmedPallet) {
      return {
        error:
          'Kolom Lokasi Palet (pallet_location) belum ada di Supabase. Jalankan ulang supabase-schema.sql di Supabase SQL Editor.',
      };
    }
    const fallback = await client
      .from('handover_reports')
      .update(basePayload)
      .eq('id', reportId)
      .select(REPORT_SELECT_LEGACY)
      .single();
    data = fallback.data as typeof data;
    error = fallback.error;
  }

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
      message:
        'VITE_SUPABASE_PUBLISHABLE_KEY belum terpasang pada build aplikasi ini.',
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
