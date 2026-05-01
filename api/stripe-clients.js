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

  // ─── Statuts considérés comme "abonnement actif" ───
  // - active     : paiement normal, abonnement en cours
  // - trialing   : période d'essai en cours (compté comme actif)
  // (past_due exclu : paiement en echec)
  const ACTIVE_STATUSES = ['active', 'trialing'];

  async function fetchSubsForStatus(status) {
    const out = [];
    let startingAfter = null;
    let hasMore = true;
    let safety = 0;
    while (hasMore && safety < 50) {
      safety++;
      const params = {
        status,
        limit: 100,
        expand: [
          'data.customer',
          'data.default_payment_method',
          'data.latest_invoice', // total TTC réel
        ],
      };
      if (startingAfter) params.starting_after = startingAfter;
      const resp = await stripe.subscriptions.list(params);
      out.push(...resp.data);
      hasMore = resp.has_more;
      if (hasMore && resp.data.length) {
        startingAfter = resp.data[resp.data.length - 1].id;
      } else {
        hasMore = false;
      }
    }
    return out;
  }

  // ─── Abonnements PROGRAMMÉS (Subscription Schedules en status not_started) ───
  async function fetchScheduledSubs() {
    const out = [];
    let startingAfter = null;
    let hasMore = true;
    let safety = 0;
    while (hasMore && safety < 20) {
      safety++;
      const params = {
        limit: 100,
        expand: [
          'data.customer',
          'data.phases.items.price',
        ],
      };
      if (startingAfter) params.starting_after = startingAfter;
      try {
        const resp = await stripe.subscriptionSchedules.list(params);
        for (const s of resp.data) {
          if (s.status === 'not_started') out.push(s);
        }
        hasMore = resp.has_more;
        if (hasMore && resp.data.length) {
          startingAfter = resp.data[resp.data.length - 1].id;
        } else {
          hasMore = false;
        }
      } catch (err) {
        console.error('subscriptionSchedules.list error:', err.message);
        hasMore = false;
      }
    }
    return out;
  }

  try {
    // Appels parallèles : abonnements actifs + abonnements programmés
    const [subsArrays, scheduledSchedules] = await Promise.all([
      Promise.all(ACTIVE_STATUSES.map((s) => fetchSubsForStatus(s))),
      fetchScheduledSubs(),
    ]);
    const allSubs = subsArrays.flat();

    // Map → format simplifié
    const clients = allSubs.map((sub) => {
      const c = sub.customer || {};
      const item = (sub.items && sub.items.data && sub.items.data[0]) || {};
      const price = item.price || {};
      const product = price.product;
      const unitAmount = (price.unit_amount || 0) * (item.quantity || 1);

      const pm = sub.default_payment_method;
      const card = pm && pm.card ? pm.card : null;

      // ─── Calcul TTC à partir de la dernière facture ───
      // Stripe : invoice.total = montant TTC réellement facturé
      //          invoice.subtotal = HT
      //          invoice.tax     = TVA
      const inv = sub.latest_invoice && typeof sub.latest_invoice === 'object'
        ? sub.latest_invoice
        : null;
      let amountTTC = null;
      let amountHT = null;
      let taxAmount = null;
      if (inv) {
        if (inv.total != null) amountTTC = inv.total / 100;
        else if (inv.amount_paid != null) amountTTC = inv.amount_paid / 100;
        if (inv.subtotal != null) amountHT = inv.subtotal / 100;
        if (inv.tax != null) taxAmount = inv.tax / 100;
      }
      // Fallback : si pas de facture, on suppose que le prix Stripe est déjà TTC
      if (amountTTC == null) amountTTC = unitAmount / 100;
      if (amountHT == null) amountHT = unitAmount / 100;

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
        amount: amountTTC,         // TTC (par défaut on affiche TTC)
        amountHT: amountHT,        // HT
        taxAmount: taxAmount,      // TVA
        unitAmount: unitAmount / 100, // tarif catalogue Stripe (peut être HT ou TTC selon config)
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

    // ─── Mapper les abonnements PROGRAMMÉS au même format ───
    const scheduledClients = scheduledSchedules.map((sched) => {
      const c = (typeof sched.customer === 'object' && sched.customer) || {};
      const phase =
        sched.phases && sched.phases.length ? sched.phases[0] : null;
      const item =
        phase && phase.items && phase.items.length ? phase.items[0] : null;
      const price = item && typeof item.price === 'object' ? item.price : null;
      const product = price && price.product;
      const unit = price ? (price.unit_amount || 0) * (item.quantity || 1) : 0;
      const startTs = phase && phase.start_date ? phase.start_date * 1000 : null;
      const endTs = phase && phase.end_date ? phase.end_date * 1000 : null;

      return {
        customerId: c.id || (typeof sched.customer === 'string' ? sched.customer : null),
        name: c.name || null,
        email: c.email || null,
        phone: c.phone || null,
        created: c.created ? c.created * 1000 : null,

        subscriptionId: sched.id,
        status: 'scheduled', // statut custom pour différencier
        productName:
          (price && price.nickname) ||
          (typeof product === 'string'
            ? product
            : product && product.name) ||
          null,

        amount: unit / 100,
        amountHT: unit / 100,
        taxAmount: null,
        unitAmount: unit / 100,
        currency: (price && price.currency
          ? price.currency.toUpperCase()
          : 'EUR'),
        interval: (price && price.recurring && price.recurring.interval) || 'month',
        intervalCount:
          (price && price.recurring && price.recurring.interval_count) || 1,

        currentPeriodStart: startTs,
        currentPeriodEnd: endTs,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        trialEnd: null,
        startedAt: startTs, // = date de démarrage prévue
        scheduledStart: startTs,

        cardBrand: null,
        cardLast4: null,
      };
    });

    // Fusion + tri (programmés en haut puisque dates futures)
    const allClients = clients.concat(scheduledClients);
    allClients.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));

    return res.status(200).json({
      total: allClients.length,
      activeCount: clients.length,
      scheduledCount: scheduledClients.length,
      generatedAt: Date.now(),
      clients: allClients,
    });
  } catch (err) {
    console.error('Stripe API error:', err);
    return res.status(500).json({
      error: err.message || 'Erreur Stripe inconnue',
    });
  }
};
