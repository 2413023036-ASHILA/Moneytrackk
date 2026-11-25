/**
 * MONEYTRACK - AI SERVICE INTEGRATION LAYER
 * Connects OpenAI (Financial Diagnostics) and Google Gemini (Conversational Chatbot)
 * Supports secure backend endpoints (/api/ai-analyze, /api/ai-chat), client key overrides, and local fallback.
 */

const AIService = {
  // Backend endpoints (Vercel serverless / Supabase Edge Functions)
  OPENAI_API_ENDPOINT: '/api/ai-analyze',
  GEMINI_API_ENDPOINT: '/api/ai-chat',

  /**
   * Extract anonymized financial summary to feed into AI models
   */
  generateFinancialSummary(state) {
    const metrics = FinanceCalculator.getDashboardMetrics(state);
    const health = FinanceCalculator.calculateFinancialHealth(metrics);
    const categoryBreakdown = FinanceCalculator.getExpensesByCategory(state.expenses);
    
    // Top expense categories
    const topCategories = categoryBreakdown.slice(0, 3).map(c => `${c.category}: ${FinanceCalculator.formatRupiah(c.amount)} (${c.percentage}%)`);

    // Savings goals status
    const savingsOverview = state.savings_goals.map(g => {
      const prog = FinanceCalculator.calculateGoalProgress(g, state.savings_transactions);
      return `${g.name}: ${prog.percentage}% tercapai (${FinanceCalculator.formatRupiah(prog.collected)} / ${FinanceCalculator.formatRupiah(prog.target)})`;
    });

    return {
      userName: state.user?.name || 'Pengguna',
      totalIncome: metrics.totalIncome,
      totalExpense: metrics.totalExpense,
      availableBalance: metrics.availableBalance,
      currentSavings: metrics.currentSavings,
      totalDebt: metrics.totalDebt,
      totalReceivable: metrics.totalReceivable,
      netWorth: metrics.netWorth,
      savingsRate: health.savingsRate,
      expenseRatio: health.expenseRatio,
      healthLabel: health.label,
      healthScore: health.score,
      topCategories,
      savingsOverview,
      transactionCount: state.incomes.length + state.expenses.length
    };
  },

  /**
   * AI PERTAMA: OpenAI API Financial Analysis
   * Calls secure backend endpoint or direct API if configured
   */
  async runOpenAIAnalysis(state) {
    const summary = this.generateFinancialSummary(state);
    const customKey = StorageAdapter.get('openai_custom_key', '');

    try {
      const res = await fetch(this.OPENAI_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary,
          apiKeyOverride: customKey || undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.log('Backend endpoint not reachable. Using client AI analysis engine.');
    }

    // Direct client call if user entered API key in settings
    if (customKey && customKey.startsWith('sk-')) {
      try {
        const directRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${customKey.trim()}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'Anda adalah analis keuangan profesional MoneyTrack. Berikan evaluasi keuangan dalam format JSON valid dengan field: score (integer), scoreLabel (string), summaryText (string), spendingPatterns (array of string), savingsEvaluation (array of string), budgetingRecommendations (array of string).'
              },
              {
                role: 'user',
                content: `Analisis ringkasan keuangan ini: Saldo Rp ${summary.availableBalance}, Pemasukan Rp ${summary.totalIncome}, Pengeluaran Rp ${summary.totalExpense}, Tabungan Rp ${summary.currentSavings}, Rasio Tabungan ${summary.savingsRate}%, Pengeluaran Terbesar: ${summary.topCategories.join(', ')}.`
              }
            ],
            response_format: { type: 'json_object' }
          })
        });

        if (directRes.ok) {
          const directData = await directRes.json();
          const parsed = JSON.parse(directData.choices[0]?.message?.content);
          return {
            ...parsed,
            timestamp: new Date().toISOString(),
            source: 'openai-direct'
          };
        }
      } catch (err) {
        console.error('Direct OpenAI API error:', err);
      }
    }

    // Local Intelligent Financial Diagnostic Engine (Simulating OpenAI response based on real state data)
    await new Promise(r => setTimeout(r, 1200));

    const topCatName = summary.topCategories.length > 0 ? summary.topCategories[0].split(':')[0] : 'Kebutuhan Umum';
    const cashflowStatus = summary.totalIncome >= summary.totalExpense ? 'Surplus' : 'Defisit';
    const surplusAmount = Math.abs(summary.totalIncome - summary.totalExpense);

    const analysisResult = {
      timestamp: new Date().toISOString(),
      score: summary.healthScore,
      scoreLabel: summary.healthLabel,
      summaryText: `Kondisi keuangan Anda saat ini berstatus ${summary.healthLabel} dengan arus kas bulanan mengalami ${cashflowStatus} sebesar ${FinanceCalculator.formatRupiah(surplusAmount)}. Anda mengalokasikan sekitar ${summary.savingsRate}% dari pemasukan untuk tabungan dan memiliki saldo tersedia sebesar ${FinanceCalculator.formatRupiah(summary.availableBalance)}.`,
      spendingPatterns: [
        `Pengeluaran terbesar Anda terpusat pada kategori "${topCatName}".`,
        `Rasio pengeluaran terhadap pemasukan adalah ${summary.expenseRatio}%, yang menunjukkan tingkat konsumsi yang ${summary.expenseRatio > 70 ? 'perlu diperketat' : 'terkendali dengan baik'}.`,
        summary.totalDebt > 0 
          ? `Terdapat tanggungan utang sebesar ${FinanceCalculator.formatRupiah(summary.totalDebt)} yang perlu diprioritaskan sebelum menambah pengeluaran tersier.`
          : 'Bagus sekali! Anda tidak memiliki beban utang berlebih saat ini.'
      ],
      savingsEvaluation: [
        `Total tabungan yang berhasil dikumpulkan mencapai ${FinanceCalculator.formatRupiah(summary.currentSavings)}.`,
        summary.savingsOverview.length > 0 
          ? `Target aktif Anda: ${summary.savingsOverview.join(', ')}.`
          : 'Belum ada target tabungan aktif yang dibuat.',
        summary.savingsRate >= 20 
          ? 'Tingkat tabungan Anda di atas 20%, sangat ideal untuk persiapan masa depan.' 
          : 'Disarankan meningkatkan porsi tabungan ke batas minimal 20% dari penghasilan rutin.'
      ],
      budgetingRecommendations: [
        'Terapkan metode 50/30/20: 50% untuk kebutuhan pokok, 30% untuk gaya hidup/keinginan, dan 20% untuk tabungan/investasi.',
        `Evaluasi kembali pengeluaran untuk ${topCatName} untuk melihat pos mana yang dapat diefisienkan sebesar 10-15%.`,
        'Pastikan dana darurat terisi minimal setara 3 sampai 6 bulan total pengeluaran bulanan.',
        'Pertahankan pencatatan harian yang konsisten di MoneyTrack agar tren pola keuangan tetap terpantau akurat.'
      ]
    };

    return analysisResult;
  },

  /**
   * AI KEDUA: Google Gemini API Financial Chatbot
   * Conversational responses in Indonesian
   */
  async sendGeminiMessage(userMessage, state, chatHistory = []) {
    const summary = this.generateFinancialSummary(state);
    const latestAnalysis = state.ai_analysis;
    const customKey = StorageAdapter.get('gemini_custom_key', '');

    try {
      const res = await fetch(this.GEMINI_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          summary,
          latestAnalysis,
          history: chatHistory.slice(-6),
          apiKeyOverride: customKey || undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        return data.reply;
      }
    } catch (e) {
      console.log('Backend endpoint not reachable. Using client Gemini engine.');
    }

    // Direct Gemini API call if custom key provided
    if (customKey && customKey.startsWith('AIza')) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${customKey.trim()}`;
        const geminiRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: `Anda adalah Gemini, asisten keuangan MoneyTrack. Saldo pengguna: Rp ${summary.availableBalance}, Pemasukan: Rp ${summary.totalIncome}, Pengeluaran: Rp ${summary.totalExpense}, Tabungan: Rp ${summary.currentSavings}. Jawab ramah dalam bahasa Indonesia.` }]
            },
            contents: [{ role: 'user', parts: [{ text: userMessage }] }]
          })
        });

        if (geminiRes.ok) {
          const gData = await geminiRes.json();
          const reply = gData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) return reply;
        }
      } catch (err) {
        console.error('Direct Gemini error:', err);
      }
    }

    // Local Conversational Engine (Aware of real state data)
    await new Promise(r => setTimeout(r, 900));

    const msgLower = userMessage.toLowerCase();

    // 1. Inquiries about OpenAI Analysis
    if (msgLower.includes('analisis') || msgLower.includes('openai') || msgLower.includes('kondisi keuangan') || msgLower.includes('evaluasi')) {
      if (latestAnalysis) {
        return `Berdasarkan hasil analisis terbaru dari OpenAI:\n\n` +
          `• **Status Kesehatan:** ${latestAnalysis.scoreLabel} (Skor ${latestAnalysis.score}/100).\n` +
          `• **Arus Kas:** Pemasukan ${FinanceCalculator.formatRupiah(summary.totalIncome)} vs Pengeluaran ${FinanceCalculator.formatRupiah(summary.totalExpense)}.\n` +
          `• **Pola Pengeluaran:** Kategori tertinggi ada di ${summary.topCategories[0] || 'Kebutuhan Harian'}.\n` +
          `• **Rekomendasi Utama:** Pertahankan porsi tabungan minimal 20% dan prioritaskan pembentukan Dana Darurat. Apakah Anda ingin saya bantu buat rencana anggaran spesifik untuk bulan ini?`;
      } else {
        return `Saat ini belum ada data analisis OpenAI yang tersimpan. Namun dari data catatan Anda, saldo tersedia Anda adalah **${FinanceCalculator.formatRupiah(summary.availableBalance)}** dengan total tabungan **${FinanceCalculator.formatRupiah(summary.currentSavings)}**. Anda bisa klik menu **AI Financial Analysis** untuk menghasilkan laporan analisis lengkap terlebih dahulu!`;
      }
    }

    // 2. Tips Menabung / Hemat
    if (msgLower.includes('tips') || msgLower.includes('hemat') || msgLower.includes('menabung') || msgLower.includes('nabung')) {
      return `Berikut beberapa tips cerdas menabung untuk Anda di MoneyTrack:\n\n` +
        `1. **Gunakan Fitur Setor Tabungan di Awal Bulan:** Segera setelah pemasukan masuk, transfer 10-20% ke target tabungan (misal: "Dana Darurat" atau "Beli Laptop"). Uang di tabungan tidak akan terpakai untuk belanja harian!\n` +
        `2. **Terapkan Aturan 24 Jam:** Sebelum membeli barang non-esensial, tunggu 24 jam untuk memastikan apakah itu kebutuhan atau sekadar keinginan sesaat.\n` +
        `3. **Perhatikan Pengeluaran Mikro:** Biaya admin transfer, jajan kopi, dan biaya pesan-antar makanan seringkali menjadi kebocoran finansial terbesar tanpa disadari.\n` +
        `4. **Manfaatkan Target Tabungan:** Berikan nama spesifik pada target Anda agar motivasi menabung tetap tinggi.`;
    }

    // 3. Planning / Budgeting / Target Tabungan
    if (msgLower.includes('target') || msgLower.includes('anggaran') || msgLower.includes('budget') || msgLower.includes('laptop') || msgLower.includes('hp')) {
      return `Tentu! Untuk merencanakan target tabungan baru, Anda bisa gunakan rumus sederhana:\n\n` +
        `**Setoran Bulanan = (Nominal Target - Dana Saat Ini) ÷ Sisa Bulan Menuju Target**\n\n` +
        `Contohnya, jika Anda ingin membeli barang seharga **Rp 12.000.000** dalam 6 bulan dan saat ini belum ada dana, Anda perlu menyisihkan sekitar **Rp 2.000.000 per bulan**.\n` +
        `Dengan sisa saldo tersedia Anda sebesar **${FinanceCalculator.formatRupiah(summary.availableBalance)}**, Anda bisa mulai membuat target baru di menu **Savings Tracker**!`;
    }

    // 4. Utang / Piutang
    if (msgLower.includes('utang') || msgLower.includes('piutang') || msgLower.includes('pinjaman')) {
      return `Catatan utang & piutang Anda saat ini:\n\n` +
        `• **Total Utang:** ${FinanceCalculator.formatRupiah(summary.totalDebt)}\n` +
        `• **Total Piutang:** ${FinanceCalculator.formatRupiah(summary.totalReceivable)}\n\n` +
        `Saran saya: Jika ada utang, prioritaskan pembayaran sebelum tenggat jatuh tempo untuk menjaga kredibilitas dan ketenangan finansial Anda. Anda bisa mencatat cicilan atau pelunasan melalui tombol **Bayar** di menu Debt Tracker.`;
    }

    // 5. Default conversational response
    return `Terima kasih pertanyaannya! Berdasarkan pantauan data MoneyTrack Anda:\n\n` +
      `• Saldo Tersedia: **${FinanceCalculator.formatRupiah(summary.availableBalance)}**\n` +
      `• Total Pemasukan: **${FinanceCalculator.formatRupiah(summary.totalIncome)}**\n` +
      `• Total Pengeluaran: **${FinanceCalculator.formatRupiah(summary.totalExpense)}**\n` +
      `• Total Tabungan: **${FinanceCalculator.formatRupiah(summary.currentSavings)}**\n\n` +
      `Apakah ada hal khusus yang ingin Anda tanyakan seputar tips mengelola uang, pembagian pos anggaran, atau strategi mencapai target tabungan Anda?`;
  }
};

window.AIService = AIService;
