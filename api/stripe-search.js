// Vercel Serverless Function — Recherche d'un client Stripe par nom ou email
// Endpoint : GET /api/stripe-search?q=technoprint3d
// Retourne tous les clients matchant + tous leurs abonnements (TOUS statuts)
//
// Utile pour comprendre pourquoi un client n'apparaît pas dans la liste
// principale (qui n'affiche que les abonnements 'active').

const Stripe = require('stripe');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'X-Admin-Token, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const adminToken = process.env.ADMIN_API_TOKEN;
  if (!adminToken) {
    return res.status(500).json({ error: 'ADMIN_API_TOKEN non configurée.' });
  }
  const headerToken =
    req.headers['x-admin-token'] || (req.query && req.query.token);
  if (headerToken !== adminToken) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const q = ((req.query && req.query.q) || '').trim();
  if (!q) {
    return res.status(400).json({
      error: 'Paramètre q requis (ex: /api/stripe-search?q=technoprint3d)',
    });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY non configurée.' });
  }
  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });

  try {
    // 1) On parcourt les clients (max 1000)
    const matched = [];
    let startingAfter = null;
    let hasMore = true;
    let safety = 0;
    const needle = q.toLowerCase();

    while (hasMore && safety < 10) {
      safety++;
      const params = { limit: 100 };
      if (startingAfter) params.starting_after = startingAfter;
      const resp = await stripe.customers.list(params);
      for (const c of resp.data) {
        const hay = [c.name || '', c.email || '', c.description || '', c.id || '']
          .join(' ').toLowerCase();
        if (hay.includes(needle)) matched.push(c);
      }
      hasMore = resp.has_more;
      if (hasMore && resp.data.length) {
        startingAfter = resp.data[resp.data.length - 1].id;
      } else {
        hasMore = false;
      }
    }

    // 2) Pour chaque client matché, on liste TOUS ses abonnements (tous statuts)
    const results = [];
    for (const c of matched) {
      const subs = await stripe.subscriptions.list({
        customer: c.id,
        status: 'all',
        limit: 100,
      });
      results.push({
        customer: {
          id: c.id,
          name: c.name,
          email: c.email,
          description: c.description,
          delinquent: c.delinquent,
          created: c.created ? c.created * 1000 : null,
        },
        subscriptions: subs.data.map((s) => ({
          id: s.id,
          status: s.status,
          cancelAtPeriodEnd: s.cancel_at_period_end,
          canceledAt: s.canceled_at ? s.canceled_at * 1000 : null,
          startedAt: s.start_date ? s.start_date * 1000 : null,
          currentPeriodStart: s.current_period_start ? s.current_period_start * 1000 : null,
          currentPeriodEnd: s.current_period_end ? s.current_period_end * 1000 : null,
          trialEnd: s.trial_end ? s.trial_end * 1000 : null,
          ended_at: s.ended_at ? s.ended_at * 1000 : null,
          pause_collection: s.pause_collection,
          priceId: s.items.data[0] && s.items.data[0].price && s.items.data[0].price.id,
          amountUnit: s.items.data[0] && s.items.data[0].price
            ? s.items.data[0].price.unit_amount / 100 : null,
        })),
      });
    }

    return res.status(200).json({
      query: q,
      totalCustomersMatched: matched.length,
      results,
    });
  } catch (err) {
    console.error('Stripe search error:', err);
    return res.status(500).json({ error: err.message || 'Erreur Stripe' });
  }
};
