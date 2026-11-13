-- ============================================================================
-- SHIFT HANDOVER — MILITARY & STABILITY
-- Supabase PostgreSQL Schema & Row Level Security (RLS)
-- Jalankan seluruh script ini melalui Supabase SQL Editor
-- ============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Enum / Domain Check Constants (menggunakan CHECK constraint agar mudah migrasi)
-- Kategori resmi:
--   'OVERHAUL'
--   'STABILITY TINGGI'
--   'CASE PERBAIKAN PART'
--   'COMMISSIONING / TRIAL / CHANGE OVER'
-- Shift resmi:
--   'Shift 1', 'Shift 2', 'Shift 3'

-- 3. Tabel Profil Pengguna (untuk Role & Identitas Pembuat yang Terverifikasi)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT 'Operator',
  role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('operator', 'supervisor', 'admin')),
  default_shift TEXT NOT NULL DEFAULT 'Shift 1' CHECK (default_shift IN ('Shift 1', 'Shift 2', 'Shift 3')),
  can_edit_all BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'Profil operator, supervisor, dan admin Shift Handover.';

-- 4. Tabel Laporan Handover
CREATE TABLE IF NOT EXISTS public.handover_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  shift TEXT NOT NULL CHECK (shift IN ('Shift 1', 'Shift 2', 'Shift 3')),
  category TEXT NOT NULL CHECK (
    category IN (
      'OVERHAUL',
      'STABILITY TINGGI',
      'CASE PERBAIKAN PART',
      'COMMISSIONING / TRIAL / CHANGE OVER'
    )
  ),
  machine TEXT NULL,
  information TEXT NOT NULL CHECK (char_length(trim(information)) > 0),
  issue TEXT NOT NULL DEFAULT '',
  follow_up TEXT NOT NULL DEFAULT '',
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_by_name TEXT NOT NULL,
  updated_by UUID NULL REFERENCES auth.users(id),
  updated_by_name TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.handover_reports IS 'Catatan laporan serah terima pekerjaan antar-shift MILITARY & STABILITY.';

-- 5. Indeks untuk Performa Query Dashboard, History, & Export
CREATE INDEX IF NOT EXISTS idx_handover_reports_date_shift
  ON public.handover_reports (report_date DESC, shift);

CREATE INDEX IF NOT EXISTS idx_handover_reports_category
  ON public.handover_reports (category);

CREATE INDEX IF NOT EXISTS idx_handover_reports_machine
  ON public.handover_reports (machine)
  WHERE machine IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_handover_reports_created_by
  ON public.handover_reports (created_by);

CREATE INDEX IF NOT EXISTS idx_handover_reports_updated_at
  ON public.handover_reports (updated_at DESC);

-- 6. Fungsi Helper Otorisasi (SECURITY DEFINER untuk mencegah rekursi RLS)
CREATE OR REPLACE FUNCTION public.is_supervisor_or_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role IN ('supervisor', 'admin') OR p.can_edit_all = TRUE)
  );
$$;

-- 7. Trigger Otomatis Pembuatan Profil Saat User Baru Mendaftar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_shift TEXT;
BEGIN
  v_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
    split_part(COALESCE(NEW.email, 'Operator'), '@', 1)
  );

  v_shift := CASE
    WHEN NEW.raw_user_meta_data ->> 'default_shift' IN ('Shift 1', 'Shift 2', 'Shift 3')
      THEN NEW.raw_user_meta_data ->> 'default_shift'
    ELSE 'Shift 1'
  END;

  INSERT INTO public.profiles (id, email, full_name, role, default_shift)
  VALUES (NEW.id, COALESCE(NEW.email, ''), v_name, 'operator', v_shift)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 8. Trigger Keamanan & Audit Trail Laporan Handover
-- Memastikan:
--   a) Saat INSERT, identitas pembuat selalu terkunci ke auth.uid()
--   b) Saat UPDATE, identitas pembuat (created_by, created_by_name, created_at) TIDAK BISA dimanipulasi
--   c) updated_at dan updated_by terisi otomatis
CREATE OR REPLACE FUNCTION public.enforce_handover_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name TEXT;
BEGIN
  SELECT p.full_name INTO v_actor_name
  FROM public.profiles p
  WHERE p.id = auth.uid();

  v_actor_name := COALESCE(NULLIF(trim(v_actor_name), ''), 'Operator');

  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by := auth.uid();
      NEW.created_by_name := v_actor_name;
      NEW.updated_by := auth.uid();
      NEW.updated_by_name := v_actor_name;
    END IF;
    NEW.created_at := NOW();
    NEW.updated_at := NOW();
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Kunci identitas pembuat asli agar tidak dapat diubah oleh siapa pun
    NEW.created_by := OLD.created_by;
    NEW.created_by_name := OLD.created_by_name;
    NEW.created_at := OLD.created_at;

    IF auth.uid() IS NOT NULL THEN
      NEW.updated_by := auth.uid();
      NEW.updated_by_name := v_actor_name;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handover_reports_audit ON public.handover_reports;
CREATE TRIGGER trg_handover_reports_audit
  BEFORE INSERT OR UPDATE ON public.handover_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_handover_audit();

-- Trigger updated_at untuk profiles
CREATE OR REPLACE FUNCTION public.touch_profile_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  -- Cegah user biasa menaikkan role dirinya sendiri lewat client
  IF auth.uid() = OLD.id AND NOT public.is_supervisor_or_admin() THEN
    NEW.role := OLD.role;
    NEW.can_edit_all := OLD.can_edit_all;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_profile_updated_at();

-- 9. Aktifkan Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handover_reports ENABLE ROW LEVEL SECURITY;

-- 10. Kebijakan RLS Tabel profiles
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 11. Kebijakan RLS Tabel handover_reports
-- Kebijakan 1: Pengguna terautentikasi dapat membaca semua laporan lintas shift.
DROP POLICY IF EXISTS "handover_select_authenticated" ON public.handover_reports;
CREATE POLICY "handover_select_authenticated"
  ON public.handover_reports
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- Kebijakan 2: Pengguna terautentikasi dapat membuat laporan hanya dengan identitas dirinya sendiri.
DROP POLICY IF EXISTS "handover_insert_own" ON public.handover_reports;
CREATE POLICY "handover_insert_own"
  ON public.handover_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
  );

-- Kebijakan 3 & 4: Pengguna berizin (pembuat laporan atau supervisor/admin) dapat mengedit laporan,
-- dan identitas pembuat (created_by) tidak boleh dimanipulasi.
DROP POLICY IF EXISTS "handover_update_authorized" ON public.handover_reports;
CREATE POLICY "handover_update_authorized"
  ON public.handover_reports
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR public.is_supervisor_or_admin()
  )
  WITH CHECK (
    (auth.uid() = created_by OR public.is_supervisor_or_admin())
    AND created_by = (
      SELECT existing.created_by
      FROM public.handover_reports AS existing
      WHERE existing.id = handover_reports.id
    )
  );

-- Kebijakan 5: Sengaja TIDAK membuat kebijakan DELETE agar riwayat audit antar-shift
-- tidak terhapus secara tidak sengaja atau sepihak dari frontend.
