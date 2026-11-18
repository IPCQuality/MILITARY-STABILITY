import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  ArrowLeft,
  Clock,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  ShieldAlert,
} from 'lucide-react';
import type {
  HandoverFormInput,
  HandoverReport,
  HistoryFilters,
  NavSection,
  UserProfile,
} from './types/handover';
import { auth, db } from './lib/firebase';
import {
  clearLegacyDemoStorage,
  createReportFirebase,
  ensureFirebaseUserProfile,
  loadReportsFirebase,
  normalizeApprovalStatus,
  normalizeUserRole,
  PRIMARY_ADMIN_EMAIL,
  signOutFirebase,
  subscribeReportsFirebase,
  updateReportFirebase,
} from './services/handoverService';
import { AuthView } from './components/AuthView';
import { BrandLogo } from './components/BrandLogo';
import { DashboardView } from './components/DashboardView';
import { HandoverFormView } from './components/HandoverFormView';
import { HistoryView } from './components/HistoryView';
import { ExportView } from './components/ExportView';
import { SettingsView } from './components/SettingsView';
import { AdminView } from './components/AdminView';
import { ReportDetailModal } from './components/ReportDetailModal';
import { getCurrentShiftStatus, mapAuthErrorMessage } from './utils/handoverLogic';

const PRIMARY_TABS: {
  id: Exclude<NavSection, 'input' | 'admin'>;
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
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
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
  const [checkingApproval, setCheckingApproval] = useState(false);

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

  const fetchReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const res = await loadReportsFirebase();
      if (res.error) {
        showToast(false, res.error);
      }
      setReports(res.reports);
    } finally {
      setLoadingReports(false);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    clearLegacyDemoStorage();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!active) return;

      if (!firebaseUser) {
        setCurrentUser(null);
        setReports([]);
        setAuthReady(true);
        setInitializing(false);
        return;
      }

      if (!firebaseUser.emailVerified) {
        setCurrentUser(null);
        setReports([]);
        setSessionNotice(
          'Email akun Anda belum diverifikasi. Cek inbox email Anda untuk mengaktifkan akun.'
        );
        setAuthReady(true);
        setInitializing(false);
        return;
      }

      try {
        const profile = await ensureFirebaseUserProfile(firebaseUser);
        if (!active) return;
        setCurrentUser(profile);
        setSessionNotice(null);
      } catch (err) {
        if (!active) return;
        const msg =
          err instanceof Error
            ? mapAuthErrorMessage(err.message)
            : 'Gagal memuat profil pengguna dari Firestore.';
        setSessionNotice(msg);
        setCurrentUser(null);
      } finally {
        if (active) {
          setAuthReady(true);
          setInitializing(false);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Dengarkan perubahan status persetujuan & role akun secara real-time
  useEffect(() => {
    if (!authReady || !currentUser?.id) {
      return;
    }

    const userRef = doc(db, 'users', currentUser.id);
    const unsubscribe = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const email = String(data.email || currentUser.email || '');
        const isPrimaryAdmin = email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
        const nextRole = isPrimaryAdmin
          ? 'admin'
          : normalizeUserRole(typeof data.role === 'string' ? data.role : undefined);
        const nextApproval = normalizeApprovalStatus(
          typeof data.approvalStatus === 'string' ? data.approvalStatus : undefined,
          isPrimaryAdmin
        );
        const nextCanEditAll =
          Boolean(data.canEditAll) || isPrimaryAdmin || nextRole !== 'pengawas';
        const nextName = String(data.fullName || currentUser.fullName);

        setCurrentUser((prev) => {
          if (!prev) return prev;
          const nextPhoto = auth.currentUser?.photoURL ?? prev.photoURL ?? null;
          if (
            prev.role === nextRole &&
            prev.approvalStatus === nextApproval &&
            prev.canEditAll === nextCanEditAll &&
            prev.fullName === nextName &&
            prev.photoURL === nextPhoto
          ) {
            return prev;
          }
          return {
            ...prev,
            fullName: nextName,
            role: nextRole,
            canEditAll: nextCanEditAll,
            approvalStatus: nextApproval,
            photoURL: nextPhoto,
          };
        });
      },
      () => {
        // Abaikan error listener profil transient
      }
    );

    return () => {
      unsubscribe();
    };
  }, [authReady, currentUser?.id, currentUser?.email, currentUser?.fullName]);

  // Pasang real-time listener Firestore hanya setelah auth siap & user disetujui Admin
  useEffect(() => {
    if (!authReady || !currentUser || currentUser.approvalStatus !== 'approved') {
      setReports([]);
      setLoadingReports(false);
      return;
    }

    setLoadingReports(true);
    const unsubscribe = subscribeReportsFirebase(
      (nextReports) => {
        setReports(nextReports);
        setLoadingReports(false);
      },
      (errMessage) => {
        setLoadingReports(false);
        showToast(false, errMessage);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [authReady, currentUser?.id, currentUser?.approvalStatus, showToast]);

  function handleAuthenticated(user: UserProfile) {
    setSessionNotice(null);
    setCurrentUser(user);
    setAuthReady(true);
    setActiveNav('dashboard');
  }

  async function handleRefreshApprovalStatus() {
    if (!auth.currentUser) return;
    setCheckingApproval(true);
    try {
      const updated = await ensureFirebaseUserProfile(auth.currentUser);
      setCurrentUser(updated);
      if (updated.approvalStatus === 'pending') {
        showToast(false, 'Akun Anda masih menunggu konfirmasi Admin.');
      } else if (updated.approvalStatus === 'rejected') {
        showToast(false, 'Pendaftaran akun Anda ditolak oleh Admin.');
      } else {
        showToast(true, 'Akun telah disetujui. Selamat datang!');
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? mapAuthErrorMessage(err.message)
          : 'Gagal memeriksa status persetujuan akun.';
      showToast(false, msg);
    } finally {
      setCheckingApproval(false);
    }
  }

  async function handleLogout() {
    await signOutFirebase();
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
      const res = await updateReportFirebase(
        editingId,
        input,
        currentUser,
        editingReport ?? undefined
      );
      if (res.error || !res.report) {
        showToast(false, res.error || 'Gagal memperbarui laporan.');
        return { ok: false, error: res.error };
      }
      setEditingReport(null);
      setFormPreset(null);
      setActiveNav('dashboard');
      showToast(true, 'Laporan berhasil diperbarui dan disinkronkan.');
      return { ok: true };
    }

    const res = await createReportFirebase(input, currentUser);
    if (res.error || !res.report) {
      showToast(false, res.error || 'Gagal menyimpan laporan.');
      return { ok: false, error: res.error };
    }

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
        <div className="text-center flex flex-col items-center gap-2.5">
          <BrandLogo size={36} />
          <p className="text-sm font-bold text-[#0F294A] tracking-tight">MILITARY &amp; STABILITY</p>
          <p className="text-xs text-slate-500">Memuat sesi aplikasi...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthView onAuthenticated={handleAuthenticated} sessionNotice={sessionNotice} />;
  }

  if (currentUser.approvalStatus !== 'approved') {
    const isRejected = currentUser.approvalStatus === 'rejected';
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col justify-center py-8 px-4 sm:px-6">
        <div className="max-w-md w-full mx-auto space-y-4">
          <div className="bg-[#0F294A] text-white rounded-xl px-6 py-5 border border-slate-800 shadow-xs flex items-center gap-3.5">
            <BrandLogo size={36} variant="light" />
            <div className="min-w-0">
              <p className="text-[11px] font-mono tracking-wider text-slate-300 uppercase">
                Shift Handover Log
              </p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight truncate">
                MILITARY &amp; STABILITY
              </h1>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-300 p-6 space-y-5 shadow-xs">
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-lg border shrink-0 ${
                  isRejected
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}
              >
                {isRejected ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : (
                  <Clock className="w-5 h-5" />
                )}
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {isRejected
                    ? 'Pendaftaran Akun Ditolak'
                    : 'Menunggu Konfirmasi Admin'}
                </h2>
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                  {isRejected
                    ? 'Permintaan pendaftaran akun Anda tidak disetujui oleh Admin. Hubungi Admin jika ini adalah kekeliruan.'
                    : 'Pendaftaran akun Anda berhasil dicatat, namun akses ke data Shift Handover menunggu persetujuan Admin terlebih dahulu.'}
                </p>
              </div>
            </div>

            {toast && (
              <div
                role="status"
                className={`p-3 rounded-lg border text-xs sm:text-sm ${
                  toast.ok
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                {toast.text}
              </div>
            )}

            <dl className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Nama</dt>
                <dd className="font-semibold text-slate-900">{currentUser.fullName}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Email</dt>
                <dd className="font-mono text-slate-800 break-all text-right">
                  {currentUser.email}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Status</dt>
                <dd
                  className={`font-semibold ${
                    isRejected ? 'text-rose-700' : 'text-amber-700'
                  }`}
                >
                  {isRejected ? 'Ditolak Admin' : 'Menunggu Persetujuan'}
                </dd>
              </div>
            </dl>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                disabled={checkingApproval}
                onClick={handleRefreshApprovalStatus}
                className="flex-1 min-h-[44px] px-5 py-2.5 rounded-full bg-[#0F294A] hover:bg-[#163864] disabled:opacity-50 text-white text-sm font-semibold shadow-sm shadow-[#0F294A]/20 hover:shadow-md active:scale-[0.98] inline-flex items-center justify-center gap-2 transition-all"
              >
                <RefreshCw
                  className={`w-4 h-4 ${checkingApproval ? 'animate-spin' : ''}`}
                />
                Periksa Status
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="min-h-[44px] px-5 py-2.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold shadow-xs hover:shadow-sm active:scale-[0.98] inline-flex items-center justify-center gap-2 transition-all"
              >
                <LogOut className="w-4 h-4" />
                Keluar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeLabel =
    activeNav === 'admin'
      ? 'Menu Admin'
      : activeNav === 'input'
        ? editingReport
          ? 'Edit Handover'
          : 'Input Handover'
        : PRIMARY_TABS.find((t) => t.id === activeNav)?.label ?? 'Dashboard';

  const isSubPage = activeNav === 'input' || activeNav === 'admin';

  function handleHeaderBack() {
    if (activeNav === 'admin') {
      setActiveNav('settings');
      return;
    }
    setEditingReport(null);
    setFormPreset(null);
    setActiveNav('dashboard');
  }

  const headerShiftStatus = getCurrentShiftStatus(headerNow);
  const headerShiftLabel =
    headerShiftStatus.activeShifts.length > 0
      ? headerShiftStatus.primaryShift
      : 'Di luar jam shift';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-slate-200 z-40">
        <div className="h-[60px] px-4 border-b border-slate-200 flex items-center gap-2.5 shrink-0">
          <BrandLogo size={28} />
          <div className="min-w-0 leading-tight">
            <p className="text-[10px] font-mono tracking-wider text-slate-500 uppercase truncate">
              Shift Handover
            </p>
            <span className="block text-sm font-bold tracking-tight text-[#0F294A] truncate">
              MILITARY &amp; STABILITY
            </span>
          </div>
        </div>

        <nav aria-label="Navigasi Utama" className="flex-1 px-3 py-4 space-y-1.5">
          {PRIMARY_TABS.map((item) => {
            const Icon = item.icon;
            const active =
              activeNav === item.id ||
              (item.id === 'settings' && activeNav === 'admin');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setEditingReport(null);
                  setFormPreset(null);
                  setActiveNav(item.id);
                }}
                aria-current={active ? 'page' : undefined}
                className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl text-left text-sm font-medium flex items-center gap-3 transition-all active:scale-[0.98] whitespace-nowrap ${
                  active
                    ? 'bg-[#0F294A] text-white font-semibold shadow-sm shadow-[#0F294A]/20'
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
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{currentUser.fullName}</p>
            <p className="text-xs text-slate-500 capitalize">
              {currentUser.role}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full min-h-[40px] px-4 py-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs hover:shadow-sm active:scale-[0.98] inline-flex items-center justify-center gap-2 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-60 flex flex-col min-w-0">
        {/* Fixed Uniform Top Header (Never Scrolls) */}
        <header className="fixed top-0 left-0 right-0 md:left-60 z-30 h-[60px] bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {isSubPage ? (
              <button
                type="button"
                onClick={handleHeaderBack}
                aria-label="Kembali"
                className="w-9 h-9 -ml-1.5 rounded-lg hover:bg-slate-100 active:scale-[0.96] text-slate-700 flex items-center justify-center shrink-0 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <BrandLogo size={26} className="md:hidden" />
            )}
            <div className="min-w-0 leading-tight">
              <h1 className="text-[13px] sm:text-sm font-bold tracking-tight truncate">
                <span className="text-[#0F294A]">MILITARY &amp; STABILITY</span>
                <span className="text-slate-400 font-normal">/</span>
                <span className="text-slate-800">{activeLabel}</span>
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate mt-0.5">
                {headerShiftStatus.dateFormatted}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="hidden sm:inline text-xs font-semibold text-[#0F294A] whitespace-nowrap">
              {headerShiftLabel}
            </span>
            <button
              type="button"
              onClick={() => fetchReports()}
              aria-label="Sinkronkan Data Terbaru"
              className="min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs hover:shadow-sm active:scale-[0.97] inline-flex items-center gap-1.5 whitespace-nowrap transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingReports ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sinkronkan</span>
            </button>
          </div>
        </header>

        {/* Active View — directly below fixed header without sub-headers */}
        <main className="flex-1 px-4 sm:px-6 pt-[76px] sm:pt-[80px] pb-28 md:pb-12 max-w-6xl w-full mx-auto">
          {/* Feedback Toast */}
          {toast && (
            <div
              role="status"
              className={`mb-4 p-3 rounded-lg border text-sm flex items-center justify-between gap-3 ${
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
          )}

          {activeNav === 'dashboard' && (
            <DashboardView
              reports={reports}
              loading={loadingReports}
              currentUser={currentUser}
              onSelectReport={setSelectedReport}
              onCreatePreset={handleCreatePreset}
            />
          )}

          {activeNav === 'input' && (
            <HandoverFormView
              currentUser={currentUser}
              reports={reports}
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
              reports={reports}
              onRefreshReports={setReports}
            />
          )}

          {activeNav === 'settings' && (
            <SettingsView
              currentUser={currentUser}
              onLogout={handleLogout}
              onOpenAdmin={
                currentUser.role === 'admin'
                  ? () => setActiveNav('admin')
                  : undefined
              }
            />
          )}

          {activeNav === 'admin' && (
            <AdminView currentUser={currentUser} />
          )}
        </main>
      </div>

      {/* Floating Input Button */}
      {!isSubPage && !selectedReport && (
        <button
          type="button"
          onClick={openFloatingInput}
          aria-label="Input Handover Baru"
          className="fixed bottom-[88px] right-4 md:bottom-7 md:right-7 z-30 w-14 h-14 rounded-full bg-[#0F294A] hover:bg-[#163864] hover:scale-[1.03] active:scale-[0.96] text-white shadow-lg shadow-[#0F294A]/35 hover:shadow-xl flex items-center justify-center transition-all"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      )}

      {/* Mobile Floating Rounded Bottom Navigation Bar */}
      <nav
        aria-label="Navigasi Mobile"
        className="md:hidden fixed bottom-3 left-3 right-3 z-30 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-lg shadow-slate-900/10 p-1.5 grid grid-cols-4 gap-1 items-center"
      >
        {PRIMARY_TABS.map((item) => {
          const Icon = item.icon;
          const active =
            activeNav === item.id ||
            (item.id === 'settings' && activeNav === 'admin');
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setEditingReport(null);
                setFormPreset(null);
                setActiveNav(item.id);
              }}
              aria-current={active ? 'page' : undefined}
              className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 text-[11px] transition-all active:scale-[0.96] ${
                active
                  ? 'bg-[#0F294A] text-white font-semibold shadow-md shadow-[#0F294A]/25'
                  : 'text-slate-500 font-medium hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-full leading-tight">{item.label}</span>
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
