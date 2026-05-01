// Vercel Serverless Function — Diagnostic env vars
// Endpoint : GET /api/health
// Retourne juste une indication booléenne (pas les valeurs).

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({
    ok: true,
    hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
    stripeKeyPrefix: process.env.STRIPE_SECRET_KEY
      ? process.env.STRIPE_SECRET_KEY.slice(0, 7) + '…'
      : null,
    hasAdminToken: !!process.env.ADMIN_API_TOKEN,
    adminTokenLength: process.env.ADMIN_API_TOKEN
      ? process.env.ADMIN_API_TOKEN.length
      : 0,
    nodeVersion: process.version,
    region: process.env.VERCEL_REGION || null,
    deployedAt: process.env.VERCEL_GIT_COMMIT_SHA || null,
    timestamp: Date.now(),
  });
};
