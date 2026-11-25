/**
 * MONEYTRACK - VERCEL SERVERLESS FUNCTION: GOOGLE GEMINI CHATBOT
 * Secure Backend Endpoint: /api/ai-chat
 * Conversational AI Assistant powered by Google Gemini API.
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
    const { message, summary, latestAnalysis, history, apiKeyOverride } = req.body || {};

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Pesan pengguna tidak boleh kosong.' });
    }

    // Determine Gemini API Key
    const apiKey = process.env.GEMINI_API_KEY || apiKeyOverride;

    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY belum dikonfigurasi di server environment variables atau pengaturan.',
        isConfigured: false
      });
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    // Construct Contextual Prompt with User Financial State & OpenAI Analysis
    let contextData = '';
    if (summary) {
      contextData += `\n[DATA KEUANGAN PENGGUNA SAAT INI]:
- Nama: ${summary.userName || 'Pengguna'}
- Saldo Tersedia: Rp ${(summary.availableBalance || 0).toLocaleString('id-ID')}
- Total Pemasukan: Rp ${(summary.totalIncome || 0).toLocaleString('id-ID')}
- Total Pengeluaran: Rp ${(summary.totalExpense || 0).toLocaleString('id-ID')}
- Total Tabungan: Rp ${(summary.currentSavings || 0).toLocaleString('id-ID')}
- Total Utang: Rp ${(summary.totalDebt || 0).toLocaleString('id-ID')}
- Total Piutang: Rp ${(summary.totalReceivable || 0).toLocaleString('id-ID')}
- Pengeluaran Terbesar: ${(summary.topCategories || []).join(', ') || 'N/A'}
- Target Tabungan: ${(summary.savingsOverview || []).join('; ') || 'N/A'}`;
    }

    if (latestAnalysis) {
      contextData += `\n\n[HASIL ANALISIS TERBARU DARI OPENAI]:
- Status Kesehatan: ${latestAnalysis.scoreLabel || 'N/A'} (Skor ${latestAnalysis.score || 0}/100)
- Ringkasan OpenAI: ${latestAnalysis.summaryText || 'N/A'}
- Rekomendasi OpenAI: ${(latestAnalysis.budgetingRecommendations || []).join('; ') || 'N/A'}`;
    }

    const systemInstruction = `Anda adalah asisten percakapan keuangan pribadi yang ramah, cerdas, dan suportif bernama "Gemini" pada aplikasi web MoneyTrack (Kelola Uangmu, Wujudkan Tujuanmu).
Tugas Anda:
1. Menjawab pertanyaan pengguna tentang pengelolaan uang, pos anggaran, dan tips menabung dalam bahasa Indonesia yang santun dan mudah dipahami.
2. Menjelaskan hasil analisis keuangan dari OpenAI jika pengguna menanyakannya.
3. Membantu perencanaan target tabungan secara realistis dengan memanfaatkan fitur setor/tarik internal transfer MoneyTrack.
4. Memberikan tips praktis efisiensi belanja berdasarkan kategori pengeluaran terbesar pengguna.
5. Gunakan format markdown tebal (**bold**), bullet points, dan penomoran agar rapi dibaca.
${contextData}`;

    // Format chat history for Gemini API
    const contents = [];

    // System instruction passed via system_instruction field or first turn
    if (history && Array.isArray(history)) {
      history.slice(-6).forEach(item => {
        contents.push({
          role: item.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: item.text }]
        });
      });
    }

    // Add current user prompt
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey.trim()}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000
        }
      })
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('Gemini API Error:', errText);
      return res.status(geminiResponse.status).json({
        error: `Gagal memanggil Google Gemini API: ${geminiResponse.statusText}`,
        details: errText
      });
    }

    const data = await geminiResponse.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Maaf, saya tidak dapat menghasilkan jawaban saat ini.';

    return res.status(200).json({
      reply: replyText,
      model: modelName,
      source: 'gemini-api'
    });
  } catch (error) {
    console.error('Gemini Serverless Error:', error);
    return res.status(500).json({
      error: 'Terjadi kesalahan internal pada server chatbot Gemini.',
      message: error.message
    });
  }
}
