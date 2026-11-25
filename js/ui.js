/**
 * MONEYTRACK - UI RENDERING & VIEW CONTROLLER
 * Orchestrates DOM manipulation, components rendering, modals, and toasts.
 */

const UI = {
  activeView: 'dashboard',
  activeReportPeriod: 'all',
  activeCategoryTab: 'income',

  /**
   * Display toast notification
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    if (type === 'success') {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    } else if (type === 'warning') {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    }

    toast.innerHTML = `
      <div class="toast-icon">${iconSvg}</div>
      <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  },

  /**
   * Switch Active View / Page
   */
  switchView(viewName) {
    this.activeView = viewName;

    // Update nav items
    document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(el => {
      if (el.getAttribute('data-view') === viewName) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Update view sections
    document.querySelectorAll('.view-section').forEach(sec => {
      if (sec.id === `view-${viewName}`) {
        sec.classList.add('active');
      } else {
        sec.classList.remove('active');
      }
    });

    // Update topbar title
    const titles = {
      'dashboard': { title: 'Dashboard', sub: 'Ringkasan & Kondisi Finansial Anda' },
      'incomes': { title: 'Income Tracker', sub: 'Kelola Seluruh Sumber Pemasukan Anda' },
      'expenses': { title: 'Expense Tracker', sub: 'Pantau & Kendalikan Pengeluaran Harian' },
      'savings': { title: 'Savings Tracker', sub: 'Raih Target Tabungan Tanpa Dobel Hitung' },
      'debts': { title: 'Debt & Receivable Tracker', sub: 'Manajemen Utang dan Piutang Teratur' },
      'history': { title: 'Riwayat Keuangan', sub: 'Log Seluruh Aliran Transaksi Anda' },
      'reports': { title: 'Laporan Keuangan', sub: 'Analisis Statistik dan Tren Finansial' },
      'ai-analysis': { title: 'AI Financial Analysis', sub: 'Evaluasi Mendalam Berbasis OpenAI' },
      'ai-chat': { title: 'AI Financial Chatbot', sub: 'Tanya Jawab Pintar bersama Gemini' },
      'settings': { title: 'Profil & Pengaturan', sub: 'Sesuaikan Akun dan Preferensi Anda' }
    };

    const topInfo = titles[viewName] || { title: 'MoneyTrack', sub: 'Kelola Uangmu, Wujudkan Tujuanmu' };
    const titleEl = document.getElementById('topbar-title');
    const subEl = document.getElementById('topbar-subtitle');
    if (titleEl) titleEl.textContent = topInfo.title;
    if (subEl) subEl.textContent = topInfo.sub;

    // Render corresponding view content
    this.renderCurrentView();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Close mobile sidebar if open
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
  },

  /**
   * Render Current View based on State
   */
  renderCurrentView() {
    this.populateCategoryDropdowns();
    switch (this.activeView) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'incomes':
        this.renderIncomes();
        break;
      case 'expenses':
        this.renderExpenses();
        break;
      case 'savings':
        this.renderSavings();
        break;
      case 'debts':
        this.renderDebts();
        break;
      case 'history':
        this.renderHistory();
        break;
      case 'reports':
        this.renderReports();
        break;
      case 'ai-analysis':
        this.renderAIAnalysis();
        break;
      case 'ai-chat':
        this.renderAIChat();
        break;
      case 'settings':
        this.renderSettings();
        break;
    }
    this.updateUserSidebar();
  },

  updateUserSidebar() {
    const user = AppState.user;
    if (!user) return;
    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    const avatarEl = document.getElementById('sidebar-user-avatar');
    if (nameEl) nameEl.textContent = user.name || 'Pengguna';
    if (roleEl) roleEl.textContent = user.role || 'Pribadi';
    if (avatarEl) {
      if (user.avatar) {
        avatarEl.innerHTML = `<img src="${user.avatar}" alt="${user.name}">`;
      } else {
        avatarEl.textContent = (user.name || 'U').charAt(0).toUpperCase();
      }
    }
  },

  /**
   * 1. DASHBOARD VIEW
   */
  renderDashboard() {
    const metrics = FinanceCalculator.getDashboardMetrics(AppState);

    // Update 6 Core Stat Cards
    const valBalance = document.getElementById('dash-available-balance');
    const valIncome = document.getElementById('dash-total-income');
    const valExpense = document.getElementById('dash-total-expense');
    const valSavings = document.getElementById('dash-total-savings');
    const valDebt = document.getElementById('dash-total-debt');
    const valReceivable = document.getElementById('dash-total-receivable');

    if (valBalance) valBalance.textContent = FinanceCalculator.formatRupiah(metrics.availableBalance);
    if (valIncome) valIncome.textContent = FinanceCalculator.formatRupiah(metrics.totalIncome);
    if (valExpense) valExpense.textContent = FinanceCalculator.formatRupiah(metrics.totalExpense);
    if (valSavings) valSavings.textContent = FinanceCalculator.formatRupiah(metrics.currentSavings);
    if (valDebt) valDebt.textContent = FinanceCalculator.formatRupiah(metrics.totalDebt);
    if (valReceivable) valReceivable.textContent = FinanceCalculator.formatRupiah(metrics.totalReceivable);

    // Cashflow Chart
    AppCharts.renderDashboardCashflowChart('dash-cashflow-chart', AppState.incomes, AppState.expenses);

    // Recent Transactions (top 5)
    const recentTx = AppState.getConsolidatedTransactions().slice(0, 5);
    const txContainer = document.getElementById('dash-recent-transactions');
    if (txContainer) {
      if (recentTx.length === 0) {
        txContainer.innerHTML = `
          <tr>
            <td colspan="3" style="text-align: center; padding: 1.75rem;">
              <p class="empty-desc" style="margin: 0 auto;">Belum ada transaksi yang tercatat. Klik "+ Pemasukan" atau "+ Pengeluaran" untuk memulai.</p>
            </td>
          </tr>
        `;
      } else {
        txContainer.innerHTML = recentTx.map(tx => {
          const isPos = tx.isPositive;
          const sign = isPos ? '+' : '-';
          const colorClass = isPos ? 'text-income' : 'text-expense';
          let badgeClass = 'badge-secondary';
          if (tx.originType === 'income') badgeClass = 'badge-income';
          else if (tx.originType === 'expense') badgeClass = 'badge-expense';
          else if (tx.originType === 'savings') badgeClass = 'badge-transfer';

          return `
            <tr>
              <td>
                <div style="font-weight: 700; color: var(--text-main);">${tx.title || 'Transaksi'}</div>
                <div style="font-size: 0.76rem; color: var(--text-muted);">${tx.date}</div>
              </td>
              <td><span class="badge ${badgeClass}">${tx.category || tx.typeLabel}</span></td>
              <td class="table-amount ${colorClass}" style="text-align: right;">
                ${sign}${FinanceCalculator.formatRupiah(tx.amount)}
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // Mini Savings Targets Summary
    const goalsContainer = document.getElementById('dash-savings-summary');
    if (goalsContainer) {
      if (AppState.savings_goals.length === 0) {
        goalsContainer.innerHTML = `
          <div class="empty-state" style="padding: 1.5rem;">
            <p class="empty-desc">Belum ada target tabungan aktif.</p>
            <button class="btn btn-sm btn-primary" onclick="UI.openModal('modal-add-savings-goal')">+ Buat Target</button>
          </div>
        `;
      } else {
        goalsContainer.innerHTML = AppState.savings_goals.map(goal => {
          const prog = FinanceCalculator.calculateGoalProgress(goal, AppState.savings_transactions);
          return `
            <div style="margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-light);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-weight: 700; font-size: 0.9rem;">${goal.icon || '🎯'} ${goal.name}</span>
                <span style="font-size: 0.82rem; font-weight: 700; color: var(--primary);">${prog.percentage}%</span>
              </div>
              <div class="progress-bar-wrap" style="height: 8px; margin-bottom: 4px;">
                <div class="progress-bar-fill ${prog.isCompleted ? 'success' : ''}" style="width: ${prog.percentage}%"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.76rem; color: var(--text-muted);">
                <span>Terkumpul: ${FinanceCalculator.formatRupiah(prog.collected)}</span>
                <span>Target: ${FinanceCalculator.formatRupiah(prog.target)}</span>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  },

  /**
   * 2. INCOMES VIEW
   */
  renderIncomes() {
    const listEl = document.getElementById('incomes-table-body');
    const totalEl = document.getElementById('incomes-total-amount');
    const total = FinanceCalculator.calculateTotalIncome(AppState.incomes);
    if (totalEl) totalEl.textContent = FinanceCalculator.formatRupiah(total);

    if (!listEl) return;

    if (AppState.incomes.length === 0) {
      listEl.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 3rem;">
            <div class="empty-state">
              <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
              <div class="empty-title">Belum Ada Catatan Pemasukan</div>
              <div class="empty-desc">Catat pemasukan dari gaji, uang saku, bonus, atau bisnis Anda.</div>
              <button class="btn btn-income" onclick="UI.openModal('modal-add-income')">+ Tambah Pemasukan</button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    listEl.innerHTML = AppState.incomes.map(item => `
      <tr>
        <td style="font-weight: 600;">${item.date}</td>
        <td>
          <div style="font-weight: 700; color: var(--text-main);">${item.description}</div>
        </td>
        <td><span class="badge badge-income">${item.category}</span></td>
        <td class="table-amount income">+${FinanceCalculator.formatRupiah(item.amount)}</td>
        <td style="text-align: right;">
          <div class="btn-group" style="justify-content: flex-end;">
            <button class="btn btn-sm btn-outline btn-icon" title="Edit" onclick="UI.editIncome('${item.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button class="btn btn-sm btn-outline btn-icon" style="color: var(--expense);" title="Hapus" onclick="UI.deleteIncome('${item.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  /**
   * 3. EXPENSES VIEW
   */
  renderExpenses() {
    const listEl = document.getElementById('expenses-table-body');
    const totalEl = document.getElementById('expenses-total-amount');
    const total = FinanceCalculator.calculateTotalExpense(AppState.expenses);
    if (totalEl) totalEl.textContent = FinanceCalculator.formatRupiah(total);

    if (!listEl) return;

    if (AppState.expenses.length === 0) {
      listEl.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 3rem;">
            <div class="empty-state">
              <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
              <div class="empty-title">Belum Ada Catatan Pengeluaran</div>
              <div class="empty-desc">Catat pengeluaran untuk makanan, transportasi, belanja, dan lainnya.</div>
              <button class="btn btn-expense" onclick="UI.openModal('modal-add-expense')">+ Tambah Pengeluaran</button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    listEl.innerHTML = AppState.expenses.map(item => `
      <tr>
        <td style="font-weight: 600;">${item.date}</td>
        <td>
          <div style="font-weight: 700; color: var(--text-main);">${item.note}</div>
        </td>
        <td><span class="badge badge-expense">${item.category}</span></td>
        <td class="table-amount expense">-${FinanceCalculator.formatRupiah(item.amount)}</td>
        <td style="text-align: right;">
          <div class="btn-group" style="justify-content: flex-end;">
            <button class="btn btn-sm btn-outline btn-icon" title="Edit" onclick="UI.editExpense('${item.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button class="btn btn-sm btn-outline btn-icon" style="color: var(--expense);" title="Hapus" onclick="UI.deleteExpense('${item.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  /**
   * 4. SAVINGS VIEW
   */
  renderSavings() {
    const goalsContainer = document.getElementById('savings-goals-container');
    const { currentSavings } = FinanceCalculator.calculateSavingsTotals(AppState.savings_transactions);
    const totalEl = document.getElementById('savings-total-collected');
    if (totalEl) totalEl.textContent = FinanceCalculator.formatRupiah(currentSavings);

    // Render Savings Growth Chart
    AppCharts.renderSavingsGrowthChart('savings-growth-chart', AppState.savings_transactions);

    if (!goalsContainer) return;

    if (AppState.savings_goals.length === 0) {
      goalsContainer.innerHTML = `
        <div class="card" style="grid-column: 1 / -1;">
          <div class="empty-state">
            <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></div>
            <div class="empty-title">Belum Ada Target Tabungan</div>
            <div class="empty-desc">Buat target untuk beli HP, laptop, dana darurat, atau liburan Anda.</div>
            <button class="btn btn-primary" onclick="UI.openModal('modal-add-savings-goal')">+ Buat Target Tabungan Baru</button>
          </div>
        </div>
      `;
      return;
    }

    goalsContainer.innerHTML = AppState.savings_goals.map(goal => {
      const prog = FinanceCalculator.calculateGoalProgress(goal, AppState.savings_transactions);
      return `
        <div class="savings-card">
          <div class="savings-card-top">
            <div class="savings-title-area">
              <div class="savings-icon-badge">${goal.icon || '🎯'}</div>
              <div class="savings-meta">
                <h4>${goal.name}</h4>
                <span>Target: ${goal.target_date || 'Tanpa batas waktu'}</span>
              </div>
            </div>
            <div class="dropdown" style="display: flex; gap: 4px;">
              <button class="btn btn-sm btn-ghost btn-icon" onclick="UI.editSavingsGoal('${goal.id}')" title="Edit Target">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              <button class="btn btn-sm btn-ghost btn-icon" onclick="UI.deleteSavingsGoal('${goal.id}')" title="Hapus Target" style="color: var(--expense);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>

          <div class="savings-card-amounts">
            <div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">Terkumpul</div>
              <div class="savings-collected">${FinanceCalculator.formatRupiah(prog.collected)}</div>
            </div>
            <div class="savings-target">
              <div>Target: <strong>${FinanceCalculator.formatRupiah(prog.target)}</strong></div>
              <div>Sisa: <span style="color: var(--expense);">${FinanceCalculator.formatRupiah(prog.remaining)}</span></div>
            </div>
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 700; margin-bottom: 4px;">
              <span>Progress Pencapaian</span>
              <span style="color: ${prog.isCompleted ? 'var(--income)' : 'var(--primary)'};">${prog.percentage}% ${prog.isCompleted ? '🎉 TERCAPAI!' : ''}</span>
            </div>
            <div class="progress-bar-wrap">
              <div class="progress-bar-fill ${prog.isCompleted ? 'success' : ''}" style="width: ${prog.percentage}%"></div>
            </div>
          </div>

          <div class="savings-actions">
            <button class="btn btn-sm btn-income" onclick="UI.openSavingsTransferModal('${goal.id}', 'deposit')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Setor
            </button>
            <button class="btn btn-sm btn-outline" onclick="UI.openSavingsTransferModal('${goal.id}', 'withdraw')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg> Tarik
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Render Savings Transactions History
    const historyBody = document.getElementById('savings-tx-history-body');
    if (historyBody) {
      if (AppState.savings_transactions.length === 0) {
        historyBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Belum ada riwayat setor atau tarik tabungan.</td></tr>`;
      } else {
        const sortedTx = [...AppState.savings_transactions].reverse();
        historyBody.innerHTML = sortedTx.map(stx => {
          const goal = AppState.savings_goals.find(g => g.id === stx.goal_id);
          const isDep = stx.type === 'deposit';
          return `
            <tr>
              <td>${stx.date}</td>
              <td style="font-weight: 700;">${goal ? goal.name : 'Target Dihapus'}</td>
              <td><span class="badge ${isDep ? 'badge-income' : 'badge-expense'}">${isDep ? 'Setoran (+)' : 'Penarikan (-)'}</span></td>
              <td style="font-size: 0.85rem; color: var(--text-muted);">${stx.note || '-'}</td>
              <td class="table-amount ${isDep ? 'income' : 'expense'}" style="text-align: right;">
                ${isDep ? '+' : '-'}${FinanceCalculator.formatRupiah(stx.amount)}
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  },

  /**
   * 5. DEBTS & RECEIVABLES VIEW
   */
  renderDebts() {
    const summary = FinanceCalculator.calculateDebtsSummary(AppState.debts, AppState.debt_payments);
    const debtTotEl = document.getElementById('debts-total-amount');
    const recTotEl = document.getElementById('receivables-total-amount');
    if (debtTotEl) debtTotEl.textContent = FinanceCalculator.formatRupiah(summary.totalDebt);
    if (recTotEl) recTotEl.textContent = FinanceCalculator.formatRupiah(summary.totalReceivable);

    const listEl = document.getElementById('debts-table-body');
    if (!listEl) return;

    if (summary.enrichedDebts.length === 0) {
      listEl.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 3rem;">
            <div class="empty-state">
              <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg></div>
              <div class="empty-title">Belum Ada Catatan Utang & Piutang</div>
              <div class="empty-desc">Catat pinjaman yang Anda berikan atau pinjaman yang Anda terima secara rapi.</div>
              <button class="btn btn-primary" onclick="UI.openModal('modal-add-debt')">+ Catat Utang / Piutang</button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    listEl.innerHTML = summary.enrichedDebts.map(item => {
      const isDebt = item.type === 'debt';
      let statusBadge = 'badge-unpaid';
      if (item.status === 'Lunas') statusBadge = 'badge-paid';
      else if (item.status === 'Sebagian dibayar') statusBadge = 'badge-partial';
      else if (item.status === 'Jatuh tempo') statusBadge = 'badge-overdue';

      return `
        <tr>
          <td>
            <span class="badge ${isDebt ? 'badge-expense' : 'badge-secondary'}">
              ${isDebt ? 'Utang (Kita Pinjam)' : 'Piutang (Kita Pinjamkan)'}
            </span>
          </td>
          <td>
            <div style="font-weight: 700; color: var(--text-main);">${item.person_name}</div>
            <div style="font-size: 0.76rem; color: var(--text-muted);">${item.notes || '-'}</div>
          </td>
          <td class="table-amount">${FinanceCalculator.formatRupiah(item.amount)}</td>
          <td>${FinanceCalculator.formatRupiah(item.totalPaid)}</td>
          <td class="table-amount" style="color: ${item.remaining > 0 ? 'var(--expense)' : 'var(--income)'}; font-weight: 700;">
            ${FinanceCalculator.formatRupiah(item.remaining)}
          </td>
          <td>
            <div style="font-size: 0.82rem; font-weight: 600;">${item.due_date || 'Fleksibel'}</div>
            <span class="badge ${statusBadge}">${item.status}</span>
          </td>
          <td style="text-align: right;">
            <div class="btn-group" style="justify-content: flex-end;">
              ${item.remaining > 0 ? `
                <button class="btn btn-sm btn-income" onclick="UI.openDebtPaymentModal('${item.id}', ${item.remaining})">
                  Bayar
                </button>
              ` : ''}
              <button class="btn btn-sm btn-outline btn-icon" title="Edit" onclick="UI.editDebt('${item.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              <button class="btn btn-sm btn-outline btn-icon" style="color: var(--expense);" title="Hapus" onclick="UI.deleteDebt('${item.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Render Debt Payments History
    const paymentHistBody = document.getElementById('debt-payments-history-body');
    if (paymentHistBody) {
      if (AppState.debt_payments.length === 0) {
        paymentHistBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Belum ada riwayat pembayaran utang atau piutang.</td></tr>`;
      } else {
        const sortedPay = [...AppState.debt_payments].sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''));
        paymentHistBody.innerHTML = sortedPay.map(p => {
          const debt = AppState.debts.find(d => d.id === p.debt_id);
          const isDebt = debt ? debt.type === 'debt' : true;
          return `
            <tr>
              <td>${p.payment_date}</td>
              <td style="font-weight: 700;">${debt ? debt.person_name : 'Data Dihapus'}</td>
              <td><span class="badge ${isDebt ? 'badge-expense' : 'badge-income'}">${isDebt ? 'Bayar Utang' : 'Terima Piutang'}</span></td>
              <td style="font-size: 0.85rem; color: var(--text-muted);">${p.notes || '-'}</td>
              <td class="table-amount ${isDebt ? 'expense' : 'income'}" style="text-align: right;">
                ${FinanceCalculator.formatRupiah(p.amount)}
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  },

  /**
   * 6. FINANCIAL HISTORY VIEW
   */
  renderHistory() {
    const listEl = document.getElementById('history-table-body');
    if (!listEl) return;

    let items = AppState.getConsolidatedTransactions();

    // Read search input
    const searchVal = (document.getElementById('history-search-input')?.value || '').toLowerCase().trim();
    if (searchVal) {
      items = items.filter(tx => 
        (tx.title || '').toLowerCase().includes(searchVal) ||
        (tx.category || '').toLowerCase().includes(searchVal) ||
        (tx.typeLabel || '').toLowerCase().includes(searchVal)
      );
    }

    // Read active filter pill
    const activePill = document.querySelector('.filter-pills .pill-btn.active')?.getAttribute('data-filter') || 'all';
    if (activePill !== 'all') {
      items = items.filter(tx => {
        if (activePill === 'income') return tx.originType === 'income';
        if (activePill === 'expense') return tx.originType === 'expense';
        if (activePill === 'savings') return tx.originType === 'savings';
        if (activePill === 'debt') return tx.originType === 'debt_payment';
        return true;
      });
    }

    // Read Date Range & Category Filter
    const dateFrom = document.getElementById('history-date-from')?.value || '';
    const dateTo = document.getElementById('history-date-to')?.value || '';
    const catFilter = document.getElementById('history-category-filter')?.value || 'all';

    if (dateFrom) {
      items = items.filter(tx => (tx.date || '') >= dateFrom);
    }
    if (dateTo) {
      items = items.filter(tx => (tx.date || '') <= dateTo);
    }
    if (catFilter && catFilter !== 'all') {
      items = items.filter(tx => tx.category === catFilter);
    }

    if (items.length === 0) {
      listEl.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            Tidak ditemukan riwayat transaksi yang cocok dengan kriteria pencarian.
          </td>
        </tr>
      `;
      return;
    }

    listEl.innerHTML = items.map(tx => {
      const isPos = tx.isPositive;
      const sign = isPos ? '+' : '-';
      const colorClass = isPos ? 'text-income' : 'text-expense';

      let badgeClass = 'badge-secondary';
      if (tx.originType === 'income') badgeClass = 'badge-income';
      else if (tx.originType === 'expense') badgeClass = 'badge-expense';
      else if (tx.originType === 'savings') badgeClass = 'badge-transfer';

      return `
        <tr>
          <td style="font-weight: 600;">${tx.date}</td>
          <td>
            <div style="font-weight: 700; color: var(--text-main);">${tx.title}</div>
            <div style="font-size: 0.74rem; color: var(--text-muted);">${tx.typeLabel}</div>
          </td>
          <td><span class="badge ${badgeClass}">${tx.category}</span></td>
          <td>
            <span class="badge ${tx.isTransfer ? 'badge-transfer' : (isPos ? 'badge-income' : 'badge-expense')}">
              ${tx.isTransfer ? 'Transfer Internal' : tx.typeLabel}
            </span>
          </td>
          <td class="table-amount ${colorClass}" style="text-align: right;">
            ${sign}${FinanceCalculator.formatRupiah(tx.amount)}
          </td>
        </tr>
      `;
    }).join('');
  },

  /**
   * 7. FINANCIAL REPORTS VIEW
   */
  renderReports() {
    const period = this.activeReportPeriod || 'all';
    const report = FinanceCalculator.getReportSummaryByPeriod(AppState, period);
    const health = report.health;

    // Summary boxes
    const repInc = document.getElementById('report-total-income');
    const repExp = document.getElementById('report-total-expense');
    const repSav = document.getElementById('report-savings-rate');
    const repScore = document.getElementById('report-health-score');
    const repLabel = document.getElementById('report-health-label');

    if (repInc) repInc.textContent = FinanceCalculator.formatRupiah(report.totalIncome);
    if (repExp) repExp.textContent = FinanceCalculator.formatRupiah(report.totalExpense);
    if (repSav) repSav.textContent = `${health.savingsRate}%`;
    if (repScore) repScore.textContent = `${health.score}/100`;
    if (repLabel) {
      repLabel.textContent = health.label;
      repLabel.style.color = health.color;
    }

    // Donut Chart Kategori Pengeluaran Terbesar
    AppCharts.renderCategoryDonutChart('report-category-donut', report.expenses);

    // Comparative Bar Chart (respects daily / weekly / monthly / yearly)
    const chartMode = period === 'daily' ? 'daily' : (period === 'weekly' ? 'weekly' : (period === 'yearly' ? 'yearly' : 'monthly'));
    AppCharts.renderDashboardCashflowChart('report-comparative-chart', AppState.incomes, AppState.expenses, chartMode);

    // Savings Growth Chart in Reports
    const savingsForChart = period === 'all' ? AppState.savings_transactions : report.savingsTx;
    AppCharts.renderSavingsGrowthChart('report-savings-chart', savingsForChart);

    // Top categories list
    const topCatContainer = document.getElementById('report-top-categories');
    if (topCatContainer) {
      const categories = FinanceCalculator.getExpensesByCategory(report.expenses);
      if (categories.length === 0) {
        topCatContainer.innerHTML = '<p class="text-muted" style="padding: 1rem;">Belum ada data pengeluaran pada periode ini.</p>';
      } else {
        topCatContainer.innerHTML = categories.map(c => `
          <div style="margin-bottom: 0.85rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.88rem; margin-bottom: 4px;">
              <span style="font-weight: 600;">${c.category}</span>
              <span style="font-weight: 700;">${FinanceCalculator.formatRupiah(c.amount)} (${c.percentage}%)</span>
            </div>
            <div class="progress-bar-wrap" style="height: 6px;">
              <div class="progress-bar-fill" style="width: ${c.percentage}%"></div>
            </div>
          </div>
        `).join('');
      }
    }
  },

  /**
   * 8. AI FINANCIAL ANALYSIS VIEW (OpenAI)
   */
  renderAIAnalysis() {
    const analysis = AppState.ai_analysis;
    const container = document.getElementById('ai-analysis-results-container');
    if (!container) return;

    if (!analysis) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 3rem 1.5rem;">
          <div class="empty-icon" style="background: var(--primary-light); color: var(--primary); margin: 0 auto 1.5rem;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          </div>
          <h3 style="margin-bottom: 0.5rem;">Belum Ada Analisis Keuangan Aktif</h3>
          <p class="empty-desc" style="margin: 0 auto 1.5rem;">Klik tombol "Jalankan Analisis AI" di atas untuk menganalisis arus kas, pola belanja, perkembangan tabungan, dan rekomendasi anggaran Anda.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="ai-insights-grid">
        <!-- Ringkasan Kondisi Keuangan -->
        <div class="ai-card">
          <div class="ai-card-header">
            <div class="ai-card-icon purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <div class="ai-card-title">Kondisi & Arus Kas</div>
          </div>
          <div class="ai-card-body">
            <p>${analysis.summaryText}</p>
            <div class="ai-score-box">
              <div class="ai-score-circle">
                ${analysis.score}
                <span>SKOR</span>
              </div>
              <div>
                <div style="font-weight: 800; font-size: 1.05rem; color: var(--text-main);">${analysis.scoreLabel}</div>
                <div style="font-size: 0.78rem; color: var(--text-muted);">Diperbarui: ${new Date(analysis.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pola Pengeluaran -->
        <div class="ai-card">
          <div class="ai-card-header">
            <div class="ai-card-icon blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div class="ai-card-title">Pola Pengeluaran</div>
          </div>
          <div class="ai-card-body">
            <ul>
              ${analysis.spendingPatterns.map(p => `<li>${p}</li>`).join('')}
            </ul>
          </div>
        </div>

        <!-- Evaluasi Tabungan -->
        <div class="ai-card">
          <div class="ai-card-header">
            <div class="ai-card-icon green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
            </div>
            <div class="ai-card-title">Evaluasi Tabungan</div>
          </div>
          <div class="ai-card-body">
            <ul>
              ${analysis.savingsEvaluation.map(s => `<li>${s}</li>`).join('')}
            </ul>
          </div>
        </div>

        <!-- Rekomendasi Alokasi Anggaran -->
        <div class="ai-card">
          <div class="ai-card-header">
            <div class="ai-card-icon amber">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div class="ai-card-title">Rekomendasi Anggaran (50/30/20)</div>
          </div>
          <div class="ai-card-body">
            <ul>
              ${analysis.budgetingRecommendations.map(r => `<li>${r}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>

      <div class="ai-disclaimer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <div>
          <strong>Disclaimer Penting:</strong> Seluruh rekomendasi dan evaluasi dari kecerdasan buatan (AI) bersifat informatif dan edukatif. AI MoneyTrack bukan merupakan penasihat keuangan bersertifikasi resmi. Keputusan finansial akhir tetap menjadi tanggung jawab pengguna.
        </div>
      </div>
    `;
  },

  /**
   * 9. AI CHATBOT VIEW (Gemini)
   */
  renderAIChat() {
    const messagesEl = document.getElementById('chat-messages-stream');
    if (!messagesEl) return;

    messagesEl.innerHTML = AppState.chat_history.map(msg => {
      const isUser = msg.role === 'user';
      return `
        <div class="message-row ${isUser ? 'user' : 'assistant'}">
          <div class="message-avatar">
            ${isUser ? '👤' : '✨'}
          </div>
          <div>
            <div class="message-bubble">
              ${msg.text.replace(/\n/g, '<br>')}
            </div>
            <div class="message-time">${msg.timestamp || ''}</div>
          </div>
        </div>
      `;
    }).join('');

    // Auto-scroll to bottom
    messagesEl.scrollTop = messagesEl.scrollHeight;
  },

  /**
   * 10. PROFILE & SETTINGS VIEW
   */
  renderSettings() {
    const user = AppState.user;
    if (!user) return;

    const nameInput = document.getElementById('setting-name-input');
    const emailInput = document.getElementById('setting-email-input');
    const roleInput = document.getElementById('setting-role-input');
    const themeSelect = document.getElementById('setting-theme-select');

    if (nameInput) nameInput.value = user.name || '';
    if (emailInput) emailInput.value = user.email || '';
    if (roleInput) roleInput.value = user.role || 'Pekerja & Freelancer';
    if (themeSelect) themeSelect.value = AppState.settings.theme || 'light';

    // Populate Supabase credentials & status
    if (typeof SupabaseManager !== 'undefined') {
      const creds = SupabaseManager.getCredentials();
      const urlInput = document.getElementById('setting-supabase-url');
      const anonInput = document.getElementById('setting-supabase-anon-key');
      const badge = document.getElementById('setting-supabase-badge');
      const topbarStatus = document.getElementById('topbar-cloud-status');

      if (urlInput) urlInput.value = creds.url || '';
      if (anonInput) anonInput.value = creds.anonKey || '';

      if (SupabaseManager.isReady) {
        if (badge) {
          badge.textContent = '🟢 Cloud Terhubung';
          badge.className = 'badge badge-income';
        }
        if (topbarStatus) {
          topbarStatus.textContent = '🟢 Cloud: Supabase Terhubung';
          topbarStatus.className = 'badge badge-income';
        }
      } else {
        if (badge) {
          badge.textContent = '⚡ Mode Lokal (Siap Supabase)';
          badge.className = 'badge badge-secondary';
        }
        if (topbarStatus) {
          topbarStatus.textContent = '⚡ Mode: Lokal (Siap Supabase)';
          topbarStatus.className = 'badge badge-secondary';
        }
      }
    }

    // Populate AI custom keys
    const openAiInput = document.getElementById('setting-openai-key');
    const geminiInput = document.getElementById('setting-gemini-key');
    if (openAiInput) openAiInput.value = StorageAdapter.get('openai_custom_key', '');
    if (geminiInput) geminiInput.value = StorageAdapter.get('gemini_custom_key', '');
  },

  // --- Modal Helpers ---
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  },

  // Edit Income
  editIncome(id) {
    const item = AppState.incomes.find(x => x.id === id);
    if (!item) return;

    document.getElementById('edit-income-id').value = item.id;
    document.getElementById('edit-income-desc').value = item.description;
    document.getElementById('edit-income-amount').value = item.amount;
    document.getElementById('edit-income-category').value = item.category;
    document.getElementById('edit-income-date').value = item.date;

    this.openModal('modal-edit-income');
  },

  deleteIncome(id) {
    if (confirm('Apakah Anda yakin ingin menghapus catatan pemasukan ini?')) {
      AppState.deleteIncome(id);
      this.showToast('Pemasukan berhasil dihapus', 'info');
    }
  },

  // Edit Expense
  editExpense(id) {
    const item = AppState.expenses.find(x => x.id === id);
    if (!item) return;

    document.getElementById('edit-expense-id').value = item.id;
    document.getElementById('edit-expense-note').value = item.note;
    document.getElementById('edit-expense-amount').value = item.amount;
    document.getElementById('edit-expense-category').value = item.category;
    document.getElementById('edit-expense-date').value = item.date;

    this.openModal('modal-edit-expense');
  },

  deleteExpense(id) {
    if (confirm('Apakah Anda yakin ingin menghapus catatan pengeluaran ini?')) {
      AppState.deleteExpense(id);
      this.showToast('Pengeluaran berhasil dihapus', 'info');
    }
  },

  // Savings Transfer Modal
  openSavingsTransferModal(goalId, type) {
    const goal = AppState.savings_goals.find(g => g.id === goalId);
    if (!goal) return;

    const prog = FinanceCalculator.calculateGoalProgress(goal, AppState.savings_transactions);
    const available = FinanceCalculator.calculateAvailableBalance(AppState.incomes, AppState.expenses, AppState.savings_transactions);

    document.getElementById('savings-transfer-goal-id').value = goalId;
    document.getElementById('savings-transfer-type').value = type;
    document.getElementById('savings-transfer-title').textContent = type === 'deposit' 
      ? `Setor ke: ${goal.name}` 
      : `Tarik dari: ${goal.name}`;
    document.getElementById('savings-transfer-btn-label').textContent = type === 'deposit' ? 'Konfirmasi Setor' : 'Konfirmasi Tarik';

    document.getElementById('savings-transfer-info').innerHTML = `
      <div style="background: var(--bg-subtle); padding: 10px; border-radius: var(--radius-md); font-size: 0.82rem; margin-bottom: 1rem;">
        <div>Saldo Tersedia: <strong>${FinanceCalculator.formatRupiah(available)}</strong></div>
        <div>Uang di Target Ini: <strong>${FinanceCalculator.formatRupiah(prog.collected)}</strong></div>
        <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 4px;">
          *Transfer internal tidak menambah/mengurangi total pemasukan atau pengeluaran.
        </div>
      </div>
    `;

    document.getElementById('savings-transfer-amount').value = '';
    document.getElementById('savings-transfer-date').value = new Date().toISOString().split('T')[0];

    this.openModal('modal-savings-transfer');
  },

  deleteSavingsGoal(goalId) {
    if (confirm('Hapus target tabungan ini beserta riwayat setor/tariknya?')) {
      AppState.deleteSavingsGoal(goalId);
      this.showToast('Target tabungan berhasil dihapus', 'info');
    }
  },

  // Debt Payment Modal
  openDebtPaymentModal(debtId, remaining) {
    const debt = AppState.debts.find(d => d.id === debtId);
    if (!debt) return;

    document.getElementById('debt-payment-id').value = debtId;
    document.getElementById('debt-payment-person').textContent = debt.person_name;
    document.getElementById('debt-payment-remaining').textContent = FinanceCalculator.formatRupiah(remaining);
    document.getElementById('debt-payment-amount').value = remaining; // default to full payoff
    document.getElementById('debt-payment-date').value = new Date().toISOString().split('T')[0];

    this.openModal('modal-debt-payment');
  },

  deleteDebt(debtId) {
    if (confirm('Hapus data utang/piutang ini?')) {
      AppState.deleteDebt(debtId);
      this.showToast('Catatan utang/piutang dihapus', 'info');
    }
  },

  // Edit Debt Modal
  editDebt(debtId) {
    const item = AppState.debts.find(d => d.id === debtId);
    if (!item) return;

    document.getElementById('edit-debt-id').value = item.id;
    document.getElementById('edit-debt-type').value = item.type;
    document.getElementById('edit-debt-person').value = item.person_name;
    document.getElementById('edit-debt-amount').value = item.amount;
    document.getElementById('edit-debt-date').value = item.transaction_date || '';
    document.getElementById('edit-debt-due').value = item.due_date || '';
    document.getElementById('edit-debt-notes').value = item.notes || '';

    this.openModal('modal-edit-debt');
  },

  // Edit Savings Goal Modal
  editSavingsGoal(goalId) {
    const goal = AppState.savings_goals.find(g => g.id === goalId);
    if (!goal) return;

    document.getElementById('edit-goal-id').value = goal.id;
    document.getElementById('edit-goal-name').value = goal.name;
    document.getElementById('edit-goal-amount').value = goal.target_amount;
    document.getElementById('edit-goal-date').value = goal.target_date || '';
    document.getElementById('edit-goal-icon').value = goal.icon || '🎯';

    this.openModal('modal-edit-savings-goal');
  },

  // --- Category Management Helpers ---
  populateCategoryDropdowns() {
    const incCats = AppState.categories?.income || [];
    const expCats = AppState.categories?.expense || [];

    const fillSelect = (id, list, preserveVal = true) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const prev = sel.value;
      sel.innerHTML = list.map(c => `<option value="${c}">${c}</option>`).join('');
      if (preserveVal && prev && list.includes(prev)) {
        sel.value = prev;
      }
    };

    fillSelect('add-income-category', incCats);
    fillSelect('edit-income-category', incCats);
    fillSelect('add-expense-category', expCats);
    fillSelect('edit-expense-category', expCats);

    // History category filter
    const histCat = document.getElementById('history-category-filter');
    if (histCat) {
      const prev = histCat.value || 'all';
      const allCats = [...new Set([...incCats, ...expCats, 'Transfer Tabungan', 'Pelunasan Utang', 'Penerimaan Piutang'])];
      histCat.innerHTML = '<option value="all">Semua Kategori</option>' +
        allCats.map(c => `<option value="${c}">${c}</option>`).join('');
      if ([...allCats, 'all'].includes(prev)) histCat.value = prev;
    }
  },

  openCategoryModal(type = 'income') {
    this.switchCategoryTab(type);
    this.openModal('modal-manage-categories');
  },

  switchCategoryTab(type) {
    this.activeCategoryTab = type === 'expense' ? 'expense' : 'income';
    const tabInc = document.getElementById('cat-tab-income');
    const tabExp = document.getElementById('cat-tab-expense');
    if (tabInc) tabInc.classList.toggle('active', this.activeCategoryTab === 'income');
    if (tabExp) tabExp.classList.toggle('active', this.activeCategoryTab === 'expense');
    this.renderCategoryList();
  },

  renderCategoryList() {
    const container = document.getElementById('category-list-container');
    if (!container) return;
    const list = AppState.categories?.[this.activeCategoryTab] || [];

    container.innerHTML = list.map(cat => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-subtle); border-radius: var(--radius-sm);">
        <span style="font-weight: 600; font-size: 0.9rem;">${cat}</span>
        <button type="button" class="btn btn-sm btn-outline" style="color: var(--expense); padding: 4px 10px;" onclick="UI.deleteCategory('${this.activeCategoryTab}', '${cat.replace(/'/g, "\\'")}')">
          Hapus
        </button>
      </div>
    `).join('');
  },

  deleteCategory(type, name) {
    try {
      AppState.deleteCategory(type, name);
      this.renderCategoryList();
      this.showToast(`Kategori "${name}" dihapus`, 'info');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }
};

window.UI = UI;
