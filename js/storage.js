/**
 * MONEYTRACK - STORAGE ADAPTER
 * Provides a clean data-access layer.
 * In Stage 1: Uses structured LocalStorage persistence.
 * In Stage 2: Connects smoothly to Supabase PostgreSQL client.
 */

const StorageAdapter = {
  STORAGE_KEY_PREFIX: 'moneytrack_v1_',

  /**
   * Save item to storage
   */
  set(key, data) {
    try {
      localStorage.setItem(this.STORAGE_KEY_PREFIX + key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
      return false;
    }
  },

  /**
   * Get item from storage
   */
  get(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY_PREFIX + key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch (e) {
      console.error('Failed to read from localStorage:', e);
      return defaultValue;
    }
  },

  /**
   * Remove item from storage
   */
  remove(key) {
    try {
      localStorage.removeItem(this.STORAGE_KEY_PREFIX + key);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Clear all MoneyTrack keys
   */
  clearAll() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.STORAGE_KEY_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      return true;
    } catch (e) {
      console.error('Clear failed:', e);
      return false;
    }
  },

  /**
   * Export entire app state as JSON download
   */
  exportData(state) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `moneytrack_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  /**
   * Export financial report & transactions to Excel-compatible CSV (UTF-8 BOM)
   */
  exportToExcelCSV(state, period = 'all') {
    const periodNames = {
      daily: 'Harian',
      weekly: 'Mingguan',
      monthly: 'Bulanan',
      yearly: 'Tahunan',
      all: 'Semua_Waktu'
    };
    const summary = FinanceCalculator.getReportSummaryByPeriod(state, period);
    const metrics = FinanceCalculator.getDashboardMetrics(state);
    const esc = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = [];
    rows.push(['LAPORAN KEUANGAN MONEYTRACK']);
    rows.push(['Pengguna', state.user?.name || 'Pengguna']);
    rows.push(['Periode', periodNames[period] || 'Semua Waktu']);
    rows.push(['Tanggal Cetak', new Date().toLocaleDateString('id-ID')]);
    rows.push([]);
    rows.push(['RINGKASAN KONDISI KEUANGAN']);
    rows.push(['Saldo Tersedia Saat Ini', metrics.availableBalance]);
    rows.push(['Total Tabungan Terkumpul', metrics.currentSavings]);
    rows.push(['Total Utang', metrics.totalDebt]);
    rows.push(['Total Piutang', metrics.totalReceivable]);
    rows.push(['Total Pemasukan (Periode)', summary.totalIncome]);
    rows.push(['Total Pengeluaran (Periode)', summary.totalExpense]);
    rows.push(['Rasio Tabungan (%)', `${summary.health.savingsRate}%`]);
    rows.push(['Skor Kesehatan Finansial', `${summary.health.score}/100 (${summary.health.label})`]);
    rows.push([]);
    rows.push(['DAFTAR TRANSAKSI']);
    rows.push(['Tanggal', 'Jenis', 'Kategori', 'Deskripsi / Catatan', 'Nominal (Rp)']);

    const txList = state.getConsolidatedTransactions().filter(tx => {
      if (period === 'all') return true;
      return FinanceCalculator.filterByPeriod([tx], period, 'date').length > 0;
    });

    txList.forEach(tx => {
      const signedAmt = tx.isPositive ? tx.amount : -tx.amount;
      rows.push([tx.date, tx.typeLabel, tx.category, tx.title, signedAmt]);
    });

    const csvContent = '\uFEFF' + rows.map(r => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan_MoneyTrack_${periodNames[period] || 'Semua'}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  /**
   * Print current Financial Report view as PDF via browser print dialog
   */
  printReportPDF() {
    window.print();
  }
};

window.StorageAdapter = StorageAdapter;
