/**
 * MONEYTRACK - VERCEL SERVERLESS FUNCTION: OPENAI ANALYSIS
 * Secure Backend Endpoint: /api/ai-analyze
 * Analyzes user financial summary using OpenAI API without exposing API key to frontend.
 */

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metode tidak diizinkan. Gunakan POST.' });
  }

  try {
    const { summary, apiKeyOverride } = req.body || {};

    if (!summary) {
      return res.status(400).json({ error: 'Data ringkasan keuangan (summary) tidak ditemukan.' });
    }

    // Determine OpenAI API Key (from server environment variable or client override in settings)
    const apiKey = process.env.OPENAI_API_KEY || apiKeyOverride;

    if (!apiKey) {
      return res.status(500).json({
        error: 'OPENAI_API_KEY belum dikonfigurasi di server environment variables atau pengaturan.',
        isConfigured: false
      });
    }

    const systemPrompt = `Anda adalah sistem AI Analis Keuangan profesional untuk aplikasi MoneyTrack (Smart Personal Finance Management).
Tugas Anda adalah membaca ringkasan metrik keuangan pengguna dalam mata uang Rupiah (Rp) dan menghasilkan evaluasi objektif, solutif, serta rekomendasi anggaran cerdas.

Anda WAJIB merespons HANYA dalam format JSON valid dengan struktur persis seperti berikut:
{
  "score": <angka integer antara 0 sampai 100>,
  "scoreLabel": "<Sangat Sehat | Sehat | Cukup / Waspada | Perlu Perbaikan>",
  "summaryText": "<Paragraf ringkasan kondisi dan arus kas pengguna dalam bahasa Indonesia>",
  "spendingPatterns": [
    "<Analisis pola pengeluaran poin 1>",
    "<Analisis pola pengeluaran poin 2>",
    "<Analisis pola pengeluaran poin 3>"
  ],
  "savingsEvaluation": [
    "<Evaluasi progres tabungan poin 1>",
    "<Evaluasi progres tabungan poin 2>"
  ],
  "budgetingRecommendations": [
    "<Rekomendasi alokasi 50/30/20 poin 1>",
    "<Rekomendasi alokasi poin 2>",
    "<Rekomendasi alokasi poin 3>"
  ]
}`;

    const userPrompt = `Berikut adalah ringkasan keuangan terkini pengguna:
- Nama Pengguna: ${summary.userName || 'Pengguna'}
- Saldo Tersedia: Rp ${(summary.availableBalance || 0).toLocaleString('id-ID')}
- Total Pemasukan: Rp ${(summary.totalIncome || 0).toLocaleString('id-ID')}
- Total Pengeluaran: Rp ${(summary.totalExpense || 0).toLocaleString('id-ID')}
- Total Tabungan: Rp ${(summary.currentSavings || 0).toLocaleString('id-ID')}
- Total Utang: Rp ${(summary.totalDebt || 0).toLocaleString('id-ID')}
- Total Piutang: Rp ${(summary.totalReceivable || 0).toLocaleString('id-ID')}
- Rasio Tabungan: ${summary.savingsRate || 0}%
- Rasio Pengeluaran: ${summary.expenseRatio || 0}%
- Kategori Pengeluaran Terbesar: ${(summary.topCategories || []).join(', ') || 'Belum ada data'}
- Target Tabungan: ${(summary.savingsOverview || []).join('; ') || 'Belum ada target'}

Analisis data di atas dan hasilkan output JSON sesuai instruksi.`;

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
      })
    });

    if (!openAiResponse.ok) {
      const errBody = await openAiResponse.text();
      console.error('OpenAI API Error:', errBody);
      return res.status(openAiResponse.status).json({
        error: `Gagal memanggil OpenAI API: ${openAiResponse.statusText}`,
        details: errBody
      });
    }

    const data = await openAiResponse.json();
    const content = data.choices[0]?.message?.content;
    const parsedResult = JSON.parse(content);

    return res.status(200).json({
      ...parsedResult,
      timestamp: new Date().toISOString(),
      model: model,
      source: 'openai-api'
    });
  } catch (error) {
    console.error('Serverless Error:', error);
    return res.status(500).json({
      error: 'Terjadi kesalahan internal pada server analisis AI.',
      message: error.message
    });
  }
}
