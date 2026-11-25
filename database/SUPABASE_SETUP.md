# Panduan Konfigurasi Supabase – MoneyTrack

Panduan ini menjelaskan cara menghubungkan **MoneyTrack** ke database **Supabase PostgreSQL** dengan autentikasi pengguna dan **Row Level Security (RLS)** agar setiap pengguna hanya dapat melihat dan mengubah datanya sendiri.

---

## 1. Buat Project & Jalankan Migrasi Database

1. Buka [supabase.com](https://supabase.com) dan buat project baru.
2. Masuk ke menu **SQL Editor** → **New Query**.
3. Salin seluruh isi file [`database/schema.sql`](./schema.sql) dan klik **Run**.
   - *(Jika Anda sudah pernah menjalankan `schema.sql` versi sebelumnya, cukup jalankan [`database/migrations/001_custom_categories_and_rls.sql`](./migrations/001_custom_categories_and_rls.sql)).*
4. Pastikan 10 tabel terbentuk di **Table Editor**:
   `profiles`, `incomes`, `expenses`, `savings_goals`, `savings_transactions`, `debts`, `debt_payments`, `financial_transactions`, `ai_analysis`, `chat_history`.

---

## 2. Pengaturan Autentikasi (Supabase Auth)

1. Di dashboard Supabase, buka **Authentication** → **Providers** → pastikan **Email** aktif.
2. Untuk pengujian lokal yang cepat tanpa konfirmasi email, Anda dapat menonaktifkan **Confirm email** di **Authentication** → **Providers** → **Email** (opsional; untuk produksi disarankan tetap aktif).

---

## 3. Ambil Project URL & Publishable / Anon Key

1. Buka **Project Settings** (ikon roda gigi) → **API** (atau **Data API**).
2. Salin dua nilai berikut (aman digunakan di frontend):
   - **Project URL** (`https://xxxx.supabase.co`)
   - **Publishable / Anon Public Key** (`sb_publishable_...` atau `eyJ...`)
3. **PENTING:** **Jangan pernah** memasukkan `service_role` / **Secret Key** ke frontend (`index.html`, `js/*`, atau Pengaturan browser). Secret Key hanya boleh disimpan di **Environment Variables backend/Vercel** (`SUPABASE_SERVICE_ROLE_KEY`).

---

## 4. Cara Memasukkan Konfigurasi ke MoneyTrack

### Opsi A — Langsung di Aplikasi (Mode Lokal / Pengujian)
1. Buka aplikasi MoneyTrack (`index.html`), login/daftar terlebih dahulu.
2. Buka menu **Profil & Pengaturan** → bagian **Koneksi Database Cloud (Supabase PostgreSQL)**.
3. Masukkan **Supabase Project URL** dan **Supabase Anon Public Key**.
4. Klik **⚡ Simpan & Uji Koneksi**.
5. Setelah status berubah menjadi `🟢 Cloud Terhubung`, login/daftar ulang dengan akun Supabase Anda agar seluruh data tersinkronisasi otomatis.

### Opsi B — Environment Variables (Deployment Vercel)
1. Salin `.env.example` menjadi `.env` (file `.env` sudah dilindungi `.gitignore` dan tidak akan ter-upload ke Git).
2. Pada dashboard Vercel → **Settings** → **Environment Variables**, isi:
   - `SUPABASE_URL` = Project URL Anda
   - `SUPABASE_ANON_KEY` = Publishable / Anon Public Key Anda
   - `SUPABASE_SERVICE_ROLE_KEY` = Secret Key (hanya untuk backend, tidak pernah dikirim ke frontend)
   - `OPENAI_API_KEY` & `GEMINI_API_KEY` = Kunci API AI Anda
3. Endpoint `/api/supabase-config` hanya mengekspos `SUPABASE_URL` dan `SUPABASE_ANON_KEY` secara aman ke browser.
