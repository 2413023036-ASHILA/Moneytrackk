/**
 * MONEYTRACK - PUBLIC SUPABASE CONFIG ENDPOINT
 * Safely exposes ONLY the public Project URL and Publishable/Anon Key from env vars.
 * NEVER exposes SUPABASE_SERVICE_ROLE_KEY or any secret keys.
 */
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || ''
  });
};
