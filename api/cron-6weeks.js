// Vercel Cron — Vérifie chaque jour quels clients ont atteint 6 semaines
// (42 jours) d'ancienneté dans newEmailDates et déclenche le webhook
// Make.com pour chacun (record_id = email).
//
// AUCUN email n'est envoyé depuis Vercel — Make.com gère l'envoi de mails.
//
// Programmé via vercel.json -> crons.

const NEW_EMAIL_DATES = require('../client-dates');

const MAKE_WEBHOOK = 'https://hook.eu2.make.com/6lcjjumhntxmn5dsdtagjjrbksy8jw05';
const COOLDOWN_DAYS = 42; // 6 semaines
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
  const testDateStr = q.testDate;   // format YYYY-MM-DD, simule "aujourd'hui"
  const forceEmail = q.email;       // déclenche le webhook pour cet email (ignore la date)

  const referenceDate = testDateStr
    ? new Date(testDateStr + 'T00:00:00Z')
    : new Date();
  const todayMidnight = dayUTC(referenceDate);
  const targetDay = todayMidnight - COOLDOWN_DAYS * MS_PER_DAY;

  const triggered = [];
  const errors = [];

  // Si un email est forcé en query string, on déclenche uniquement pour lui
  // (ignore la liste newEmailDates et la vérification de la date)
  const emailsToCheck = forceEmail
    ? [forceEmail]
    : Object.keys(NEW_EMAIL_DATES);

  for (const email of emailsToCheck) {
    const dateStr = NEW_EMAIL_DATES[email] || (forceEmail ? '(forcé via ?email=)' : null);
    if (!forceEmail && !dateStr) continue;
    if (!forceEmail) {
      const addedDay = dayUTC(new Date(dateStr + 'T00:00:00Z'));
      if (addedDay !== targetDay) continue;
    }

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
    const url = MAKE_WEBHOOK + '?record_id=' + encodeURIComponent(email);
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

  return res.status(200).json({
    ok: true,
    dryRun: dryRun,
    today: new Date(todayMidnight).toISOString().slice(0, 10),
    targetDay: new Date(targetDay).toISOString().slice(0, 10),
    triggered,
    errors,
    triggeredCount: triggered.length,
  });
};
