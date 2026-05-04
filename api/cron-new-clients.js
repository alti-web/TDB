// Vercel Cron — Vérifie chaque jour si de nouveaux clients ont été ajoutés
// la veille (date d'ajout dans newEmailDates = hier).
// Si oui, envoie un email récap à benoit@lecourtier.net via EmailJS pour
// lui rappeler d'envoyer un message WhatsApp et de demander les accès.
//
// Programmé via vercel.json -> crons.

const NEW_EMAIL_DATES = require('../client-dates');

const NOTIFY_EMAIL = 'benoit@lecourtier.net';

// EmailJS REST endpoint
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
  // Auth optionnelle (CRON_SECRET)
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
  const testDateStr = q.testDate; // simule "aujourd'hui"

  const referenceDate = testDateStr
    ? new Date(testDateStr + 'T00:00:00Z')
    : new Date();
  const todayMidnight = dayUTC(referenceDate);
  const yesterdayMidnight = todayMidnight - MS_PER_DAY;

  // Trouver les clients ajoutés hier
  const newClients = [];
  for (const email of Object.keys(NEW_EMAIL_DATES)) {
    const dateStr = NEW_EMAIL_DATES[email];
    if (!dateStr) continue;
    const addedDay = dayUTC(new Date(dateStr + 'T00:00:00Z'));
    if (addedDay === yesterdayMidnight) {
      newClients.push({ email, addedAt: dateStr });
    }
  }

  // Aucun nouveau client hier -> rien à faire
  if (!newClients.length) {
    return res.status(200).json({
      ok: true,
      dryRun: dryRun,
      today: new Date(todayMidnight).toISOString().slice(0, 10),
      yesterday: new Date(yesterdayMidnight).toISOString().slice(0, 10),
      newClients: [],
      notification: null,
    });
  }

  // Construction du corps du mail
  const lines = [
    'Envoie un message WA + demande les accès pour le / les clients en dessous :',
    '',
    ...newClients.map((c) => '• ' + c.email),
    '',
    'Merci !',
    '',
    '— Cron quotidien Alti-Web (' + new Date().toLocaleString('fr-FR') + ')',
  ];

  // Mode dry-run : pas d'email envoyé, on retourne juste le contenu
  if (dryRun) {
    return res.status(200).json({
      ok: true,
      dryRun: true,
      today: new Date(todayMidnight).toISOString().slice(0, 10),
      yesterday: new Date(yesterdayMidnight).toISOString().slice(0, 10),
      newClients,
      previewEmail: lines.join('\n'),
      notification: null,
    });
  }

  // Envoi via EmailJS
  let notification = null;
  try {
    const resp = await fetch(EMAILJS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'https://alti-board.fr',
      },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_USER_ID,
        accessToken: process.env.EMAILJS_PRIVATE_KEY || undefined,
        template_params: {
          name: lines.join('\n'),
          email: NOTIFY_EMAIL,
          message:
            'Nouveaux clients ajoutés hier : ' + newClients.length,
        },
      }),
    });
    notification = {
      sent: resp.ok,
      status: resp.status,
      body: (await resp.text().catch(() => '')).slice(0, 200),
    };
  } catch (err) {
    notification = { sent: false, error: err.message };
  }

  return res.status(200).json({
    ok: true,
    dryRun: false,
    today: new Date(todayMidnight).toISOString().slice(0, 10),
    yesterday: new Date(yesterdayMidnight).toISOString().slice(0, 10),
    newClients,
    notification,
    triggeredCount: newClients.length,
  });
};
