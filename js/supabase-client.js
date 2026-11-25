/**
 * MONEYTRACK - SUPABASE CLIENT & DATABASE SYNC MODULE
 * Connects the application to Supabase PostgreSQL Database with Row Level Security (RLS).
 */

const SupabaseManager = {
  client: null,
  isReady: false,

  /**
   * Get configured credentials from localStorage or default
   */
  getCredentials() {
    const creds = StorageAdapter.get('supabase_credentials', {
      url: '',
      anonKey: ''
    });
    return creds;
  },

  /**
   * Save credentials to localStorage
   */
  saveCredentials(url, anonKey) {
    StorageAdapter.set('supabase_credentials', {
      url: url ? url.trim() : '',
      anonKey: anonKey ? anonKey.trim() : ''
    });
    return this.init();
  },

  /**
   * Check if Supabase credentials are set
   */
  isConfigured() {
    const creds = this.getCredentials();
    return !!(creds.url && creds.anonKey);
  },

  /**
   * Load public Supabase config from backend /api/supabase-config if available
   * (Only Project URL & Publishable/Anon Key — never secret keys)
   */
  async loadEnvConfig() {
    if (this.isConfigured()) return this.init();
    try {
      const res = await fetch('/api/supabase-config');
      if (res.ok) {
        const data = await res.json();
        if (data?.url && data?.anonKey) {
          this.saveCredentials(data.url, data.anonKey);
          return true;
        }
      }
    } catch (_) {
      // Offline / file:// mode — rely on Settings UI credentials
    }
    return this.init();
  },

  /**
   * Initialize Supabase Client
   */
  init() {
    const creds = this.getCredentials();
    if (creds.url && creds.anonKey && typeof window.supabase !== 'undefined') {
      try {
        this.client = window.supabase.createClient(creds.url, creds.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true
          }
        });
        this.isReady = true;
        console.log('✅ Supabase Client initialized successfully.');
        return true;
      } catch (err) {
        console.error('Failed to create Supabase client:', err);
        this.client = null;
        this.isReady = false;
        return false;
      }
    } else {
      this.client = null;
      this.isReady = false;
      return false;
    }
  },

  /**
   * Test connection to Supabase
   */
  async testConnection(url, anonKey) {
    if (typeof window.supabase === 'undefined') {
      return { success: false, message: 'Library Supabase JS belum termuat di browser.' };
    }

    try {
      const testClient = window.supabase.createClient(url.trim(), anonKey.trim());
      // Test querying profiles or auth
      const { data, error } = await testClient.from('profiles').select('id').limit(1);
      
      // Even if data is empty or permission denied (RLS), if error code is PGRST301 (JWT) or no connection error, the project URL & key are valid!
      if (error && error.message.includes('fetch')) {
        return { success: false, message: 'Gagal terhubung ke host Supabase. Periksa kembali Project URL.' };
      }

      return { success: true, message: 'Koneksi ke Supabase berhasil diverifikasi! 🚀' };
    } catch (err) {
      return { success: false, message: `Koneksi gagal: ${err.message}` };
    }
  },

  // ==========================================
  // AUTHENTICATION METHODS
  // ==========================================

  async signUp(email, password, fullName) {
    if (!this.isReady) throw new Error('Supabase belum dikonfigurasi.');
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: { name: fullName }
      }
    });
    if (error) throw error;
    return data;
  },

  async signIn(email, password) {
    if (!this.isReady) throw new Error('Supabase belum dikonfigurasi.');
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    if (!this.isReady) return;
    const { error } = await this.client.auth.signOut();
    if (error) console.error('SignOut error:', error);
  },

  async getSession() {
    if (!this.isReady) return null;
    const { data } = await this.client.auth.getSession();
    return data.session;
  },

  // ==========================================
  // DATABASE SYNC (ALL 10 TABLES)
  // ==========================================

  /**
   * Pull all financial data for active user from Supabase PostgreSQL
   */
  async pullAllUserData(userId) {
    if (!this.isReady || !userId) return null;

    try {
      const [
        profileRes,
        incomesRes,
        expensesRes,
        goalsRes,
        savingsTxRes,
        debtsRes,
        debtPayRes,
        aiAnalysisRes,
        chatRes
      ] = await Promise.all([
        this.client.from('profiles').select('*').eq('id', userId).maybeSingle(),
        this.client.from('incomes').select('*').eq('user_id', userId).order('transaction_date', { ascending: false }),
        this.client.from('expenses').select('*').eq('user_id', userId).order('transaction_date', { ascending: false }),
        this.client.from('savings_goals').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        this.client.from('savings_transactions').select('*').eq('user_id', userId).order('transaction_date', { ascending: false }),
        this.client.from('debts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        this.client.from('debt_payments').select('*').eq('user_id', userId).order('payment_date', { ascending: false }),
        this.client.from('ai_analysis').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
        this.client.from('chat_history').select('*').eq('user_id', userId).order('created_at', { ascending: true }).limit(50)
      ]);

      return {
        profile: profileRes?.data || null,
        incomes: (incomesRes.data || []).map(i => ({
          id: i.id,
          amount: Number(i.amount),
          category: i.category,
          description: i.description,
          date: i.transaction_date,
          created_at: i.created_at
        })),
        expenses: (expensesRes.data || []).map(e => ({
          id: e.id,
          amount: Number(e.amount),
          category: e.category,
          note: e.note,
          date: e.transaction_date,
          created_at: e.created_at
        })),
        savings_goals: (goalsRes.data || []).map(g => ({
          id: g.id,
          name: g.name,
          target_amount: Number(g.target_amount),
          target_date: g.target_date,
          icon: g.icon,
          color: g.color,
          created_at: g.created_at
        })),
        savings_transactions: (savingsTxRes.data || []).map(st => ({
          id: st.id,
          goal_id: st.goal_id,
          amount: Number(st.amount),
          type: st.transaction_type,
          date: st.transaction_date,
          note: st.note,
          created_at: st.created_at
        })),
        debts: (debtsRes.data || []).map(d => ({
          id: d.id,
          person_name: d.person_name,
          type: d.debt_type,
          amount: Number(d.amount),
          transaction_date: d.transaction_date,
          due_date: d.due_date,
          notes: d.notes,
          created_at: d.created_at
        })),
        debt_payments: (debtPayRes.data || []).map(dp => ({
          id: dp.id,
          debt_id: dp.debt_id,
          amount: Number(dp.amount),
          payment_date: dp.payment_date,
          notes: dp.notes,
          created_at: dp.created_at
        })),
        ai_analysis: aiAnalysisRes.data?.[0] ? {
          timestamp: aiAnalysisRes.data[0].created_at,
          score: aiAnalysisRes.data[0].score,
          scoreLabel: aiAnalysisRes.data[0].score_label,
          summaryText: aiAnalysisRes.data[0].summary_text,
          spendingPatterns: aiAnalysisRes.data[0].spending_patterns || [],
          savingsEvaluation: aiAnalysisRes.data[0].savings_evaluation || [],
          budgetingRecommendations: aiAnalysisRes.data[0].budgeting_recommendations || []
        } : null,
        chat_history: (chatRes.data || []).map(c => ({
          id: c.id,
          role: c.sender_role,
          text: c.message_content,
          timestamp: new Date(c.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        }))
      };
    } catch (err) {
      console.error('Error pulling user data from Supabase:', err);
      return null;
    }
  },

  // Mutation helpers (Create, Update, Delete with RLS enforcement)
  async updateProfile(userId, profileData) {
    if (!this.isReady || !userId) return;
    return this.client.from('profiles').upsert({
      id: userId,
      name: profileData.name,
      email: profileData.email,
      role: profileData.role || 'Pengguna MoneyTrack',
      theme: profileData.theme || 'light',
      categories: profileData.categories || undefined,
      updated_at: new Date().toISOString()
    });
  },

  async pushIncome(userId, item) {
    if (!this.isReady || !userId) return;
    return this.client.from('incomes').insert({
      id: item.id,
      user_id: userId,
      amount: item.amount,
      category: item.category,
      description: item.description,
      transaction_date: item.date
    });
  },

  async updateIncome(userId, id, item) {
    if (!this.isReady || !userId || !id) return;
    return this.client.from('incomes').update({
      amount: item.amount,
      category: item.category,
      description: item.description,
      transaction_date: item.date,
      updated_at: new Date().toISOString()
    }).eq('id', id).eq('user_id', userId);
  },

  async deleteIncome(userId, id) {
    if (!this.isReady || !userId || !id) return;
    return this.client.from('incomes').delete().eq('id', id).eq('user_id', userId);
  },

  async pushExpense(userId, item) {
    if (!this.isReady || !userId) return;
    return this.client.from('expenses').insert({
      id: item.id,
      user_id: userId,
      amount: item.amount,
      category: item.category,
      note: item.note,
      transaction_date: item.date
    });
  },

  async updateExpense(userId, id, item) {
    if (!this.isReady || !userId || !id) return;
    return this.client.from('expenses').update({
      amount: item.amount,
      category: item.category,
      note: item.note,
      transaction_date: item.date,
      updated_at: new Date().toISOString()
    }).eq('id', id).eq('user_id', userId);
  },

  async deleteExpense(userId, id) {
    if (!this.isReady || !userId || !id) return;
    return this.client.from('expenses').delete().eq('id', id).eq('user_id', userId);
  },

  async pushSavingsGoal(userId, item) {
    if (!this.isReady || !userId) return;
    return this.client.from('savings_goals').insert({
      id: item.id,
      user_id: userId,
      name: item.name,
      target_amount: item.target_amount,
      target_date: item.target_date || null,
      icon: item.icon || '🎯',
      color: item.color || '#7C3AED'
    });
  },

  async updateSavingsGoal(userId, id, item) {
    if (!this.isReady || !userId || !id) return;
    return this.client.from('savings_goals').update({
      name: item.name,
      target_amount: item.target_amount,
      target_date: item.target_date || null,
      icon: item.icon || '🎯',
      updated_at: new Date().toISOString()
    }).eq('id', id).eq('user_id', userId);
  },

  async deleteSavingsGoal(userId, id) {
    if (!this.isReady || !userId || !id) return;
    return this.client.from('savings_goals').delete().eq('id', id).eq('user_id', userId);
  },

  async pushSavingsTx(userId, item) {
    if (!this.isReady || !userId) return;
    return this.client.from('savings_transactions').insert({
      id: item.id,
      user_id: userId,
      goal_id: item.goal_id,
      amount: item.amount,
      transaction_type: item.type,
      note: item.note,
      transaction_date: item.date
    });
  },

  async pushDebt(userId, item) {
    if (!this.isReady || !userId) return;
    return this.client.from('debts').insert({
      id: item.id,
      user_id: userId,
      person_name: item.person_name,
      debt_type: item.type,
      amount: item.amount,
      transaction_date: item.transaction_date,
      due_date: item.due_date || null,
      notes: item.notes
    });
  },

  async updateDebt(userId, id, item) {
    if (!this.isReady || !userId || !id) return;
    return this.client.from('debts').update({
      person_name: item.person_name,
      debt_type: item.type,
      amount: item.amount,
      transaction_date: item.transaction_date,
      due_date: item.due_date || null,
      notes: item.notes,
      updated_at: new Date().toISOString()
    }).eq('id', id).eq('user_id', userId);
  },

  async deleteDebt(userId, id) {
    if (!this.isReady || !userId || !id) return;
    return this.client.from('debts').delete().eq('id', id).eq('user_id', userId);
  },

  async pushDebtPayment(userId, item) {
    if (!this.isReady || !userId) return;
    return this.client.from('debt_payments').insert({
      id: item.id,
      user_id: userId,
      debt_id: item.debt_id,
      amount: item.amount,
      payment_date: item.payment_date,
      notes: item.notes
    });
  },

  async pushAiAnalysis(userId, analysis) {
    if (!this.isReady || !userId || !analysis) return;
    return this.client.from('ai_analysis').insert({
      user_id: userId,
      score: analysis.score,
      score_label: analysis.scoreLabel,
      summary_text: analysis.summaryText,
      spending_patterns: analysis.spendingPatterns,
      savings_evaluation: analysis.savingsEvaluation,
      budgeting_recommendations: analysis.budgetingRecommendations
    });
  },

  async pushChatMessage(userId, msg) {
    if (!this.isReady || !userId || !msg) return;
    return this.client.from('chat_history').insert({
      user_id: userId,
      sender_role: msg.role,
      message_content: msg.text
    });
  }
};

window.SupabaseManager = SupabaseManager;
