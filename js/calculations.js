/**
 * MONEYTRACK - FINANCIAL CALCULATIONS ENGINE
 * Handles consistent financial logic according to the application specifications:
 * - Saldo Tersedia = Total Pemasukan - Total Pengeluaran - Total Setoran Tabungan + Total Penarikan Tabungan
 * - Total Tabungan = Total Setoran Tabungan - Total Penarikan Tabungan
 * - Internal transfers (savings deposits/withdrawals) are NEVER counted as new income or expense.
 * - Utang & Piutang are tracked distinctly with accurate remaining balances & statuses.
 */

const FinanceCalculator = {
  /**
   * Format a numeric amount to Rupiah string format: "Rp 1.500.000"
   * @param {number} amount
   * @param {boolean} withPrefix - whether to include 'Rp '
   * @returns {string}
   */
  formatRupiah(amount, withPrefix = true) {
    const num = Number(amount) || 0;
    const formatted = Math.abs(num).toLocaleString('id-ID');
    const sign = num < 0 ? '-' : '';
    return withPrefix ? `${sign}Rp ${formatted}` : `${sign}${formatted}`;
  },

  /**
   * Parse formatted Rupiah string or input value back to clean number
   * @param {string|number} value
   * @returns {number}
   */
  parseAmount(value) {
    if (typeof value === 'number') return isNaN(value) ? 0 : value;
    if (!value) return 0;
    const clean = String(value).replace(/[^0-9.-]/g, '');
    return parseFloat(clean) || 0;
  },

  /**
   * Calculate Total Income (from income transactions only)
   * @param {Array} incomes
   * @returns {number}
   */
  calculateTotalIncome(incomes = []) {
    return incomes.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  },

  /**
   * Calculate Total Expense (from expense transactions only)
   * @param {Array} expenses
   * @returns {number}
   */
  calculateTotalExpense(expenses = []) {
    return expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  },

  /**
   * Calculate Savings Metrics:
   * - Total Deposits (Setoran)
   * - Total Withdrawals (Penarikan)
   * - Net Current Savings Balance
   * @param {Array} savingsTransactions
   * @returns {{ totalDeposits: number, totalWithdrawals: number, currentSavings: number }}
   */
  calculateSavingsTotals(savingsTransactions = []) {
    let totalDeposits = 0;
    let totalWithdrawals = 0;

    savingsTransactions.forEach(tx => {
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'deposit' || tx.type === 'setor') {
        totalDeposits += amount;
      } else if (tx.type === 'withdraw' || tx.type === 'tarik') {
        totalWithdrawals += amount;
      }
    });

    const currentSavings = Math.max(0, totalDeposits - totalWithdrawals);
    return { totalDeposits, totalWithdrawals, currentSavings };
  },

  /**
   * Calculate Available Balance (Saldo Tersedia)
   * Formula strictly per spec:
   * Available = Total Income - Total Expense - Total Savings Deposits + Total Savings Withdrawals
   * @param {Array} incomes
   * @param {Array} expenses
   * @param {Array} savingsTransactions
   * @returns {number}
   */
  calculateAvailableBalance(incomes = [], expenses = [], savingsTransactions = []) {
    const totalIncome = this.calculateTotalIncome(incomes);
    const totalExpense = this.calculateTotalExpense(expenses);
    const { totalDeposits, totalWithdrawals } = this.calculateSavingsTotals(savingsTransactions);

    return totalIncome - totalExpense - totalDeposits + totalWithdrawals;
  },

  /**
   * Calculate Target Savings Achievement per Goal
   * @param {Object} goal
   * @param {Array} savingsTransactions
   * @returns {Object}
   */
  calculateGoalProgress(goal, savingsTransactions = []) {
    const goalTx = savingsTransactions.filter(tx => String(tx.goal_id) === String(goal.id));
    let collected = 0;

    goalTx.forEach(tx => {
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'deposit' || tx.type === 'setor') {
        collected += amount;
      } else if (tx.type === 'withdraw' || tx.type === 'tarik') {
        collected -= amount;
      }
    });

    collected = Math.max(0, collected);
    const target = Number(goal.target_amount) || 0;
    const remaining = Math.max(0, target - collected);
    const percentage = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0;
    const isCompleted = collected >= target && target > 0;

    return {
      goalId: goal.id,
      collected,
      target,
      remaining,
      percentage,
      isCompleted
    };
  },

  /**
   * Calculate Debts & Receivables Summary
   * Status indicators:
   * - "Belum dibayar" (0 paid)
   * - "Sebagian dibayar" (> 0 but < total)
   * - "Lunas" (>= total)
   * - "Jatuh tempo" (due date passed and not yet paid in full)
   * @param {Array} debts - items with type 'debt' (utang) or 'receivable' (piutang)
   * @param {Array} debtPayments
   * @returns {Object}
   */
  calculateDebtsSummary(debts = [], debtPayments = []) {
    let totalDebtRemaining = 0;
    let totalReceivableRemaining = 0;
    const today = new Date().toISOString().split('T')[0];

    const enrichedDebts = debts.map(debt => {
      const payments = debtPayments.filter(p => String(p.debt_id) === String(debt.id));
      const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const originalAmount = Number(debt.amount) || 0;
      const remaining = Math.max(0, originalAmount - totalPaid);

      let status = 'Belum dibayar';
      if (remaining <= 0) {
        status = 'Lunas';
      } else if (debt.due_date && debt.due_date < today) {
        status = 'Jatuh tempo';
      } else if (totalPaid > 0) {
        status = 'Sebagian dibayar';
      }

      if (debt.type === 'debt') {
        totalDebtRemaining += remaining;
      } else if (debt.type === 'receivable') {
        totalReceivableRemaining += remaining;
      }

      return {
        ...debt,
        totalPaid,
        remaining,
        status,
        isOverdue: debt.due_date && debt.due_date < today && remaining > 0
      };
    });

    return {
      totalDebt: totalDebtRemaining,
      totalReceivable: totalReceivableRemaining,
      enrichedDebts
    };
  },

  /**
   * Calculate Complete Overview for Dashboard
   */
  getDashboardMetrics(state) {
    const totalIncome = this.calculateTotalIncome(state.incomes);
    const totalExpense = this.calculateTotalExpense(state.expenses);
    const { currentSavings } = this.calculateSavingsTotals(state.savings_transactions);
    const availableBalance = this.calculateAvailableBalance(
      state.incomes,
      state.expenses,
      state.savings_transactions
    );
    const { totalDebt, totalReceivable } = this.calculateDebtsSummary(
      state.debts,
      state.debt_payments
    );

    const netWorth = availableBalance + currentSavings + totalReceivable - totalDebt;

    return {
      availableBalance,
      totalIncome,
      totalExpense,
      currentSavings,
      totalDebt,
      totalReceivable,
      netWorth
    };
  },

  /**
   * Group expenses by category with percentages
   */
  getExpensesByCategory(expenses = []) {
    const totals = {};
    let grandTotal = 0;

    expenses.forEach(item => {
      const cat = item.category || 'Lainnya';
      const amt = Number(item.amount) || 0;
      totals[cat] = (totals[cat] || 0) + amt;
      grandTotal += amt;
    });

    const categories = Object.keys(totals).map(category => {
      const amount = totals[category];
      const percentage = grandTotal > 0 ? Math.round((amount / grandTotal) * 100) : 0;
      return { category, amount, percentage };
    });

    // Sort descending by amount
    return categories.sort((a, b) => b.amount - a.amount);
  },

  /**
   * Calculate Financial Health Score (0 - 100)
   * Based on Savings Rate, Expense-to-Income ratio, and Debt-to-Asset ratio
   */
  calculateFinancialHealth(metrics) {
    const { totalIncome, totalExpense, currentSavings, availableBalance, totalDebt } = metrics;
    if (totalIncome <= 0) {
      const expenseRatio = totalExpense > 0 ? 100 : 0;
      return {
        score: totalExpense > 0 ? 35 : 50,
        label: totalExpense > 0 ? 'Perlu Perbaikan' : 'Cukup',
        color: totalExpense > 0 ? '#EF4444' : '#F59E0B',
        expenseRatio,
        savingsRate: 0,
        advice: 'Mulai catat pemasukan rutin Anda untuk evaluasi akurat.'
      };
    }

    const expenseRatio = (totalExpense / totalIncome) * 100;
    const savingsRate = ((totalIncome - totalExpense) / totalIncome) * 100;

    let score = 50;

    // Evaluate expense ratio
    if (expenseRatio <= 50) score += 25;
    else if (expenseRatio <= 70) score += 15;
    else if (expenseRatio <= 90) score += 5;
    else score -= 15; // overspending

    // Evaluate savings rate
    if (savingsRate >= 20) score += 20;
    else if (savingsRate >= 10) score += 10;
    else if (savingsRate > 0) score += 5;
    else score -= 10;

    // Evaluate debt safety
    const totalAssets = availableBalance + currentSavings;
    if (totalDebt === 0) score += 10;
    else if (totalDebt < totalAssets * 0.3) score += 5;
    else if (totalDebt > totalAssets) score -= 10;

    score = Math.max(10, Math.min(100, Math.round(score)));

    let label = 'Perlu Perbaikan';
    let color = '#EF4444';
    if (score >= 80) {
      label = 'Sangat Sehat';
      color = '#10B981';
    } else if (score >= 65) {
      label = 'Sehat';
      color = '#059669';
    } else if (score >= 50) {
      label = 'Cukup / Waspada';
      color = '#F59E0B';
    }

    return { score, label, color, expenseRatio: Math.round(expenseRatio), savingsRate: Math.round(savingsRate) };
  },

  /**
   * Filter array of records by period: 'daily', 'weekly', 'monthly', 'yearly', 'all'
   */
  filterByPeriod(items = [], period = 'all', dateField = 'date') {
    if (!period || period === 'all') return items;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return items.filter(item => {
      const dateStr = item[dateField];
      if (!dateStr) return false;

      if (period === 'daily') {
        return dateStr === todayStr;
      }
      if (period === 'weekly') {
        const d = new Date(dateStr + 'T00:00:00');
        const diffDays = (now - d) / (1000 * 60 * 60 * 24);
        return diffDays >= -1 && diffDays <= 7;
      }
      if (period === 'monthly') {
        return dateStr.slice(0, 7) === todayStr.slice(0, 7);
      }
      if (period === 'yearly') {
        return dateStr.slice(0, 4) === todayStr.slice(0, 4);
      }
      return true;
    });
  },

  /**
   * Get Report Summary filtered by period
   */
  getReportSummaryByPeriod(state, period = 'all') {
    const incomes = this.filterByPeriod(state.incomes, period, 'date');
    const expenses = this.filterByPeriod(state.expenses, period, 'date');
    const savingsTx = this.filterByPeriod(state.savings_transactions, period, 'date');

    const totalIncome = this.calculateTotalIncome(incomes);
    const totalExpense = this.calculateTotalExpense(expenses);
    const { currentSavings, totalDeposits, totalWithdrawals } = this.calculateSavingsTotals(savingsTx);
    const availableBalance = this.calculateAvailableBalance(incomes, expenses, savingsTx);
    const { totalDebt } = this.calculateDebtsSummary(state.debts, state.debt_payments);

    const health = this.calculateFinancialHealth({
      totalIncome,
      totalExpense,
      currentSavings,
      availableBalance,
      totalDebt
    });

    return {
      period,
      incomes,
      expenses,
      savingsTx,
      totalIncome,
      totalExpense,
      totalDeposits,
      totalWithdrawals,
      netSavingsInPeriod: totalDeposits - totalWithdrawals,
      health
    };
  }
};

// Export to window
window.FinanceCalculator = FinanceCalculator;
