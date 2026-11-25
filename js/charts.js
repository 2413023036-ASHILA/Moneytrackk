/**
 * MONEYTRACK - CHARTS MODULE
 * Integrates Chart.js for dashboard, reports, and savings visual analytics.
 */

const AppCharts = {
  instances: {},

  /**
   * Safe destroy previous chart instance
   */
  destroyChart(key) {
    if (this.instances[key]) {
      this.instances[key].destroy();
      delete this.instances[key];
    }
  },

  /**
   * Render Dashboard Income vs Expense Bar Chart (Accurate YYYY-MM matching)
   */
  renderDashboardCashflowChart(canvasId, incomes = [], expenses = [], period = 'monthly') {
    const ctx = document.getElementById(canvasId);
    if (!ctx || typeof Chart === 'undefined') return;

    this.destroyChart(canvasId);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const now = new Date();
    const labels = [];
    const keys = [];
    const incomeData = [];
    const expenseData = [];

    if (period === 'daily') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        keys.push(key);
        labels.push(d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
        incomeData.push(0);
        expenseData.push(0);
      }
      incomes.forEach(inc => {
        const pos = keys.indexOf(inc.date);
        if (pos !== -1) incomeData[pos] += Number(inc.amount) || 0;
      });
      expenses.forEach(exp => {
        const pos = keys.indexOf(exp.date);
        if (pos !== -1) expenseData[pos] += Number(exp.amount) || 0;
      });
    } else if (period === 'weekly') {
      // Last 4 weeks (7-day buckets)
      const weekLabels = ['3 Minggu Lalu', '2 Minggu Lalu', 'Minggu Lalu', 'Minggu Ini'];
      labels.push(...weekLabels);
      for (let w = 0; w < 4; w++) {
        incomeData.push(0);
        expenseData.push(0);
      }
      const assignWeek = (dateStr, amt, targetArr) => {
        if (!dateStr) return;
        const d = new Date(dateStr + 'T00:00:00');
        const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays < 28) {
          const idx = 3 - Math.floor(diffDays / 7);
          if (idx >= 0 && idx < 4) targetArr[idx] += Number(amt) || 0;
        }
      };
      incomes.forEach(inc => assignWeek(inc.date, inc.amount, incomeData));
      expenses.forEach(exp => assignWeek(exp.date, exp.amount, expenseData));
    } else if (period === 'yearly') {
      // Group by year (last 4 years up to current year)
      const curYear = now.getFullYear();
      for (let y = curYear - 3; y <= curYear; y++) {
        keys.push(String(y));
        labels.push(String(y));
        incomeData.push(0);
        expenseData.push(0);
      }
      incomes.forEach(inc => {
        const y = (inc.date || '').slice(0, 4);
        const pos = keys.indexOf(y);
        if (pos !== -1) incomeData[pos] += Number(inc.amount) || 0;
      });
      expenses.forEach(exp => {
        const y = (exp.date || '').slice(0, 4);
        const pos = keys.indexOf(y);
        if (pos !== -1) expenseData[pos] += Number(exp.amount) || 0;
      });
    } else {
      // Monthly (last 6 months with exact YYYY-MM)
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        keys.push(ym);
        labels.push(`${months[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`);
        incomeData.push(0);
        expenseData.push(0);
      }
      incomes.forEach(inc => {
        const ym = (inc.date || '').slice(0, 7);
        const pos = keys.indexOf(ym);
        if (pos !== -1) incomeData[pos] += Number(inc.amount) || 0;
      });
      expenses.forEach(exp => {
        const ym = (exp.date || '').slice(0, 7);
        const pos = keys.indexOf(ym);
        if (pos !== -1) expenseData[pos] += Number(exp.amount) || 0;
      });
    }

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Pemasukan',
            data: incomeData,
            backgroundColor: '#10B981',
            borderRadius: 6,
            maxBarThickness: 32
          },
          {
            label: 'Pengeluaran',
            data: expenseData,
            backgroundColor: '#EF4444',
            borderRadius: 6,
            maxBarThickness: 32
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600' }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${FinanceCalculator.formatRupiah(context.raw)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(val) {
                if (val >= 1000000) return (val / 1000000).toFixed(1) + ' Jt';
                if (val >= 1000) return (val / 1000) + ' Rb';
                return val;
              }
            },
            grid: { color: 'rgba(0, 0, 0, 0.05)' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  },

  /**
   * Render Category Expense Donut Chart
   */
  renderCategoryDonutChart(canvasId, expenses = []) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || typeof Chart === 'undefined') return;

    this.destroyChart(canvasId);

    const categories = FinanceCalculator.getExpensesByCategory(expenses);
    if (categories.length === 0) return;

    const labels = categories.map(c => c.category);
    const data = categories.map(c => c.amount);

    const palette = [
      '#7C3AED', '#0EA5E9', '#10B981', '#F59E0B', 
      '#EF4444', '#EC4899', '#8B5CF6', '#14B8A6'
    ];

    this.instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: palette.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#FFFFFF'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 12,
              font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600' }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percent = Math.round((context.raw / total) * 100);
                return `${context.label}: ${FinanceCalculator.formatRupiah(context.raw)} (${percent}%)`;
              }
            }
          }
        }
      }
    });
  },

  /**
   * Render Savings Growth Line Chart
   */
  renderSavingsGrowthChart(canvasId, savingsTx = []) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || typeof Chart === 'undefined') return;

    this.destroyChart(canvasId);

    // Sort transactions chronological
    const sorted = [...savingsTx].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const labels = [];
    const balances = [];
    let cumulative = 0;

    sorted.forEach(tx => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'deposit') cumulative += amt;
      else if (tx.type === 'withdraw') cumulative = Math.max(0, cumulative - amt);

      labels.push(tx.date || 'Hari ini');
      balances.push(cumulative);
    });

    if (labels.length === 0) {
      labels.push('Mulai');
      balances.push(0);
    }

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total Tabungan Terkumpul',
          data: balances,
          borderColor: '#059669',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#059669'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `Tabungan: ${FinanceCalculator.formatRupiah(ctx.raw)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (v) => FinanceCalculator.formatRupiah(v)
            },
            grid: { color: 'rgba(0, 0, 0, 0.05)' }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }
};

window.AppCharts = AppCharts;
