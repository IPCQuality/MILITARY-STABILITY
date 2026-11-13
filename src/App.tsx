import { useCallback, useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
} from 'lucide-react';
import type {
  HandoverFormInput,
  HandoverReport,
  HistoryFilters,
  NavSection,
  UserProfile,
} from './types/handover';
import {
  createReportUnified,
  fetchUserProfileFromSupabase,
  getDemoSessionUser,
  getSupabaseClient,
  isSupabaseConfigured,
  loadReportsUnified,
  signInDemoAccount,
  signOutUnified,
  updateReportUnified,
} from './services/handoverService';
import { AuthView } from './components/AuthView';
import { DashboardView } from './components/DashboardView';
import { HandoverFormView } from './components/HandoverFormView';
import { HistoryView } from './components/HistoryView';
import { ExportView } from './components/ExportView';
import { SettingsView } from './components/SettingsView';
import { ReportDetailModal } from './components/ReportDetailModal';
import { DEMO_ACCOUNTS } from './utils/demoSeed';
import { getCurrentShiftStatus } from './utils/handoverLogic';

const PRIMARY_TABS: {
  id: Exclude<NavSection, 'input'>;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'history', label: 'History', icon: History },
  { id: 'export', label: 'Report', icon: FileSpreadsheet },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authMode, setAuthMode] = useState<'supabase' | 'demo'>('demo');
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [reports, setReports] = useState<HandoverReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedReport, setSelectedReport] = useState<HandoverReport | null>(null);
  const [editingReport, setEditingReport] = useState<HandoverReport | null>(null);
  const [formPreset, setFormPreset] = useState<Partial<HandoverFormInput> | null>(null);

  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>({
    date: '',
    shift: 'ALL',
    category: 'ALL',
    keyword: '',
  });

  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [headerNow, setHeaderNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setHeaderNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const showToast = useCallback((ok: boolean, text: string) => {
    setToast({ ok, text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const fetchReports = useCallback(
    async (mode: 'supabase' | 'demo') => {
      setLoadingReports(true);
      try {
        const res = await loadReportsUnified(mode);
        if (res.error) {
          showToast(false, res.error);
        }
        setReports(res.reports);
      } finally {
        setLoadingReports(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    let active = true;
    let subscription: { unsubscribe: () => void } | null = null;

    async function initAuth() {
      const params = new URLSearchParams(window.location.search);
      const autoStart = params.get('autostart') === '1';

      if (isSupabaseConfigured()) {
        const client = getSupabaseClient();
        if (client) {
          const { data: listener } = client.auth.onAuthStateChange(async (event, session) => {
            if (!active) return;
            if (event === 'SIGNED_OUT') {
              setCurrentUser(null);
              setReports([]);
              setSessionNotice('Anda telah keluar atau sesi login berakhir.');
            } else if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
              const profile = await fetchUserProfileFromSupabase(client, session);
              if (!active) return;
              setCurrentUser(profile);
              setAuthMode('supabase');
              setSessionNotice(null);
            }
          });
          subscription = listener.subscription;

          const { data, error } = await client.auth.getSession();
          if (!active) return;

          if (error) {
            setSessionNotice('Sesi Anda telah berakhir. Silakan login kembali.');
          } else if (data.session) {
            const profile = await fetchUserProfileFromSupabase(client, data.session);
            if (!active) return;
            setCurrentUser(profile);
            setAuthMode('supabase');
            await fetchReports('supabase');
            setInitializing(false);
            return;
          }
        }
      }

      const demoUser = getDemoSessionUser();
      if (demoUser) {
        setCurrentUser(demoUser);
        setAuthMode('demo');
        await fetchReports('demo');
      } else if (autoStart) {
        const defaultDemo = signInDemoAccount(DEMO_ACCOUNTS[0].email);
        setCurrentUser(defaultDemo);
        setAuthMode('demo');
        await fetchReports('demo');
      }

      if (active) setInitializing(false);
    }

    initAuth();

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [fetchReports]);

  async function handleAuthenticated(user: UserProfile, mode: 'supabase' | 'demo') {
    setSessionNotice(null);
    setCurrentUser(user);
    setAuthMode(mode);
    setActiveNav('dashboard');
    await fetchReports(mode);
  }

  async function handleLogout() {
    await signOutUnified(authMode);
    setCurrentUser(null);
    setReports([]);
    setEditingReport(null);
    setSelectedReport(null);
    setActiveNav('dashboard');
  }

  async function handleSubmitReport(
    input: HandoverFormInput,
    editingId: string | null
  ): Promise<{ ok: boolean; error?: string }> {
    if (!currentUser) {
      return { ok: false, error: 'Sesi pengguna tidak ditemukan.' };
    }

    if (editingId) {
      const res = await updateReportUnified(authMode, editingId, input, currentUser);
      if (res.error || !res.report) {
        showToast(false, res.error || 'Gagal memperbarui laporan.');
        return { ok: false, error: res.error };
      }
      await fetchReports(authMode);
      setEditingReport(null);
      setFormPreset(null);
      setActiveNav('dashboard');
      showToast(true, 'Laporan berhasil diperbarui dan disinkronkan.');
      return { ok: true };
    }

    const res = await createReportUnified(authMode, input, currentUser);
    if (res.error || !res.report) {
      showToast(false, res.error || 'Gagal menyimpan laporan.');
      return { ok: false, error: res.error };
    }

    await fetchReports(authMode);
    setFormPreset(null);
    setActiveNav('dashboard');
    showToast(true, 'Laporan handover berhasil disimpan.');
    return { ok: true };
  }

  function handleStartEdit(report: HandoverReport) {
    setSelectedReport(null);
    setFormPreset(null);
    setEditingReport(report);
    setActiveNav('input');
  }

  function handleCreatePreset(preset: Partial<HandoverFormInput>) {
    setEditingReport(null);
    setFormPreset(preset);
    setActiveNav('input');
  }

  function openFloatingInput() {
    setEditingReport(null);
    setFormPreset(null);
    setActiveNav('input');
  }

  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold text-slate-800">MILITARY &amp; STABILITY</p>
          <p className="text-xs text-slate-500">Memuat sesi aplikasi...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthView onAuthenticated={handleAuthenticated} sessionNotice={sessionNotice} />;
  }

  const activeLabel =
    activeNav === 'input'
      ? editingReport
        ? 'Edit Handover'
        : 'Input Handover'
      : PRIMARY_TABS.find((t) => t.id === activeNav)?.label ?? 'Dashboard';

  const headerShiftStatus = getCurrentShiftStatus(headerNow);
  const headerShiftLabel =
    headerShiftStatus.activeShifts.length > 0
      ? headerShiftStatus.primaryShift
      : 'Di luar jam shift';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col md:flex-row">
      {/* Desktop Sidebar (4 tab sederhana + tombol Input) */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-slate-200 z-30">
        <div className="px-5 py-5 border-b border-slate-200">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
            Shift Handover
          </p>
          <h1 className="mt-1 text-base font-bold tracking-tight text-[#0F294A]">
            MILITARY &amp; STABILITY
          </h1>
        </div>

        <nav aria-label="Navigasi Utama" className="flex-1 p-3 space-y-1">
          {PRIMARY_TABS.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setEditingReport(null);
                  setActiveNav(item.id);
                }}
                aria-current={active ? 'page' : undefined}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-lg text-left text-sm font-medium flex items-center gap-3 transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#0F294A] text-white font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="text-xs">
            <p className="font-semibold text-slate-900 truncate">{currentUser.fullName}</p>
            <p className="text-slate-500 font-mono text-[11px]">
              {currentUser.defaultShift} · {currentUser.role}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-60 flex flex-col min-w-0">
        {/* Compact Top Web Header */}
        <header className="sticky top-0 z-20 min-h-[54px] py-2 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-bold tracking-wide text-[#0F294A] truncate">
                MILITARY &amp; STABILITY
              </span>
              <span className="hidden md:inline text-xs text-slate-300">/</span>
              <span className="hidden md:inline text-xs font-medium text-slate-600 whitespace-nowrap">
                {activeLabel}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-600 font-medium truncate">
              {headerShiftStatus.dateFormatted} ·{' '}
              <span className="text-[#0F294A] font-semibold">{headerShiftLabel}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline text-xs text-slate-500 truncate max-w-[160px]">
              {currentUser.fullName}
            </span>
            <button
              type="button"
              onClick={() => fetchReports(authMode)}
              aria-label="Sinkronkan Data Terbaru"
              className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingReports ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sinkronkan</span>
            </button>
          </div>
        </header>

        {/* Feedback Toast */}
        {toast && (
          <div className="px-4 sm:px-6 pt-3">
            <div
              role="status"
              className={`max-w-4xl mx-auto p-3 rounded-lg border text-sm flex items-center justify-between gap-3 ${
                toast.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <span>{toast.text}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="text-xs font-semibold underline shrink-0"
              >
                Tutup
              </button>
            </div>
          </div>
        )}

        {/* Active View */}
        <main className="flex-1 px-3 sm:px-6 py-4 sm:py-6 pb-28 md:pb-16 max-w-6xl w-full mx-auto">
          {activeNav === 'dashboard' && (
            <DashboardView
              reports={reports}
              loading={loadingReports}
              onSelectReport={setSelectedReport}
              onCreatePreset={handleCreatePreset}
            />
          )}

          {activeNav === 'input' && (
            <HandoverFormView
              currentUser={currentUser}
              editingReport={editingReport}
              presetValues={formPreset}
              onSubmitReport={handleSubmitReport}
              onCancel={() => {
                setEditingReport(null);
                setFormPreset(null);
                setActiveNav('dashboard');
              }}
            />
          )}

          {activeNav === 'history' && (
            <HistoryView
              reports={reports}
              loading={loadingReports}
              currentUser={currentUser}
              filters={historyFilters}
              onChangeFilters={setHistoryFilters}
              onSelectReport={setSelectedReport}
              onEditReport={handleStartEdit}
            />
          )}

          {activeNav === 'export' && (
            <ExportView
              mode={authMode}
              reports={reports}
              onRefreshReports={setReports}
            />
          )}

          {activeNav === 'settings' && (
            <SettingsView
              currentUser={currentUser}
              mode={authMode}
              onSwitchDemoUser={async (user) => {
                setCurrentUser(user);
                await fetchReports('demo');
                showToast(true, `Beralih ke akun ${user.fullName} (${user.defaultShift}).`);
              }}
              onResetDemo={async () => {
                await fetchReports('demo');
              }}
              onLogout={handleLogout}
            />
          )}
        </main>
      </div>

      {/* Float + Button (Hanya SVG + saja sesuai instruksi) */}
      {activeNav !== 'input' && !selectedReport && (
        <button
          type="button"
          onClick={openFloatingInput}
          aria-label="Input Handover Baru"
          className="fixed bottom-20 right-4 md:bottom-7 md:right-7 z-30 w-13 h-13 rounded-full bg-[#0F294A] hover:bg-[#163864] active:scale-[0.96] text-white shadow-lg shadow-slate-900/25 flex items-center justify-center transition-transform"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      )}

      {/* Mobile Bottom Navigation Bar: 4 Tabs exact as wireframe */}
      <nav
        aria-label="Navigasi Mobile"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-white/95 backdrop-blur-md border-t border-slate-300 grid grid-cols-4 items-center"
      >
        {PRIMARY_TABS.map((item) => {
          const Icon = item.icon;
          const active = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setEditingReport(null);
                setActiveNav(item.id);
              }}
              aria-current={active ? 'page' : undefined}
              className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-1 px-1 text-xs transition-colors border-r last:border-r-0 border-slate-200 ${
                active ? 'text-[#0F294A] font-bold bg-slate-50' : 'text-slate-600 font-medium'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-full">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Detail Modal */}
      <ReportDetailModal
        report={selectedReport}
        currentUser={currentUser}
        onClose={() => setSelectedReport(null)}
        onEdit={handleStartEdit}
      />
    </div>
  );
}
