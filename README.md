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
5. Buat minimal 2 akun uji di **Authentication → Users** (misalnya untuk Shift 1 dan Shift 2).
   - Untuk menaikkan salah satu akun menjadi Supervisor/Admin agar bisa mengedit semua laporan shift:
     ```sql
     UPDATE public.profiles
     SET role = 'supervisor', can_edit_all = TRUE
     WHERE email = 'supervisor@perusahaan.co.id';
     ```
   - Jika ingin menonaktifkan pendaftaran mandiri publik, buka **Authentication → Providers → Email** atau **Sign In / Up** di Supabase dan nonaktifkan *Allow new users to sign up*.

---

## 2. Menghubungkan Publishable Key (Aman untuk Frontend)
> **PENTING:** Gunakan hanya **Publishable Key** (`sb_publishable_...`) atau **anon public key**. Jangan pernah menaruh `service_role` key atau password database di frontend maupun GitHub.

Anda dapat memasukkan key melalui salah satu cara berikut:
- **Cara A (Melalui GitHub Repository Variable saat Deploy):**
  Di GitHub Repo → **Settings → Secrets and variables → Actions → Variables** → buat variable bernama `VITE_SUPABASE_PUBLISHABLE_KEY` berisi Publishable Key Anda.
- **Cara B (Langsung dari Aplikasi):**
  Buka tab **SETTINGS** atau panel **Konfigurasi Koneksi Supabase** di halaman Login, tempel **Publishable Key**, lalu klik **Simpan & Uji Koneksi**.

---

## 3. Panduan Deploy ke GitHub Pages (Termasuk dari HP Android)

### A. Menggunakan GitHub Web Interface dari HP Android (Tanpa Terminal)
1. Login ke [github.com](https://github.com) lewat browser HP Android (Chrome/Edge).
2. Buat repository baru (**New repository**), misalnya `shift-handover-military-stability` (Public atau Private sesuai paket GitHub Anda).
3. Unggah seluruh file proyek ini (atau ekstrak ZIP lalu upload melalui **Add file → Upload files**), pastikan folder `.github/workflows/deploy.yml` ikut terunggah.
4. Masuk ke **Settings → Secrets and variables → Actions → Variables → New repository variable**:
   - Name: `VITE_SUPABASE_PUBLISHABLE_KEY`
   - Value: *(tempel Publishable Key Supabase Anda)*
5. Masuk ke **Settings → Pages**:
   - Pada bagian **Build and deployment → Source**, pilih **GitHub Actions**.
6. Buka tab **Actions** → pilih workflow **Deploy Shift Handover ke GitHub Pages** → klik **Run workflow** (atau otomatis berjalan saat push ke `main`).
7. Setelah centang hijau selesai, URL aplikasi Anda siap dibuka di `https://<username>.github.io/<nama-repo>/` dari HP Android semua operator shift.

### B. Build Lokal (Jika Menggunakan Laptop/PC)
```bash
npm install
npm run build
```
Hasil build statis berada di folder `dist/` dengan seluruh path aset bersifat relatif (`base: './'` di `vite.config.ts`) sehingga aman diakses dari subpath GitHub Pages.
