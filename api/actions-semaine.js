// Vercel Serverless Function — Demande des actions de la semaine
// Endpoint : POST /api/actions-semaine
//
// Sécurité :
//   - clé secrète Stripe stockée dans STRIPE_SECRET_KEY (env Vercel)
//   - rate limit côté serveur via metadata Stripe customer
//
// Comportement :
//   1. Reçoit { email } dans le body
//   2. Cherche le customer Stripe par email
//   3. Lit metadata.actions_semaine_last (timestamp ms)
//   4. Si < 12 jours : refuse avec message
//   5. Sinon : met à jour la metadata et autorise l'envoi
//
// Réponse :
//   - { ok: true }                                       → autorisé, le client envoie le mail
//   - { ok: false, daysAgo, message }                    → refusé (trop récent)
//   - { ok: false, error }                               → erreur

const Stripe = require('stripe');

const COOLDOWN_DAYS = 12;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Méthode non autorisée' });
  }

  // Récupération de l'email
  let email = '';
  try {
    const body =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    email = (body.email || (req.query && req.query.email) || '').toString().trim().toLowerCase();
  } catch (_) {
    email = ((req.query && req.query.email) || '').toString().trim().toLowerCase();
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Email invalide' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res
      .status(500)
      .json({ ok: false, error: 'STRIPE_SECRET_KEY non configurée' });
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });

  try {
    // Chercher TOUS les customers correspondant à l'email (peut y en avoir plusieurs)
    const search = await stripe.customers.list({ email, limit: 100 });
    let customers = (search && search.data) || [];
    // Filtrer les supprimés
    customers = customers.filter((c) => !c.deleted);

    // Aucun customer trouvé → on REFUSE (sinon pas de rate limit possible)
    if (!customers.length) {
      return res.status(404).json({
        ok: false,
        error: 'Aucun compte Stripe trouvé pour cet email. Contactez le support.',
        emailChecked: email,
      });
    }

    // Si plusieurs, trouver le plus récent qui a déjà la metadata
    // (évite que le compteur soit "perdu" sur un autre customer en doublon)
    let customer = customers[0];
    let lastTs = parseInt(
      (customer.metadata && customer.metadata.actions_semaine_last) || '0',
      10
    );
    for (let i = 1; i < customers.length; i++) {
      const ts = parseInt(
        (customers[i].metadata && customers[i].metadata.actions_semaine_last) || '0',
        10
      );
      // On garde celui qui a la metadata la plus récente
      if (ts > lastTs) {
        customer = customers[i];
        lastTs = ts;
      }
    }
    // Si aucun n'a de metadata, on utilise le plus récemment créé
    if (!lastTs) {
      customer = customers.reduce(
        (a, b) => ((b.created || 0) > (a.created || 0) ? b : a),
        customers[0]
      );
    }

    const now = Date.now();
    const daysSince = lastTs
      ? Math.floor((now - lastTs) / MS_PER_DAY)
      : Infinity;

    if (lastTs && daysSince < COOLDOWN_DAYS) {
      return res.status(200).json({
        ok: false,
        daysAgo: daysSince,
        cooldownDays: COOLDOWN_DAYS,
        lastIso: new Date(lastTs).toISOString(),
        customerId: customer.id,
        message:
          "Votre demande a été envoyée il y a " +
          (daysSince === 0 ? "moins d'un jour" : daysSince + ' jour' + (daysSince > 1 ? 's' : '')) +
          ". Google n'est pas encore passé sur votre site !",
      });
    }

    // Mise à jour metadata
    await stripe.customers.update(customer.id, {
      metadata: {
        actions_semaine_last: String(now),
        actions_semaine_last_iso: new Date(now).toISOString(),
      },
    });

    return res.status(200).json({
      ok: true,
      tracked: true,
      customerId: customer.id,
      duplicates: customers.length > 1 ? customers.length : undefined,
    });
  } catch (err) {
    console.error('actions-semaine error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Erreur' });
  }
};
