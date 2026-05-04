// Vercel Cron — Vérifie chaque jour quels clients ont atteint 4 semaines
// (28 jours) d'ancienneté dans newEmailDates et déclenche le webhook
// Make.com pour chacun. Envoie un email de récap à benoit@lecourtier.net
// si au moins un déclenchement a eu lieu.
//
// Programmé via vercel.json -> crons.

const NEW_EMAIL_DATES = require('../client-dates');

const MAKE_WEBHOOK = 'https://hook.eu2.make.com/89lkz8vkwie4un9wy2ff9l451tonwpcf';
const NOTIFY_EMAIL = 'benoit@lecourtier.net';
const COOLDOWN_DAYS = 28; // 4 semaines

// EmailJS REST endpoint pour la notification de récap
const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';
const EMAILJS_SERVICE_ID = 'service_12wtkng';
const EMAILJS_TEMPLATE_ID = 'template_tib1gk7';
const EMAILJS_USER_ID = 'nf_vsJRJn_ucqKgbR';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function dayUTC(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x.getTime();
}

module.exports = async (req, res) => {
  // Vercel Cron : on accepte si CRON_SECRET correspond, ou si pas de secret
  // configuré (pour faciliter le test manuel via curl).
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers && req.headers.authorization;
    if (auth !== 'Bearer ' + cronSecret) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
  }

  // ─── Paramètres de test optionnels ───
  const q = req.query || {};
  const dryRun = q.dryRun === '1' || q.dryRun === 'true';
  const testDateStr = q.testDate; // format YYYY-MM-DD, simule "aujourd'hui"

  const referenceDate = testDateStr
    ? new Date(testDateStr + 'T00:00:00Z')
    : new Date();
  const todayMidnight = dayUTC(referenceDate);
  const targetDay = todayMidnight - COOLDOWN_DAYS * MS_PER_DAY;

  const triggered = [];
  const errors = [];

  for (const email of Object.keys(NEW_EMAIL_DATES)) {
    const dateStr = NEW_EMAIL_DATES[email];
    if (!dateStr) continue;
    const addedDay = dayUTC(new Date(dateStr + 'T00:00:00Z'));
    if (addedDay !== targetDay) continue;

    if (dryRun) {
      // Mode test : on n'appelle pas Make.com
      triggered.push({
        email,
        addedAt: dateStr,
        status: 'DRY_RUN',
        ok: true,
        body: 'Aucun appel webhook effectué (test mode)',
      });
      continue;
    }

    // Match → déclencher le webhook Make.com
    const url =
      MAKE_WEBHOOK + '?record_id=' + encodeURIComponent(email);
    try {
      const resp = await fetch(url);
      const text = await resp.text().catch(() => '');
      triggered.push({
        email,
        addedAt: dateStr,
        status: resp.status,
        ok: resp.ok,
        body: text.slice(0, 200),
      });
    } catch (err) {
      errors.push({ email, error: err.message });
    }
  }

  // Notification Benoit si au moins 1 déclenchement (jamais en dryRun)
  let notification = null;
  if (triggered.length > 0 && !dryRun) {
    const summaryLines = [
      '🔔 CRON 4 SEMAINES — Webhook Make.com déclenché',
      '',
      'Date : ' + new Date().toLocaleString('fr-FR'),
      'Nombre de clients à 4 semaines pile : ' + triggered.length,
      '',
      '--- Détail ---',
      ...triggered.map((t) =>
        '• ' + t.email + ' (ajouté le ' + t.addedAt + ') — HTTP ' + t.status
      ),
    ];
    if (errors.length) {
      summaryLines.push('', '--- Erreurs ---');
      errors.forEach((e) => summaryLines.push('• ' + e.email + ' : ' + e.error));
    }

    try {
      const emailResp = await fetch(EMAILJS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'origin': 'https://alti-board.fr' },
        body: JSON.stringify({
          service_id: EMAILJS_SERVICE_ID,
          template_id: EMAILJS_TEMPLATE_ID,
          user_id: EMAILJS_USER_ID,
          accessToken: process.env.EMAILJS_PRIVATE_KEY || undefined,
          template_params: {
            name: summaryLines.join('\n'),
            email: NOTIFY_EMAIL,
            message: 'Récap cron 4 semaines — ' + triggered.length + ' déclenchement(s)',
          },
        }),
      });
      notification = {
        sent: emailResp.ok,
        status: emailResp.status,
        body: (await emailResp.text().catch(() => '')).slice(0, 200),
      };
    } catch (err) {
      notification = { sent: false, error: err.message };
    }
  }

  return res.status(200).json({
    ok: true,
    dryRun: dryRun,
    today: new Date(todayMidnight).toISOString().slice(0, 10),
    targetDay: new Date(targetDay).toISOString().slice(0, 10),
    triggered,
    errors,
    notification,
    triggeredCount: triggered.length,
  });
};
