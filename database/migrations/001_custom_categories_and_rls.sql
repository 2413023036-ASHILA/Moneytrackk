-- ===================================================================
-- MIGRATION 001: Custom Categories Support & Complete RLS Policies
-- Jalankan script ini di Supabase SQL Editor jika schema.sql versi
-- awal sudah pernah dijalankan sebelumnya.
-- ===================================================================

-- 1. Tambah kolom categories pada public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS categories JSONB
  DEFAULT '{"income":["Uang saku","Gaji","Bonus","Hadiah","Bisnis","Pendapatan lainnya"],"expense":["Makanan","Transportasi","Pendidikan","Belanja","Hiburan","Kesehatan","Tagihan","Kebutuhan sehari-hari"]}'::jsonb;

-- 2. Hapus constraint lama yang membatasi kategori bawaan saja
ALTER TABLE public.incomes DROP CONSTRAINT IF EXISTS incomes_category_check;
ALTER TABLE public.incomes ALTER COLUMN category TYPE VARCHAR(80);
ALTER TABLE public.incomes ADD CONSTRAINT incomes_category_check CHECK (length(trim(category)) > 0);

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;
ALTER TABLE public.expenses ALTER COLUMN category TYPE VARCHAR(80);
ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_check CHECK (length(trim(category)) > 0);

-- 3. Lengkapi RLS Policies untuk INSERT profile dan DELETE riwayat anak
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete their own savings tx" ON public.savings_transactions;
CREATE POLICY "Users can delete their own savings tx"
  ON public.savings_transactions FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own payments" ON public.debt_payments;
CREATE POLICY "Users can delete their own payments"
  ON public.debt_payments FOR DELETE USING (auth.uid() = user_id);
