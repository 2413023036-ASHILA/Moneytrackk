/**
 * MONEYTRACK - APPLICATION STATE MANAGEMENT (WITH SUPABASE CLOUD SYNC)
 * Central reactive state store with LocalStorage persistence and Supabase PostgreSQL syncing.
 */

const AppState = {
  // Active session
  user: null,

  // Financial tables
  incomes: [],
  expenses: [],
  savings_goals: [],
  savings_transactions: [],
  debts: [],
  debt_payments: [],

  // Transaction Categories (Customizable)
  categories: {
    income: ['Uang saku', 'Gaji', 'Bonus', 'Hadiah', 'Bisnis', 'Pendapatan lainnya'],
    expense: ['Makanan', 'Transportasi', 'Pendidikan', 'Belanja', 'Hiburan', 'Kesehatan', 'Tagihan', 'Kebutuhan sehari-hari']
  },
  
  // AI artifacts
  ai_analysis: null,
  chat_history: [],

  // Preferences & Cloud config
  settings: {
    currency: 'IDR',
    currencyPrefix: 'Rp ',
    theme: 'light',
    language: 'id',
    cloudMode: false
  },

  // Event listeners for state changes
  _listeners: [],

  generateUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  isCloudUser() {
    return typeof SupabaseManager !== 'undefined' &&
      SupabaseManager.isReady &&
      this.user?.id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(this.user.id);
  },

  subscribe(listener) {
    if (typeof listener === 'function') {
      this._listeners.push(listener);
    }
  },

  notify() {
    this.save();
    this._listeners.forEach(fn => {
      try {
        fn(this);
      } catch (err) {
        console.error('Error in state listener:', err);
      }
    });
  },

  /**
   * Initialize State from localStorage or seed initial data
   */
  async init() {
    // 1. Initialize Supabase (loads env config if deployed on Vercel, or localStorage creds)
    if (typeof SupabaseManager !== 'undefined') {
      await SupabaseManager.loadEnvConfig();
    }

    const savedUser = StorageAdapter.get('user', null);
    const savedIncomes = StorageAdapter.get('incomes', null);
    const savedExpenses = StorageAdapter.get('expenses', null);
    const savedGoals = StorageAdapter.get('savings_goals', null);
    const savedSavingsTx = StorageAdapter.get('savings_transactions', null);
    const savedDebts = StorageAdapter.get('debts', null);
    const savedDebtPayments = StorageAdapter.get('debt_payments', null);
    const savedAiAnalysis = StorageAdapter.get('ai_analysis', null);
    const savedChat = StorageAdapter.get('chat_history', null);
    const savedSettings = StorageAdapter.get('settings', null);
    const savedCategories = StorageAdapter.get('categories', null);

    if (savedIncomes !== null || savedUser !== null) {
      this.user = savedUser;
      this.incomes = savedIncomes || [];
      this.expenses = savedExpenses || [];
      this.savings_goals = savedGoals || [];
      this.savings_transactions = savedSavingsTx || [];
      this.debts = savedDebts || [];
      this.debt_payments = savedDebtPayments || [];
      this.ai_analysis = savedAiAnalysis;
      this.chat_history = savedChat || [];
      if (savedSettings) this.settings = { ...this.settings, ...savedSettings };
      if (savedCategories && savedCategories.income && savedCategories.expense) {
        this.categories = savedCategories;
      }
    } else {
      // Pengguna baru: mulai dengan data bersih (tanpa data transaksi demo)
      this.resetEmptyState(false);
    }

    // Apply theme
    document.documentElement.setAttribute('data-theme', this.settings.theme || 'light');

    // If Supabase session is active, sync cloud data
    if (typeof SupabaseManager !== 'undefined' && SupabaseManager.isReady) {
      const session = await SupabaseManager.getSession();
      if (session?.user) {
        await this.syncFromSupabase(session.user.id);
      }
    }
  },

  /**
   * Sync from Supabase Cloud Database
   */
  async syncFromSupabase(userId) {
    if (!SupabaseManager.isReady || !userId) return;
    const cloudData = await SupabaseManager.pullAllUserData(userId);
    if (cloudData) {
      if (cloudData.profile) {
        this.user = {
          id: cloudData.profile.id,
          name: cloudData.profile.name || this.user?.name || 'Pengguna',
          email: cloudData.profile.email || this.user?.email || '',
          role: cloudData.profile.role || 'Pengguna MoneyTrack',
          avatar: cloudData.profile.avatar_url || '',
          created_at: cloudData.profile.created_at
        };
        if (cloudData.profile.theme) {
          this.settings.theme = cloudData.profile.theme;
          document.documentElement.setAttribute('data-theme', this.settings.theme);
        }
        if (cloudData.profile.categories?.income && cloudData.profile.categories?.expense) {
          this.categories = cloudData.profile.categories;
        }
      }
      this.incomes = cloudData.incomes;
      this.expenses = cloudData.expenses;
      this.savings_goals = cloudData.savings_goals;
      this.savings_transactions = cloudData.savings_transactions;
      this.debts = cloudData.debts;
      this.debt_payments = cloudData.debt_payments;
      if (cloudData.ai_analysis) this.ai_analysis = cloudData.ai_analysis;
      if (cloudData.chat_history.length > 0) this.chat_history = cloudData.chat_history;
      this.settings.cloudMode = true;
      this.save();
      this.notify();
    }
  },

  save() {
    StorageAdapter.set('user', this.user);
    StorageAdapter.set('incomes', this.incomes);
    StorageAdapter.set('expenses', this.expenses);
    StorageAdapter.set('savings_goals', this.savings_goals);
    StorageAdapter.set('savings_transactions', this.savings_transactions);
    StorageAdapter.set('debts', this.debts);
    StorageAdapter.set('debt_payments', this.debt_payments);
    StorageAdapter.set('ai_analysis', this.ai_analysis);
    StorageAdapter.set('chat_history', this.chat_history);
    StorageAdapter.set('settings', this.settings);
    StorageAdapter.set('categories', this.categories);
  },

  // --- Category Management ---
  addCategory(type, name) {
    const clean = (name || '').trim();
    if (!clean) throw new Error('Nama kategori tidak boleh kosong');
    if (type !== 'income' && type !== 'expense') throw new Error('Tipe kategori tidak valid');

    const exists = this.categories[type].some(c => c.toLowerCase() === clean.toLowerCase());
    if (exists) throw new Error(`Kategori "${clean}" sudah ada`);

    this.categories[type].push(clean);
    this.notify();
    return clean;
  },

  deleteCategory(type, name) {
    if (type !== 'income' && type !== 'expense') return false;
    if (this.categories[type].length <= 1) {
      throw new Error('Minimal harus tersisa 1 kategori');
    }
    this.categories[type] = this.categories[type].filter(c => c !== name);
    this.notify();
    return true;
  },

  /**
   * Reset state to clean empty user data (no demo transactions)
   */
  resetEmptyState(keepUser = true) {
    if (!keepUser) this.user = null;
    this.incomes = [];
    this.expenses = [];
    this.savings_goals = [];
    this.savings_transactions = [];
    this.debts = [];
    this.debt_payments = [];
    this.ai_analysis = null;
    this.chat_history = [
      {
        id: 'msg_welcome',
        role: 'assistant',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        text: 'Halo! 👋 Saya Gemini, asisten keuangan pribadi MoneyTrack. Mulai catat pemasukan dan pengeluaran Anda, lalu tanyakan apa saja seputar anggaran atau target tabungan!'
      }
    ];
    this.categories = {
      income: ['Uang saku', 'Gaji', 'Bonus', 'Hadiah', 'Bisnis', 'Pendapatan lainnya'],
      expense: ['Makanan', 'Transportasi', 'Pendidikan', 'Belanja', 'Hiburan', 'Kesehatan', 'Tagihan', 'Kebutuhan sehari-hari']
    };
    this.save();
  },

  /**
   * Backup Restore
   */
  importBackupData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Format file cadangan JSON tidak valid.');
    }
    if (!Array.isArray(data.incomes) || !Array.isArray(data.expenses)) {
      throw new Error('File JSON tidak memiliki struktur data MoneyTrack yang valid.');
    }

    this.incomes = data.incomes || [];
    this.expenses = data.expenses || [];
    this.savings_goals = Array.isArray(data.savings_goals) ? data.savings_goals : [];
    this.savings_transactions = Array.isArray(data.savings_transactions) ? data.savings_transactions : [];
    this.debts = Array.isArray(data.debts) ? data.debts : [];
    this.debt_payments = Array.isArray(data.debt_payments) ? data.debt_payments : [];
    if (data.categories && Array.isArray(data.categories.income) && Array.isArray(data.categories.expense)) {
      this.categories = data.categories;
    }
    if (data.ai_analysis) this.ai_analysis = data.ai_analysis;
    if (Array.isArray(data.chat_history)) this.chat_history = data.chat_history;
    if (data.settings && typeof data.settings === 'object') {
      this.settings = { ...this.settings, ...data.settings };
      document.documentElement.setAttribute('data-theme', this.settings.theme || 'light');
    }

    this.notify();
    return true;
  },

  /**
   * Seed Initial Demo Data (Indonesian Financial Context)
   */
  seedDefaultData() {
    const today = new Date();
    const formatDate = (offsetDays) => {
      const d = new Date(today);
      d.setDate(d.getDate() - offsetDays);
      return d.toISOString().split('T')[0];
    };

    this.user = {
      id: 'usr_demo_01',
      name: 'Rian Pratama',
      email: 'rian.pratama@example.com',
      role: 'Pekerja & Freelancer',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      created_at: formatDate(60)
    };

    this.incomes = [
      { id: 'inc_1', amount: 6500000, category: 'Gaji', description: 'Gaji Pokok Bulanan PT Digital Solusi', date: formatDate(18), created_at: formatDate(18) },
      { id: 'inc_2', amount: 1800000, category: 'Bisnis', description: 'Freelance Desain UI Website', date: formatDate(12), created_at: formatDate(12) },
      { id: 'inc_3', amount: 500000, category: 'Bonus', description: 'Insentif Performa Proyek Q4', date: formatDate(5), created_at: formatDate(5) },
      { id: 'inc_4', amount: 250000, category: 'Hadiah', description: 'Kado Ulang Tahun dari Keluarga', date: formatDate(2), created_at: formatDate(2) }
    ];

    this.expenses = [
      { id: 'exp_1', amount: 1500000, category: 'Tagihan', note: 'Sewa Kost & Listrik Bulanan', date: formatDate(17), created_at: formatDate(17) },
      { id: 'exp_2', amount: 850000, category: 'Kebutuhan sehari-hari', note: 'Belanja Bulanan Supermarket', date: formatDate(15), created_at: formatDate(15) },
      { id: 'exp_3', amount: 600000, category: 'Makanan', note: 'Makan Siang & Kuliner Mingguan', date: formatDate(10), created_at: formatDate(10) },
      { id: 'exp_4', amount: 350000, category: 'Transportasi', note: 'Bensin & Saldo E-Toll', date: formatDate(8), created_at: formatDate(8) },
      { id: 'exp_5', amount: 280000, category: 'Hiburan', note: 'Nonton Bioskop & Langganan Musik', date: formatDate(4), created_at: formatDate(4) },
      { id: 'exp_6', amount: 220000, category: 'Kesehatan', note: 'Vitamin & Check-up Dokter Gigi', date: formatDate(2), created_at: formatDate(2) }
    ];

    this.savings_goals = [
      {
        id: 'goal_1',
        name: 'Membeli Laptop Kerja Baru',
        target_amount: 12000000,
        target_date: '2027-04-30',
        icon: '💻',
        color: '#7C3AED',
        created_at: formatDate(45)
      },
      {
        id: 'goal_2',
        name: 'Dana Darurat 6 Bulan',
        target_amount: 15000000,
        target_date: '2027-12-31',
        icon: '🛡️',
        color: '#10B981',
        created_at: formatDate(40)
      },
      {
        id: 'goal_3',
        name: 'Liburan Akhir Tahun ke Bali',
        target_amount: 4000000,
        target_date: '2026-12-20',
        icon: '✈️',
        color: '#0EA5E9',
        created_at: formatDate(20)
      }
    ];

    this.savings_transactions = [
      { id: 'stx_1', goal_id: 'goal_1', amount: 3500000, type: 'deposit', date: formatDate(17), note: 'Setoran Awal Tabungan Laptop', created_at: formatDate(17) },
      { id: 'stx_2', goal_id: 'goal_1', amount: 1500000, type: 'deposit', date: formatDate(10), note: 'Tambahan dari Bonus Freelance', created_at: formatDate(10) },
      { id: 'stx_3', goal_id: 'goal_2', amount: 2000000, type: 'deposit', date: formatDate(16), note: 'Alokasi Rutin Dana Darurat', created_at: formatDate(16) },
      { id: 'stx_4', goal_id: 'goal_3', amount: 1200000, type: 'deposit', date: formatDate(6), note: 'Tabungan Tiket Pesawat', created_at: formatDate(6) }
    ];

    this.debts = [
      {
        id: 'debt_1',
        person_name: 'Budi Santoso',
        type: 'debt', // Utang kita ke Budi
        amount: 500000,
        transaction_date: formatDate(14),
        due_date: formatDate(-10),
        notes: 'Pinjaman darurat ganti ban motor',
        created_at: formatDate(14)
      },
      {
        id: 'debt_2',
        person_name: 'Dewi Lestari',
        type: 'receivable', // Piutang: Dewi meminjam uang dari kita
        amount: 800000,
        transaction_date: formatDate(20),
        due_date: formatDate(2), // Overdue!
        notes: 'Pinjaman modal jualan hampers',
        created_at: formatDate(20)
      }
    ];

    this.debt_payments = [
      {
        id: 'dpay_1',
        debt_id: 'debt_1',
        amount: 200000,
        payment_date: formatDate(7),
        notes: 'Cicilan pertama utang ban motor',
        created_at: formatDate(7)
      }
    ];

    this.chat_history = [
      {
        id: 'msg_1',
        role: 'assistant',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        text: 'Halo! 👋 Saya Gemini, asisten keuangan pribadi MoneyTrack. Saya siap membantu Anda menganalisis kondisi keuangan, memberikan tips menabung, serta mengevaluasi hasil laporan dari OpenAI!'
      }
    ];

    this.categories = {
      income: ['Uang saku', 'Gaji', 'Bonus', 'Hadiah', 'Bisnis', 'Pendapatan lainnya'],
      expense: ['Makanan', 'Transportasi', 'Pendidikan', 'Belanja', 'Hiburan', 'Kesehatan', 'Tagihan', 'Kebutuhan sehari-hari']
    };

    this.save();
  },

  // --- CRUD Incomes ---
  addIncome(data) {
    const item = {
      id: this.generateUUID(),
      amount: Number(data.amount) || 0,
      category: data.category || 'Pendapatan lainnya',
      description: data.description || 'Pemasukan baru',
      date: data.date || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };
    this.incomes.unshift(item);
    this.notify();

    if (this.isCloudUser()) {
      SupabaseManager.pushIncome(this.user.id, item).catch(console.error);
    }
    return item;
  },

  updateIncome(id, data) {
    const idx = this.incomes.findIndex(x => x.id === id);
    if (idx !== -1) {
      this.incomes[idx] = {
        ...this.incomes[idx],
        amount: Number(data.amount) || this.incomes[idx].amount,
        category: data.category || this.incomes[idx].category,
        description: data.description || this.incomes[idx].description,
        date: data.date || this.incomes[idx].date
      };
      this.notify();
      if (this.isCloudUser()) {
        SupabaseManager.updateIncome(this.user.id, id, this.incomes[idx]).catch(console.error);
      }
      return this.incomes[idx];
    }
    return null;
  },

  deleteIncome(id) {
    this.incomes = this.incomes.filter(x => x.id !== id);
    this.notify();
    if (this.isCloudUser()) {
      SupabaseManager.deleteIncome(this.user.id, id).catch(console.error);
    }
    return true;
  },

  // --- CRUD Expenses ---
  addExpense(data) {
    const item = {
      id: this.generateUUID(),
      amount: Number(data.amount) || 0,
      category: data.category || 'Kebutuhan sehari-hari',
      note: data.note || 'Pengeluaran baru',
      date: data.date || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };
    this.expenses.unshift(item);
    this.notify();

    if (this.isCloudUser()) {
      SupabaseManager.pushExpense(this.user.id, item).catch(console.error);
    }
    return item;
  },

  updateExpense(id, data) {
    const idx = this.expenses.findIndex(x => x.id === id);
    if (idx !== -1) {
      this.expenses[idx] = {
        ...this.expenses[idx],
        amount: Number(data.amount) || this.expenses[idx].amount,
        category: data.category || this.expenses[idx].category,
        note: data.note || this.expenses[idx].note,
        date: data.date || this.expenses[idx].date
      };
      this.notify();
      if (this.isCloudUser()) {
        SupabaseManager.updateExpense(this.user.id, id, this.expenses[idx]).catch(console.error);
      }
      return this.expenses[idx];
    }
    return null;
  },

  deleteExpense(id) {
    this.expenses = this.expenses.filter(x => x.id !== id);
    this.notify();
    if (this.isCloudUser()) {
      SupabaseManager.deleteExpense(this.user.id, id).catch(console.error);
    }
    return true;
  },

  // --- CRUD Savings Goals ---
  addSavingsGoal(data) {
    const goal = {
      id: this.generateUUID(),
      name: data.name,
      target_amount: Number(data.target_amount) || 0,
      target_date: data.target_date || '',
      icon: data.icon || '🎯',
      color: data.color || '#7C3AED',
      created_at: new Date().toISOString()
    };
    this.savings_goals.push(goal);
    this.notify();

    if (this.isCloudUser()) {
      SupabaseManager.pushSavingsGoal(this.user.id, goal).catch(console.error);
    }
    return goal;
  },

  updateSavingsGoal(id, data) {
    const idx = this.savings_goals.findIndex(x => x.id === id);
    if (idx !== -1) {
      this.savings_goals[idx] = {
        ...this.savings_goals[idx],
        name: data.name || this.savings_goals[idx].name,
        target_amount: Number(data.target_amount) || this.savings_goals[idx].target_amount,
        target_date: data.target_date !== undefined ? data.target_date : this.savings_goals[idx].target_date,
        icon: data.icon || this.savings_goals[idx].icon
      };
      this.notify();
      if (this.isCloudUser()) {
        SupabaseManager.updateSavingsGoal(this.user.id, id, this.savings_goals[idx]).catch(console.error);
      }
      return this.savings_goals[idx];
    }
    return null;
  },

  deleteSavingsGoal(id) {
    this.savings_goals = this.savings_goals.filter(x => x.id !== id);
    this.savings_transactions = this.savings_transactions.filter(tx => tx.goal_id !== id);
    this.notify();
    if (this.isCloudUser()) {
      SupabaseManager.deleteSavingsGoal(this.user.id, id).catch(console.error);
    }
    return true;
  },

  // --- Savings Deposits & Withdrawals (Internal Transfer) ---
  addSavingsTransaction(data) {
    const amount = Number(data.amount) || 0;
    if (amount <= 0) {
      throw new Error('Nominal transaksi harus lebih dari 0');
    }

    const availableBalance = FinanceCalculator.calculateAvailableBalance(
      this.incomes,
      this.expenses,
      this.savings_transactions
    );

    const goal = this.savings_goals.find(g => g.id === data.goal_id);
    if (!goal) {
      throw new Error('Target tabungan tidak ditemukan');
    }

    const progress = FinanceCalculator.calculateGoalProgress(goal, this.savings_transactions);

    if (data.type === 'deposit') {
      if (amount > availableBalance) {
        throw new Error(`Saldo tersedia tidak mencukupi (${FinanceCalculator.formatRupiah(availableBalance)}) untuk setor ${FinanceCalculator.formatRupiah(amount)}`);
      }
    } else if (data.type === 'withdraw') {
      if (amount > progress.collected) {
        throw new Error(`Uang di target tabungan ini hanya ada ${FinanceCalculator.formatRupiah(progress.collected)}`);
      }
    }

    const tx = {
      id: this.generateUUID(),
      goal_id: data.goal_id,
      amount: amount,
      type: data.type, // 'deposit' or 'withdraw'
      date: data.date || new Date().toISOString().split('T')[0],
      note: data.note || (data.type === 'deposit' ? 'Setoran Tabungan' : 'Penarikan Tabungan'),
      created_at: new Date().toISOString()
    };

    this.savings_transactions.push(tx);
    this.notify();

    if (this.isCloudUser()) {
      SupabaseManager.pushSavingsTx(this.user.id, tx).catch(console.error);
    }

    // Check if goal reached!
    const newProgress = FinanceCalculator.calculateGoalProgress(goal, this.savings_transactions);
    const reachedGoal = !progress.isCompleted && newProgress.isCompleted;

    return { tx, reachedGoal, goal };
  },

  // --- CRUD Debts ---
  addDebt(data) {
    const item = {
      id: this.generateUUID(),
      person_name: data.person_name,
      type: data.type, // 'debt' or 'receivable'
      amount: Number(data.amount) || 0,
      transaction_date: data.transaction_date || new Date().toISOString().split('T')[0],
      due_date: data.due_date || '',
      notes: data.notes || '',
      created_at: new Date().toISOString()
    };
    this.debts.unshift(item);
    this.notify();

    if (this.isCloudUser()) {
      SupabaseManager.pushDebt(this.user.id, item).catch(console.error);
    }
    return item;
  },

  updateDebt(id, data) {
    const idx = this.debts.findIndex(x => x.id === id);
    if (idx !== -1) {
      this.debts[idx] = {
        ...this.debts[idx],
        person_name: data.person_name || this.debts[idx].person_name,
        type: data.type || this.debts[idx].type,
        amount: Number(data.amount) || this.debts[idx].amount,
        transaction_date: data.transaction_date || this.debts[idx].transaction_date,
        due_date: data.due_date !== undefined ? data.due_date : this.debts[idx].due_date,
        notes: data.notes !== undefined ? data.notes : this.debts[idx].notes
      };
      this.notify();
      if (this.isCloudUser()) {
        SupabaseManager.updateDebt(this.user.id, id, this.debts[idx]).catch(console.error);
      }
      return this.debts[idx];
    }
    return null;
  },

  deleteDebt(id) {
    this.debts = this.debts.filter(x => x.id !== id);
    this.debt_payments = this.debt_payments.filter(p => p.debt_id !== id);
    this.notify();
    if (this.isCloudUser()) {
      SupabaseManager.deleteDebt(this.user.id, id).catch(console.error);
    }
    return true;
  },

  addDebtPayment(data) {
    const amount = Number(data.amount) || 0;
    if (amount <= 0) throw new Error('Nominal pembayaran harus lebih dari 0');

    const debt = this.debts.find(d => d.id === data.debt_id);
    if (!debt) throw new Error('Catatan utang/piutang tidak ditemukan');

    const totalPaid = this.debt_payments
      .filter(p => String(p.debt_id) === String(debt.id))
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const remaining = Math.max(0, (Number(debt.amount) || 0) - totalPaid);

    if (amount > remaining) {
      throw new Error(`Nominal pembayaran melebihi sisa tagihan (${FinanceCalculator.formatRupiah(remaining)})`);
    }

    const payment = {
      id: this.generateUUID(),
      debt_id: data.debt_id,
      amount: amount,
      payment_date: data.payment_date || new Date().toISOString().split('T')[0],
      notes: data.notes || '',
      created_at: new Date().toISOString()
    };

    this.debt_payments.push(payment);
    this.notify();

    if (this.isCloudUser()) {
      SupabaseManager.pushDebtPayment(this.user.id, payment).catch(console.error);
    }
    return payment;
  },

  // --- Consolidated Transactions for History ---
  getConsolidatedTransactions() {
    const items = [];

    // Incomes
    this.incomes.forEach(inc => {
      items.push({
        id: inc.id,
        rawId: inc.id,
        originType: 'income',
        typeLabel: 'Pemasukan',
        title: inc.description,
        category: inc.category,
        amount: inc.amount,
        isPositive: true,
        date: inc.date,
        created_at: inc.created_at
      });
    });

    // Expenses
    this.expenses.forEach(exp => {
      items.push({
        id: exp.id,
        rawId: exp.id,
        originType: 'expense',
        typeLabel: 'Pengeluaran',
        title: exp.note,
        category: exp.category,
        amount: exp.amount,
        isPositive: false,
        date: exp.date,
        created_at: exp.created_at
      });
    });

    // Savings Transactions
    this.savings_transactions.forEach(stx => {
      const goal = this.savings_goals.find(g => g.id === stx.goal_id);
      const isDeposit = stx.type === 'deposit';
      items.push({
        id: stx.id,
        rawId: stx.id,
        originType: 'savings',
        typeLabel: isDeposit ? 'Setor Tabungan' : 'Tarik Tabungan',
        title: `${isDeposit ? 'Setoran ke' : 'Penarikan dari'} ${goal ? goal.name : 'Tabungan'}`,
        category: 'Transfer Tabungan',
        amount: stx.amount,
        isPositive: !isDeposit,
        isTransfer: true,
        date: stx.date,
        created_at: stx.created_at
      });
    });

    // Debt Payments
    this.debt_payments.forEach(dpay => {
      const debt = this.debts.find(d => d.id === dpay.debt_id);
      const isDebt = debt ? debt.type === 'debt' : true;
      items.push({
        id: dpay.id,
        rawId: dpay.id,
        originType: 'debt_payment',
        typeLabel: isDebt ? 'Bayar Utang' : 'Terima Piutang',
        title: `Pembayaran ${isDebt ? 'Utang ke' : 'Piutang dari'} ${debt ? debt.person_name : 'Pihak Terkait'}`,
        category: isDebt ? 'Pelunasan Utang' : 'Penerimaan Piutang',
        amount: dpay.amount,
        isPositive: !isDebt,
        date: dpay.payment_date,
        created_at: dpay.created_at
      });
    });

    return items.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  }
};

window.AppState = AppState;
