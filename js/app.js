/**
 * MONEYTRACK - APPLICATION MAIN CONTROLLER
 * Bootstraps the application, handles events, splash screen, auth, and user interactions.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize State (from LocalStorage & optional Supabase session)
  await AppState.init();

  // 2. Subscribe UI to State updates
  AppState.subscribe(() => {
    UI.renderCurrentView();
  });

  // 3. Splash Screen Logic
  const splash = document.getElementById('splash-screen');
  setTimeout(() => {
    if (splash) {
      splash.classList.add('hidden');
    }
    // Check authentication
    checkAuthStatus();
  }, 1600);

  // 4. Auth State Handler
  function checkAuthStatus() {
    const authContainer = document.getElementById('auth-container');
    const appLayout = document.getElementById('app-layout');

    if (AppState.user) {
      if (authContainer) authContainer.style.display = 'none';
      if (appLayout) appLayout.style.display = 'flex';
      UI.switchView('dashboard');
    } else {
      if (authContainer) authContainer.style.display = 'flex';
      if (appLayout) appLayout.style.display = 'none';
    }
  }

  // Auth Tabs (Login vs Register)
  const tabLogin = document.getElementById('tab-btn-login');
  const tabRegister = document.getElementById('tab-btn-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');

  if (tabLogin && tabRegister) {
    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      formLogin.style.display = 'block';
      formRegister.style.display = 'none';
    });

    tabRegister.addEventListener('click', () => {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      formRegister.style.display = 'block';
      formLogin.style.display = 'none';
    });
  }

  // Login Form Submission
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      if (!email || !email.includes('@')) {
        UI.showToast('Masukkan alamat email yang valid', 'error');
        return;
      }
      if (password.length < 6) {
        UI.showToast('Password minimal 6 karakter', 'error');
        return;
      }

      // If Supabase Cloud is configured, sign in via Supabase Auth
      if (typeof SupabaseManager !== 'undefined' && SupabaseManager.isReady) {
        try {
          const authData = await SupabaseManager.signIn(email, password);
          if (authData?.user) {
            AppState.user = {
              id: authData.user.id,
              name: authData.user.user_metadata?.full_name || email.split('@')[0],
              email: authData.user.email,
              role: 'Pengguna MoneyTrack',
              avatar: '',
              created_at: authData.user.created_at
            };
            await AppState.syncFromSupabase(authData.user.id);
            AppState.save();
            UI.showToast(`Selamat datang kembali, ${AppState.user.name}!`, 'success');
            checkAuthStatus();
            return;
          }
        } catch (err) {
          UI.showToast(`Login Supabase gagal: ${err.message}`, 'error');
          return;
        }
      }

      // Local persistent authentication (preserves existing user transactions if same email)
      const prevEmail = StorageAdapter.get('last_user_email', null);
      if (prevEmail && prevEmail !== email) {
        AppState.resetEmptyState(false);
      }

      AppState.user = {
        id: 'usr_' + Date.now(),
        name: email.split('@')[0].replace(/\./g, ' '),
        email: email,
        role: 'Pengguna MoneyTrack',
        avatar: '',
        created_at: new Date().toISOString()
      };
      StorageAdapter.set('last_user_email', email);
      AppState.save();
      UI.showToast(`Selamat datang kembali, ${AppState.user.name}!`, 'success');
      checkAuthStatus();
    });
  }

  // Register Form Submission
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('register-name').value.trim();
      const email = document.getElementById('register-email').value.trim();
      const password = document.getElementById('register-password').value;
      const confirm = document.getElementById('register-confirm').value;

      if (!name) {
        UI.showToast('Nama lengkap wajib diisi', 'error');
        return;
      }
      if (!email || !email.includes('@')) {
        UI.showToast('Masukkan email yang valid', 'error');
        return;
      }
      if (password.length < 6) {
        UI.showToast('Password minimal 6 karakter', 'error');
        return;
      }
      if (password !== confirm) {
        UI.showToast('Konfirmasi password tidak cocok', 'error');
        return;
      }

      // If Supabase Cloud is configured, register via Supabase Auth
      if (typeof SupabaseManager !== 'undefined' && SupabaseManager.isReady) {
        try {
          const authData = await SupabaseManager.signUp(email, password, name);
          AppState.resetEmptyState(false);
          AppState.user = {
            id: authData?.user?.id || ('usr_' + Date.now()),
            name: name,
            email: email,
            role: 'Pengguna Baru',
            avatar: '',
            created_at: new Date().toISOString()
          };
          StorageAdapter.set('last_user_email', email);
          AppState.save();
          UI.showToast(`Pendaftaran berhasil! Selamat datang, ${name}!`, 'success');
          checkAuthStatus();
          return;
        } catch (err) {
          UI.showToast(`Pendaftaran Supabase gagal: ${err.message}`, 'error');
          return;
        }
      }

      // New local user always starts with clean empty data (no demo transactions)
      AppState.resetEmptyState(false);
      AppState.user = {
        id: 'usr_' + Date.now(),
        name: name,
        email: email,
        role: 'Pengguna Baru',
        avatar: '',
        created_at: new Date().toISOString()
      };
      StorageAdapter.set('last_user_email', email);
      AppState.save();
      UI.showToast(`Pendaftaran berhasil! Selamat datang, ${name}!`, 'success');
      checkAuthStatus();
    });
  }

  // Logout Handlers
  window.handleLogout = async () => {
    if (confirm('Apakah Anda yakin ingin keluar dari akun MoneyTrack?')) {
      if (typeof SupabaseManager !== 'undefined' && SupabaseManager.isReady) {
        try { await SupabaseManager.signOut(); } catch (_) {}
      }
      AppState.user = null;
      AppState.save();
      checkAuthStatus();
      UI.showToast('Anda telah berhasil keluar.', 'info');
    }
  };

  // Demo Login Shortcut
  window.loginAsDemo = () => {
    AppState.seedDefaultData();
    checkAuthStatus();
    UI.showToast('Masuk dengan Akun Demo Rian Pratama', 'success');
  };

  // 5. Navigation Click Handlers
  document.querySelectorAll('[data-view]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = item.getAttribute('data-view');
      if (targetView) {
        UI.switchView(targetView);
      }
    });
  });

  // Mobile Sidebar Toggle
  const sidebarToggle = document.getElementById('sidebar-toggle-btn');
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  if (sidebarToggle && sidebar && backdrop) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('active');
    });

    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('active');
    });
  }

  // 6. Modal Close Buttons and Backdrop Clicks
  document.querySelectorAll('.modal-backdrop').forEach(modalBackdrop => {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        modalBackdrop.classList.remove('active');
      }
    });
  });

  document.querySelectorAll('.modal-close-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      const parentModal = btn.closest('.modal-backdrop');
      if (parentModal) parentModal.classList.remove('active');
    });
  });

  // 7. Form Handlers

  // ADD INCOME
  const formAddIncome = document.getElementById('form-add-income');
  if (formAddIncome) {
    formAddIncome.addEventListener('submit', (e) => {
      e.preventDefault();
      const desc = document.getElementById('add-income-desc').value.trim();
      const amount = FinanceCalculator.parseAmount(document.getElementById('add-income-amount').value);
      const category = document.getElementById('add-income-category').value;
      const date = document.getElementById('add-income-date').value;

      if (!desc || amount <= 0) {
        UI.showToast('Deskripsi dan nominal pemasukan harus valid', 'error');
        return;
      }

      AppState.addIncome({ description: desc, amount, category, date });
      UI.closeModal('modal-add-income');
      formAddIncome.reset();
      document.getElementById('add-income-date').value = new Date().toISOString().split('T')[0];
      UI.showToast('Pemasukan berhasil ditambahkan! 💰', 'success');
    });
  }

  // EDIT INCOME
  const formEditIncome = document.getElementById('form-edit-income');
  if (formEditIncome) {
    formEditIncome.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-income-id').value;
      const desc = document.getElementById('edit-income-desc').value.trim();
      const amount = FinanceCalculator.parseAmount(document.getElementById('edit-income-amount').value);
      const category = document.getElementById('edit-income-category').value;
      const date = document.getElementById('edit-income-date').value;

      AppState.updateIncome(id, { description: desc, amount, category, date });
      UI.closeModal('modal-edit-income');
      UI.showToast('Pemasukan berhasil diperbarui', 'success');
    });
  }

  // ADD EXPENSE
  const formAddExpense = document.getElementById('form-add-expense');
  if (formAddExpense) {
    formAddExpense.addEventListener('submit', (e) => {
      e.preventDefault();
      const note = document.getElementById('add-expense-note').value.trim();
      const amount = FinanceCalculator.parseAmount(document.getElementById('add-expense-amount').value);
      const category = document.getElementById('add-expense-category').value;
      const date = document.getElementById('add-expense-date').value;

      if (!note || amount <= 0) {
        UI.showToast('Catatan dan nominal pengeluaran harus valid', 'error');
        return;
      }

      AppState.addExpense({ note, amount, category, date });
      UI.closeModal('modal-add-expense');
      formAddExpense.reset();
      document.getElementById('add-expense-date').value = new Date().toISOString().split('T')[0];
      UI.showToast('Pengeluaran berhasil dicatat! 📉', 'info');
    });
  }

  // EDIT EXPENSE
  const formEditExpense = document.getElementById('form-edit-expense');
  if (formEditExpense) {
    formEditExpense.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-expense-id').value;
      const note = document.getElementById('edit-expense-note').value.trim();
      const amount = FinanceCalculator.parseAmount(document.getElementById('edit-expense-amount').value);
      const category = document.getElementById('edit-expense-category').value;
      const date = document.getElementById('edit-expense-date').value;

      AppState.updateExpense(id, { note, amount, category, date });
      UI.closeModal('modal-edit-expense');
      UI.showToast('Pengeluaran berhasil diperbarui', 'success');
    });
  }

  // ADD SAVINGS GOAL
  const formAddSavingsGoal = document.getElementById('form-add-savings-goal');
  if (formAddSavingsGoal) {
    formAddSavingsGoal.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('add-goal-name').value.trim();
      const target_amount = FinanceCalculator.parseAmount(document.getElementById('add-goal-amount').value);
      const target_date = document.getElementById('add-goal-date').value;
      const icon = document.getElementById('add-goal-icon').value || '🎯';

      if (!name || target_amount <= 0) {
        UI.showToast('Nama target dan nominal harus diisi dengan benar', 'error');
        return;
      }

      AppState.addSavingsGoal({ name, target_amount, target_date, icon });
      UI.closeModal('modal-add-savings-goal');
      formAddSavingsGoal.reset();
      UI.showToast(`Target "${name}" berhasil dibuat! 🎯`, 'success');
    });
  }

  // SAVINGS TRANSFER (SETOR / TARIK)
  const formSavingsTransfer = document.getElementById('form-savings-transfer');
  if (formSavingsTransfer) {
    formSavingsTransfer.addEventListener('submit', (e) => {
      e.preventDefault();
      const goal_id = document.getElementById('savings-transfer-goal-id').value;
      const type = document.getElementById('savings-transfer-type').value;
      const amount = FinanceCalculator.parseAmount(document.getElementById('savings-transfer-amount').value);
      const date = document.getElementById('savings-transfer-date').value;
      const note = document.getElementById('savings-transfer-note').value.trim();

      try {
        const result = AppState.addSavingsTransaction({ goal_id, type, amount, date, note });
        UI.closeModal('modal-savings-transfer');

        if (result.reachedGoal) {
          UI.showToast(`🎉 SELAMAT! Target tabungan "${result.goal.name}" telah 100% tercapai!`, 'success');
        } else {
          UI.showToast(`${type === 'deposit' ? 'Setoran' : 'Penarikan'} berhasil diproses!`, 'success');
        }
      } catch (err) {
        UI.showToast(err.message, 'error');
      }
    });
  }

  // EDIT SAVINGS GOAL
  const formEditSavingsGoal = document.getElementById('form-edit-savings-goal');
  if (formEditSavingsGoal) {
    formEditSavingsGoal.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-goal-id').value;
      const name = document.getElementById('edit-goal-name').value.trim();
      const target_amount = FinanceCalculator.parseAmount(document.getElementById('edit-goal-amount').value);
      const target_date = document.getElementById('edit-goal-date').value;
      const icon = document.getElementById('edit-goal-icon').value || '🎯';

      if (!name || target_amount <= 0) {
        UI.showToast('Nama target dan nominal harus valid', 'error');
        return;
      }

      AppState.updateSavingsGoal(id, { name, target_amount, target_date, icon });
      UI.closeModal('modal-edit-savings-goal');
      UI.showToast('Target tabungan berhasil diperbarui!', 'success');
    });
  }

  // ADD DEBT / RECEIVABLE
  const formAddDebt = document.getElementById('form-add-debt');
  if (formAddDebt) {
    formAddDebt.addEventListener('submit', (e) => {
      e.preventDefault();
      const person_name = document.getElementById('add-debt-person').value.trim();
      const type = document.getElementById('add-debt-type').value; // 'debt' or 'receivable'
      const amount = FinanceCalculator.parseAmount(document.getElementById('add-debt-amount').value);
      const transaction_date = document.getElementById('add-debt-date').value;
      const due_date = document.getElementById('add-debt-due').value;
      const notes = document.getElementById('add-debt-notes').value.trim();

      if (!person_name || amount <= 0) {
        UI.showToast('Nama pihak dan nominal harus diisi', 'error');
        return;
      }

      AppState.addDebt({ person_name, type, amount, transaction_date, due_date, notes });
      UI.closeModal('modal-add-debt');
      formAddDebt.reset();
      document.getElementById('add-debt-date').value = new Date().toISOString().split('T')[0];
      UI.showToast(`${type === 'debt' ? 'Utang' : 'Piutang'} berhasil dicatat`, 'success');
    });
  }

  // EDIT DEBT / RECEIVABLE
  const formEditDebt = document.getElementById('form-edit-debt');
  if (formEditDebt) {
    formEditDebt.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-debt-id').value;
      const person_name = document.getElementById('edit-debt-person').value.trim();
      const type = document.getElementById('edit-debt-type').value;
      const amount = FinanceCalculator.parseAmount(document.getElementById('edit-debt-amount').value);
      const transaction_date = document.getElementById('edit-debt-date').value;
      const due_date = document.getElementById('edit-debt-due').value;
      const notes = document.getElementById('edit-debt-notes').value.trim();

      if (!person_name || amount <= 0) {
        UI.showToast('Nama pihak dan nominal harus valid', 'error');
        return;
      }

      AppState.updateDebt(id, { person_name, type, amount, transaction_date, due_date, notes });
      UI.closeModal('modal-edit-debt');
      UI.showToast('Catatan utang/piutang berhasil diperbarui!', 'success');
    });
  }

  // MANAGE CATEGORIES (ADD CATEGORY)
  const formAddCategory = document.getElementById('form-add-category');
  if (formAddCategory) {
    formAddCategory.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('new-category-name');
      const name = nameInput?.value.trim();
      try {
        AppState.addCategory(UI.activeCategoryTab, name);
        if (nameInput) nameInput.value = '';
        UI.renderCategoryList();
        UI.showToast(`Kategori "${name}" berhasil ditambahkan!`, 'success');
      } catch (err) {
        UI.showToast(err.message, 'error');
      }
    });
  }

  // DEBT PAYMENT
  const formDebtPayment = document.getElementById('form-debt-payment');
  if (formDebtPayment) {
    formDebtPayment.addEventListener('submit', (e) => {
      e.preventDefault();
      const debt_id = document.getElementById('debt-payment-id').value;
      const amount = FinanceCalculator.parseAmount(document.getElementById('debt-payment-amount').value);
      const payment_date = document.getElementById('debt-payment-date').value;
      const notes = document.getElementById('debt-payment-notes').value.trim();

      try {
        AppState.addDebtPayment({ debt_id, amount, payment_date, notes });
        UI.closeModal('modal-debt-payment');
        UI.showToast('Pembayaran berhasil dicatat!', 'success');
      } catch (err) {
        UI.showToast(err.message, 'error');
      }
    });
  }

  // 8. AI Analysis Trigger (OpenAI)
  const btnRunAnalysis = document.getElementById('btn-run-ai-analysis');
  if (btnRunAnalysis) {
    btnRunAnalysis.addEventListener('click', async () => {
      const originalText = btnRunAnalysis.innerHTML;
      btnRunAnalysis.disabled = true;
      btnRunAnalysis.innerHTML = `
        <span class="splash-dot" style="width: 6px; height: 6px; background: var(--primary);"></span>
        <span>Menganalisis data...</span>
      `;

      try {
        const result = await AIService.runOpenAIAnalysis(AppState);
        AppState.ai_analysis = result;
        AppState.save();
        UI.renderAIAnalysis();
        UI.showToast('Analisis Keuangan AI berhasil diperbarui!', 'success');
      } catch (err) {
        UI.showToast('Gagal memproses analisis AI', 'error');
      } finally {
        btnRunAnalysis.disabled = false;
        btnRunAnalysis.innerHTML = originalText;
      }
    });
  }

  // 9. AI Chatbot Trigger (Gemini)
  const formChat = document.getElementById('form-chat');
  const chatInput = document.getElementById('chat-input-field');

  async function handleSendChatMessage(text) {
    if (!text || !text.trim()) return;

    // Push user message
    const userMsg = {
      id: 'msg_' + Date.now(),
      role: 'user',
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      text: text.trim()
    };
    AppState.chat_history.push(userMsg);
    if (chatInput) chatInput.value = '';
    UI.renderAIChat();

    // Show typing bubble
    const messagesEl = document.getElementById('chat-messages-stream');
    const typingBubble = document.createElement('div');
    typingBubble.className = 'message-row assistant';
    typingBubble.id = 'temp-typing-bubble';
    typingBubble.innerHTML = `
      <div class="message-avatar">✨</div>
      <div class="typing-bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    if (messagesEl) {
      messagesEl.appendChild(typingBubble);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    try {
      const replyText = await AIService.sendGeminiMessage(text, AppState, AppState.chat_history);
      const assistantMsg = {
        id: 'msg_' + (Date.now() + 1),
        role: 'assistant',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        text: replyText
      };
      AppState.chat_history.push(assistantMsg);
      AppState.save();
    } catch (err) {
      UI.showToast('Gagal menghubungi asisten AI', 'error');
    } finally {
      const temp = document.getElementById('temp-typing-bubble');
      if (temp) temp.remove();
      UI.renderAIChat();
    }
  }

  if (formChat) {
    formChat.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSendChatMessage(chatInput.value);
    });
  }

  // Suggestion Pills Click
  document.querySelectorAll('.suggestion-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const prompt = pill.getAttribute('data-prompt') || pill.textContent.trim();
      handleSendChatMessage(prompt);
    });
  });

  // 10. Financial History Filters & Report Period Filters
  const searchInput = document.getElementById('history-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => UI.renderHistory());
  }

  const histDateFrom = document.getElementById('history-date-from');
  const histDateTo = document.getElementById('history-date-to');
  const histCatFilter = document.getElementById('history-category-filter');
  const histResetBtn = document.getElementById('history-reset-filter');

  if (histDateFrom) histDateFrom.addEventListener('change', () => UI.renderHistory());
  if (histDateTo) histDateTo.addEventListener('change', () => UI.renderHistory());
  if (histCatFilter) histCatFilter.addEventListener('change', () => UI.renderHistory());
  if (histResetBtn) {
    histResetBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (histDateFrom) histDateFrom.value = '';
      if (histDateTo) histDateTo.value = '';
      if (histCatFilter) histCatFilter.value = 'all';
      document.querySelectorAll('.filter-pills .pill-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-filter') === 'all');
      });
      UI.renderHistory();
    });
  }

  document.querySelectorAll('.filter-pills .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-pills .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      UI.renderHistory();
    });
  });

  // Report Period Filter Pills
  document.querySelectorAll('[data-report-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-report-period]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      UI.activeReportPeriod = btn.getAttribute('data-report-period') || 'all';
      UI.renderReports();
    });
  });

  // 11. Profile & Settings Save
  const formSettings = document.getElementById('form-settings');
  if (formSettings) {
    formSettings.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('setting-name-input').value.trim();
      const role = document.getElementById('setting-role-input').value.trim();
      const theme = document.getElementById('setting-theme-select').value;

      if (AppState.user) {
        AppState.user.name = name || AppState.user.name;
        AppState.user.role = role || AppState.user.role;
      }
      AppState.settings.theme = theme;
      document.documentElement.setAttribute('data-theme', theme);
      AppState.save();
      if (AppState.isCloudUser()) {
        SupabaseManager.updateProfile(AppState.user.id, {
          name: AppState.user.name,
          email: AppState.user.email,
          role: AppState.user.role,
          theme: AppState.settings.theme,
          categories: AppState.categories
        }).catch(console.error);
      }
      UI.showToast('Pengaturan profil dan tampilan berhasil disimpan!', 'success');
      UI.updateUserSidebar();
    });
  }

  // 12. Supabase Configuration Save & Test
  const formSupabase = document.getElementById('form-supabase-config');
  if (formSupabase) {
    formSupabase.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = document.getElementById('setting-supabase-url').value.trim();
      const anonKey = document.getElementById('setting-supabase-anon-key').value.trim();

      if (!url || !anonKey) {
        UI.showToast('Harap masukkan Project URL dan Anon Key Supabase', 'error');
        return;
      }

      UI.showToast('Menguji koneksi ke Supabase...', 'info');
      const test = await SupabaseManager.testConnection(url, anonKey);
      
      if (test.success) {
        SupabaseManager.saveCredentials(url, anonKey);
        UI.showToast(test.message, 'success');
        UI.renderSettings();
      } else {
        UI.showToast(test.message, 'error');
      }
    });
  }

  // 13. AI Keys Save (OpenAI & Gemini)
  const formAiKeys = document.getElementById('form-ai-keys');
  if (formAiKeys) {
    formAiKeys.addEventListener('submit', (e) => {
      e.preventDefault();
      const openAiKey = document.getElementById('setting-openai-key').value.trim();
      const geminiKey = document.getElementById('setting-gemini-key').value.trim();

      StorageAdapter.set('openai_custom_key', openAiKey);
      StorageAdapter.set('gemini_custom_key', geminiKey);
      UI.showToast('Kunci API OpenAI & Gemini berhasil disimpan di browser!', 'success');
    });
  }

  // Sync Data with Supabase Cloud
  window.syncWithSupabaseNow = async () => {
    if (!SupabaseManager.isReady) {
      UI.showToast('Supabase belum terhubung. Simpan URL dan Anon Key terlebih dahulu.', 'warning');
      return;
    }
    UI.showToast('Menyinkronkan data dengan Supabase PostgreSQL...', 'info');
    try {
      const session = await SupabaseManager.getSession();
      const userId = session?.user?.id || AppState.user?.id;
      if (userId) {
        await AppState.syncFromSupabase(userId);
        UI.showToast('Data berhasil disinkronkan dengan cloud!', 'success');
      } else {
        UI.showToast('Silakan login dengan akun Supabase untuk sinkronisasi penuh.', 'info');
      }
    } catch (err) {
      UI.showToast(`Sinkronisasi gagal: ${err.message}`, 'error');
    }
  };

  // Data Export, Excel, PDF & Restore
  window.exportFinancialData = () => {
    StorageAdapter.exportData(AppState);
    UI.showToast('Data berhasil diekspor ke file JSON', 'success');
  };

  window.exportFinancialExcel = (period = 'all') => {
    StorageAdapter.exportToExcelCSV(AppState, period);
    UI.showToast('Laporan berhasil diekspor ke file Excel (.CSV)', 'success');
  };

  window.printFinancialPDF = () => {
    UI.showToast('Menyiapkan tampilan cetak / PDF...', 'info');
    setTimeout(() => StorageAdapter.printReportPDF(), 250);
  };

  const restoreInput = document.getElementById('restore-backup-input');
  if (restoreInput) {
    restoreInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          if (confirm('Pulihkan data dari file cadangan ini? Data transaksi saat ini akan diganti dengan isi file cadangan.')) {
            AppState.importBackupData(parsed);
            UI.showToast('Data cadangan berhasil dipulihkan!', 'success');
            UI.renderCurrentView();
          }
        } catch (err) {
          UI.showToast(`Gagal memulihkan data: ${err.message}`, 'error');
        } finally {
          restoreInput.value = '';
        }
      };
      reader.readAsText(file);
    });
  }

  window.resetToDemoData = () => {
    if (confirm('Kembalikan seluruh data ke setelan demo awal? Data yang belum diekspor akan diganti.')) {
      AppState.seedDefaultData();
      UI.showToast('Data demo berhasil dipulihkan', 'info');
      UI.renderCurrentView();
    }
  };

  // Set today's date only on transaction date inputs (not filter or due dates)
  const todayStr = new Date().toISOString().split('T')[0];
  const excludedDateIds = new Set(['history-date-from', 'history-date-to', 'add-goal-date', 'edit-goal-date', 'add-debt-due', 'edit-debt-due']);
  document.querySelectorAll('input[type="date"]').forEach(input => {
    if (!input.value && !excludedDateIds.has(input.id)) {
      input.value = todayStr;
    }
  });

  // Topbar Date display
  const topbarDate = document.getElementById('topbar-current-date');
  if (topbarDate) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    topbarDate.textContent = new Date().toLocaleDateString('id-ID', options);
  }
});
