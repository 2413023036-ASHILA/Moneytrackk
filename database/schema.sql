-- ===================================================================
-- MONEYTRACK - SUPABASE POSTGRESQL DATABASE SCHEMA
-- Smart Personal Finance Management
-- Structure: 10 Core Tables with Row Level Security (RLS)
-- ===================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (Pengguna)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(100) DEFAULT 'Pengguna Pribadi',
  avatar_url TEXT,
  currency VARCHAR(10) DEFAULT 'IDR',
  theme VARCHAR(20) DEFAULT 'light',
  categories JSONB DEFAULT '{"income":["Uang saku","Gaji","Bonus","Hadiah","Bisnis","Pendapatan lainnya"],"expense":["Makanan","Transportasi","Pendidikan","Belanja","Hiburan","Kesehatan","Tagihan","Kebutuhan sehari-hari"]}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. INCOMES TABLE (Pemasukan)
CREATE TABLE IF NOT EXISTS public.incomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  category VARCHAR(80) NOT NULL CHECK (length(trim(category)) > 0),
  description TEXT NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. EXPENSES TABLE (Pengeluaran)
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  category VARCHAR(80) NOT NULL CHECK (length(trim(category)) > 0),
  note TEXT NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SAVINGS_GOALS TABLE (Target Tabungan)
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  target_amount NUMERIC(15, 2) NOT NULL CHECK (target_amount > 0),
  target_date DATE,
  icon VARCHAR(50) DEFAULT '🎯',
  color VARCHAR(20) DEFAULT '#7C3AED',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SAVINGS_TRANSACTIONS TABLE (Setoran dan Penarikan Tabungan)
CREATE TABLE IF NOT EXISTS public.savings_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('deposit', 'withdraw')),
  note TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. DEBTS TABLE (Utang dan Piutang)
CREATE TABLE IF NOT EXISTS public.debts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  person_name VARCHAR(255) NOT NULL,
  debt_type VARCHAR(20) NOT NULL CHECK (debt_type IN ('debt', 'receivable')), -- 'debt' = utang kita, 'receivable' = piutang kita
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. DEBT_PAYMENTS TABLE (Riwayat Pembayaran Utang dan Piutang)
CREATE TABLE IF NOT EXISTS public.debt_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. FINANCIAL_TRANSACTIONS TABLE (Konsolidasi Log Transaksi)
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_type VARCHAR(30) NOT NULL CHECK (source_type IN ('income', 'expense', 'savings_deposit', 'savings_withdraw', 'debt_payment', 'receivable_collection')),
  source_id UUID,
  amount NUMERIC(15, 2) NOT NULL,
  is_positive BOOLEAN NOT NULL DEFAULT TRUE,
  title TEXT NOT NULL,
  category VARCHAR(100),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. AI_ANALYSIS TABLE (Hasil Analisis OpenAI)
CREATE TABLE IF NOT EXISTS public.ai_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score >= 0 AND score <= 100),
  score_label VARCHAR(50) NOT NULL,
  summary_text TEXT NOT NULL,
  spending_patterns JSONB DEFAULT '[]'::jsonb,
  savings_evaluation JSONB DEFAULT '[]'::jsonb,
  budgeting_recommendations JSONB DEFAULT '[]'::jsonb,
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. CHAT_HISTORY TABLE (Riwayat Percakapan Gemini)
CREATE TABLE IF NOT EXISTS public.chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('user', 'assistant', 'system')),
  message_content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- INDEXES FOR PERFORMANCE
-- ===================================================================
CREATE INDEX IF NOT EXISTS idx_incomes_user_date ON public.incomes (user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses (user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_savings_goals_user ON public.savings_goals (user_id);
CREATE INDEX IF NOT EXISTS idx_savings_tx_goal ON public.savings_transactions (goal_id);
CREATE INDEX IF NOT EXISTS idx_debts_user_due ON public.debts (user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON public.debt_payments (debt_id);
CREATE INDEX IF NOT EXISTS idx_financial_tx_user ON public.financial_transactions (user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_user ON public.ai_analysis (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_history_user ON public.chat_history (user_id, created_at ASC);

-- ===================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures each user can only read, create, update, and delete their own data
-- ===================================================================

-- Enable RLS on all 10 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Incomes Policies
CREATE POLICY "Users can view their own incomes" ON public.incomes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own incomes" ON public.incomes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own incomes" ON public.incomes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own incomes" ON public.incomes FOR DELETE USING (auth.uid() = user_id);

-- Expenses Policies
CREATE POLICY "Users can view their own expenses" ON public.expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own expenses" ON public.expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own expenses" ON public.expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own expenses" ON public.expenses FOR DELETE USING (auth.uid() = user_id);

-- Savings Goals Policies
CREATE POLICY "Users can view their own goals" ON public.savings_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own goals" ON public.savings_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own goals" ON public.savings_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own goals" ON public.savings_goals FOR DELETE USING (auth.uid() = user_id);

-- Savings Transactions Policies
CREATE POLICY "Users can view their own savings tx" ON public.savings_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own savings tx" ON public.savings_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own savings tx" ON public.savings_transactions FOR DELETE USING (auth.uid() = user_id);

-- Debts Policies
CREATE POLICY "Users can view their own debts" ON public.debts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own debts" ON public.debts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own debts" ON public.debts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own debts" ON public.debts FOR DELETE USING (auth.uid() = user_id);

-- Debt Payments Policies
CREATE POLICY "Users can view their own payments" ON public.debt_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own payments" ON public.debt_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own payments" ON public.debt_payments FOR DELETE USING (auth.uid() = user_id);

-- Financial Transactions Policies
CREATE POLICY "Users can view their own transactions" ON public.financial_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own transactions" ON public.financial_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- AI Analysis Policies
CREATE POLICY "Users can view their own ai analysis" ON public.ai_analysis FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own ai analysis" ON public.ai_analysis FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Chat History Policies
CREATE POLICY "Users can view their own chats" ON public.chat_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own chats" ON public.chat_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger for New User Profile creation in Supabase auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
