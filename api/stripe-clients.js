// Vercel Serverless Function — Liste des clients Stripe
// Endpoint : GET /api/stripe-clients
//
// Sécurité :
//  - clé secrète Stripe stockée dans la variable d'env STRIPE_SECRET_KEY
//  - jeton admin stocké dans ADMIN_API_TOKEN, exigé via header X-Admin-Token
//
// Réponse : { total, generatedAt, clients: [...] }

const Stripe = require('stripe');

module.exports = async (req, res) => {
  // CORS / cache
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'X-Admin-Token, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth admin
  const adminToken = process.env.ADMIN_API_TOKEN;
  if (!adminToken) {
    return res.status(500).json({
      error: 'ADMIN_API_TOKEN non configurée sur Vercel.',
    });
  }
  const headerToken =
    req.headers['x-admin-token'] || (req.query && req.query.token);
  if (headerToken !== adminToken) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  // Stripe key
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({
      error: 'STRIPE_SECRET_KEY non configurée sur Vercel.',
    });
  }
  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });

  try {
    // Récupérer toutes les souscriptions (pagination 100/page jusqu'à 5000)
    const allSubs = [];
    let startingAfter = null;
    let hasMore = true;
    let safetyCounter = 0;

    while (hasMore && safetyCounter < 50) {
      safetyCounter++;
      const params = {
        status: 'all',
        limit: 100,
        expand: ['data.customer', 'data.default_payment_method'],
      };
      if (startingAfter) params.starting_after = startingAfter;
      const resp = await stripe.subscriptions.list(params);
      allSubs.push(...resp.data);
      hasMore = resp.has_more;
      if (hasMore && resp.data.length) {
        startingAfter = resp.data[resp.data.length - 1].id;
      } else {
        hasMore = false;
      }
    }

    // Map → format simplifié
    const clients = allSubs.map((sub) => {
      const c = sub.customer || {};
      const item = (sub.items && sub.items.data && sub.items.data[0]) || {};
      const price = item.price || {};
      const product = price.product;
      const unitAmount = (price.unit_amount || 0) * (item.quantity || 1);

      const pm = sub.default_payment_method;
      const card = pm && pm.card ? pm.card : null;

      return {
        customerId: c.id || sub.customer || null,
        name: c.name || null,
        email: c.email || null,
        phone: c.phone || null,
        created: c.created ? c.created * 1000 : null,

        subscriptionId: sub.id,
        status: sub.status, // active, past_due, canceled, trialing, unpaid, incomplete, etc.
        productName:
          (price.nickname && price.nickname) ||
          (typeof product === 'string' ? product : product && product.name) ||
          null,
        amount: unitAmount / 100,
        currency: (price.currency || 'eur').toUpperCase(),
        interval: (price.recurring && price.recurring.interval) || 'month',
        intervalCount:
          (price.recurring && price.recurring.interval_count) || 1,

        currentPeriodStart: sub.current_period_start
          ? sub.current_period_start * 1000
          : null,
        currentPeriodEnd: sub.current_period_end
          ? sub.current_period_end * 1000
          : null,
        cancelAtPeriodEnd: !!sub.cancel_at_period_end,
        canceledAt: sub.canceled_at ? sub.canceled_at * 1000 : null,
        trialEnd: sub.trial_end ? sub.trial_end * 1000 : null,
        startedAt: sub.start_date ? sub.start_date * 1000 : null,

        cardBrand: card && card.brand ? card.brand : null,
        cardLast4: card && card.last4 ? card.last4 : null,
      };
    });

    // Tri par dernière création décroissante
    clients.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));

    return res.status(200).json({
      total: clients.length,
      generatedAt: Date.now(),
      clients,
    });
  } catch (err) {
    console.error('Stripe API error:', err);
    return res.status(500).json({
      error: err.message || 'Erreur Stripe inconnue',
    });
  }
};
