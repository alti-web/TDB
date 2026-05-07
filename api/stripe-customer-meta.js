// Vercel Serverless Function — Update customer metadata
// Endpoint : POST /api/stripe-customer-meta
// Body : { customerId, siteUrl?, secondaryEmail? }
// Auth : header X-Admin-Token (même que /api/stripe-clients)

const Stripe = require('stripe');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'X-Admin-Token, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Méthode non autorisée' });
  }

  // Auth admin
  const adminToken = process.env.ADMIN_API_TOKEN;
  if (!adminToken) {
    return res.status(500).json({ ok: false, error: 'ADMIN_API_TOKEN non configurée' });
  }
  const headerToken =
    req.headers['x-admin-token'] || (req.query && req.query.token);
  if (headerToken !== adminToken) {
    return res.status(401).json({ ok: false, error: 'Non autorisé' });
  }

  // Stripe key
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ ok: false, error: 'STRIPE_SECRET_KEY non configurée' });
  }

  // Body parsing
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  body = body || {};

  const customerId = body.customerId;
  if (!customerId || typeof customerId !== 'string' || !customerId.startsWith('cus_')) {
    return res.status(400).json({ ok: false, error: 'customerId invalide' });
  }

  // Construire la metadata à mettre à jour
  // Stripe : passer null pour effacer une clé, sinon string < 500 chars
  const metadata = {};
  if ('siteUrl' in body) {
    const v = String(body.siteUrl == null ? '' : body.siteUrl).trim().slice(0, 500);
    metadata.site_url = v || null;
  }
  if ('secondaryEmail' in body) {
    const v = String(body.secondaryEmail == null ? '' : body.secondaryEmail).trim().slice(0, 500);
    metadata.secondary_email = v || null;
  }

  if (Object.keys(metadata).length === 0) {
    return res.status(400).json({ ok: false, error: 'Aucun champ à mettre à jour' });
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });

  try {
    const updated = await stripe.customers.update(customerId, { metadata });
    return res.status(200).json({
      ok: true,
      customerId: updated.id,
      siteUrl: (updated.metadata && updated.metadata.site_url) || null,
      secondaryEmail: (updated.metadata && updated.metadata.secondary_email) || null,
    });
  } catch (err) {
    console.error('stripe.customers.update error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Erreur Stripe' });
  }
};
