# SHIFT HANDOVER — MILITARY & STABILITY

Aplikasi pencatatan dan serah terima laporan pekerjaan antar-shift produksi (**Shift 1, Shift 2, Shift 3**) dengan sinkronisasi **Supabase Cloud**, **Row Level Security (RLS)**, desain **mobile-first** untuk HP Android & Desktop, serta **Ekspor Excel (.xlsx)** menggunakan **SheetJS**.

---

## Fitur Utama
- **Multiuser & Lintas Perangkat**: Operator tiap shift dapat login dari HP masing-masing; laporan langsung tersinkronisasi di Supabase Cloud.
- **Struktur Produksi Resmi**:
  - Kategori `OVERHAUL` (Mesin: `AST4S 22-16L`, `AST 25-12L`, `AST 44-16L`, `AST 50-16L`) dengan matriks per Shift 1 / 2 / 3.
  - Kategori `STABILITY TINGGI`
  - Kategori `CASE PERBAIKAN PART`
  - Kategori `COMMISSIONING / TRIAL / CHANGE OVER`
- **Dashboard & History Lengkap**: Statistik harian, ringkasan per shift, filter tanggal/shift/kategori, pencarian kata kunci/mesin, detail laporan, dan edit sesuai izin RLS.
- **Ekspor Excel (.xlsx) 2 Worksheet**:
  - `HANDOVER`: Ringkas & terkelompok (Tanggal, Shift, Kategori, Mesin, Informasi, Masalah, Tindak Lanjut).
  - `DETAIL DATA`: Data mentah lengkap + ID, Pembuat, Waktu Dibuat, Waktu Diperbarui, AutoFilter, Freeze Header, dan lebar kolom otomatis.

---

## 1. Panduan Setup Database di Supabase
1. Buka **Supabase Dashboard** project `https://dkyjfoxruqoqlhxrmcac.supabase.co`.
2. Masuk ke menu **SQL Editor** → klik **New Query**.
3. Salin seluruh isi file **`supabase-schema.sql`** dan klik **Run**.
4. Pastikan muncul status sukses. Skrip ini akan membuat:
   - Tabel `public.profiles` (peran `operator`, `supervisor`, `admin`)
   - Tabel `public.handover_reports` dengan constraint kategori & mesin Overhaul
   - Indeks pencarian tanggal, shift, kategori, mesin, dan pembuat
   - Trigger audit (`created_by` tidak bisa diubah saat update, `updated_at` otomatis)
   - Row Level Security (**RLS aktif**) tanpa kebijakan `DELETE`
5. **Tutorial Membuat Akun Langsung di Supabase Dashboard**:
   - **A. Membuat Akun Admin Utama (`suryadi.k94@gmail.com`)**:
     1. Buka menu **Authentication → Users** di Dashboard Supabase → klik **Add user → Create new user**.
     2. Isi **Email address**: `suryadi.k94@gmail.com` dan **Password** minimal 6 karakter.
     3. Centang **Auto Confirm User** agar akun langsung aktif tanpa perlu klik link verifikasi email, lalu klik **Create user**.
     4. Karena trigger pada `supabase-schema.sql` mengenali `suryadi.k94@gmail.com`, profil Anda otomatis mendapat `role = 'admin'` dan `can_edit_all = TRUE`.
   - **B. Membuat Akun Operator / User Tim**:
     1. Ulangi langkah **Authentication → Users → Add user → Create new user** untuk setiap email anggota tim, centang **Auto Confirm User** *(tanpa perlu mengatur shift tetap karena shift rolling tiap 1 minggu)*.
     2. Buka **SQL Editor → New Query** untuk mengatur nama lengkap tiap user agar tampil rapi di aplikasi:
        ```sql
        UPDATE public.profiles
        SET full_name = 'Nama Lengkap Operator'
        WHERE email = 'operator@pabrik.local';
        ```
     3. Untuk menaikkan akun lain menjadi Supervisor/Admin tambahan:
        ```sql
        UPDATE public.profiles
        SET role = 'supervisor', can_edit_all = TRUE
        WHERE email = 'supervisor@perusahaan.co.id';
        ```
   - **C. Mengunci Pendaftaran Publik (Disarankan untuk Pabrik/Internal)**:
     - Setelah semua akun tim selesai dibuat, buka **Authentication → Sign In / Providers → Email** (atau **User Signups**) lalu **matikan *Allow new users to sign up*** agar orang luar tidak bisa mendaftar sendiri lewat web.

---

## 2. Menghubungkan Publishable Key Sekali Saja (Otomatis di Semua Device)
> **PENTING:** Gunakan hanya **Publishable Key** (`sb_publishable_...`) atau **anon public key**. Jangan pernah menaruh `service_role` key atau password database di frontend maupun GitHub.

Agar tidak perlu konfigurasi ulang setiap kali aplikasi dibuka di HP atau perangkat baru:
- **Melalui GitHub Repository Variable / Secret saat Deploy:**
  Di GitHub Repo → **Settings → Secrets and variables → Actions** (tab **Variables** atau **Secrets**) → tambahkan `VITE_SUPABASE_PUBLISHABLE_KEY` berisi Publishable Key Anda lalu jalankan ulang workflow deploy. Key otomatis tertanam di hasil build untuk semua perangkat.

---

## 3. Panduan Deploy ke GitHub Pages (Termasuk dari HP Android)

### A. Menggunakan GitHub Web Interface dari HP Android / Laptop
1. Login ke [github.com](https://github.com) lewat browser HP atau Laptop.
2. Buat repository baru (**New repository**), misalnya `shift-handover-military-stability` (pilih **Public** jika memakai GitHub Free agar GitHub Pages aktif gratis).
3. Unggah seluruh file proyek ini, pastikan folder **`.github/workflows/deploy.yml`** ikut terunggah. *(Jika ada file `.github/workflows/static.yml`, hapus file tersebut agar tidak bentrok).*
4. Masuk ke **Settings → Secrets and variables → Actions** (boleh di tab **Variables** ataupun **Secrets**):
   - Name: `VITE_SUPABASE_PUBLISHABLE_KEY`
   - Value: *(tempel Publishable Key `sb_publishable_...` atau anon public key Supabase Anda, tanpa tanda kutip)*
5. Masuk ke **Settings → Pages**:
   - Pada bagian **Build and deployment → Source**, pilih **GitHub Actions**.
6. Buka tab **Actions** → pilih workflow **Deploy Shift Handover ke GitHub Pages** → klik **Run workflow** (atau otomatis berjalan tiap push ke `main`/`master`).
7. Setelah centang hijau (✓) selesai, URL aplikasi Anda siap dibuka di `https://<username>.github.io/<nama-repo>/` dari semua device tanpa perlu konfigurasi ulang.
8. *(Opsional jika mengaktifkan konfirmasi email saat Registrasi)*: Di Supabase Dashboard buka **Authentication → URL Configuration**, isi **Site URL** dan tambahkan ke **Redirect URLs**:
   - `https://<username>.github.io/<nama-repo>/`

### B. Build Lokal (Jika Menggunakan Laptop/PC)
```bash
npm install --legacy-peer-deps
npm run build
```
Hasil build statis berada di folder `dist/` dengan seluruh path aset bersifat relatif (`base: './'` di `vite.config.ts`) sehingga aman diakses dari subpath GitHub Pages.
