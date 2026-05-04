// Vercel Serverless Function — Analyse SEO d'un site via DataForSEO
// Endpoint : POST /api/seo-keywords
// Body : { url, email, location? }
//
// Récupère les mots-clés sur lesquels le domaine se positionne via
// DataForSEO Labs (Google ranked_keywords), extrait :
//   - le TOP 60 le plus important (par ETV — estimated traffic value)
//   - le TOP 20 longue traîne (4+ mots)
// Puis envoie un email récap via EmailJS.

const DATAFORSEO_API = 'https://api.dataforseo.com/v3';
const DATAFORSEO_AUTH =
  process.env.DATAFORSEO_AUTH ||
  'YmVub2l0QGxlY291cnRpZXIubmV0OmM5ZWQyM2JiNTdhZTE1ODc=';

const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';
const EMAILJS_SERVICE_ID = 'service_12wtkng';
const EMAILJS_TEMPLATE_ID = 'template_tib1gk7';
const EMAILJS_USER_ID = 'nf_vsJRJn_ucqKgbR';

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');
}
function extractDomain(input) {
  try {
    const raw = String(input || '').trim();
    const u = new URL(raw.startsWith('http') ? raw : 'https://' + raw);
    return u.hostname.replace(/^www\./i, '').toLowerCase();
  } catch (_) {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Méthode non autorisée' });
  }

  // Body parsing
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  body = body || {};

  const inputUrl = body.url || '';
  const email = (body.email || '').trim();
  const locationCode = parseInt(body.location_code || 2250, 10); // 2250 = France
  const languageCode = body.language_code || 'fr';

  const domain = extractDomain(inputUrl);
  if (!domain) {
    return res.status(400).json({ ok: false, error: 'URL invalide' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'Email invalide' });
  }

  // ─── Appel DataForSEO ranked_keywords/live ───
  let dfsData;
  try {
    const dfsResp = await fetch(
      DATAFORSEO_API + '/dataforseo_labs/google/ranked_keywords/live',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + DATAFORSEO_AUTH,
        },
        body: JSON.stringify([
          {
            target: domain,
            location_code: locationCode,
            language_code: languageCode,
            limit: 1000,
            ignore_synonyms: true,
            include_serp_info: false,
            include_clickstream_data: false,
            load_rank_absolute: true,
            order_by: ['keyword_data.keyword_info.search_volume,desc'],
          },
        ]),
      }
    );
    if (!dfsResp.ok) {
      const t = await dfsResp.text().catch(() => '');
      return res.status(500).json({
        ok: false,
        error: 'Erreur DataForSEO (HTTP ' + dfsResp.status + ')',
        detail: t.slice(0, 300),
      });
    }
    dfsData = await dfsResp.json();
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: 'Erreur réseau DataForSEO : ' + err.message,
    });
  }

  // Parse résultats
  const tasks = (dfsData && dfsData.tasks) || [];
  const task = tasks[0] || {};
  if (task.status_code !== 20000) {
    return res.status(500).json({
      ok: false,
      error: 'DataForSEO error : ' + (task.status_message || 'inconnue'),
      taskStatus: task.status_code,
    });
  }
  const result0 = (task.result || [])[0] || {};
  const items = result0.items || [];

  if (!items.length) {
    return res.status(200).json({
      ok: true,
      domain,
      total: 0,
      top60: [],
      top20LongTail: [],
      top20Ranked: [],
      emailSent: false,
      message: 'Aucun mot-clé trouvé pour ce domaine sur la zone géographique demandée',
    });
  }

  // Mappage simplifié
  const keywords = items.map((it) => {
    const kd = it.keyword_data || {};
    const ki = kd.keyword_info || {};
    const rs = it.ranked_serp_element || {};
    const si = rs.serp_item || {};
    const kw = kd.keyword || '';
    return {
      keyword: kw,
      search_volume: ki.search_volume || 0,
      cpc: ki.cpc || 0,
      competition: ki.competition_level || null,
      rank: si.rank_group || 0,
      rank_absolute: si.rank_absolute || 0,
      etv: si.etv || 0,
      url: si.url || null,
      word_count: kw.split(/\s+/).filter(Boolean).length,
    };
  });

  // ─── TOP 60 le plus important (par ETV puis search_volume) ───
  const sortByImportance = (a, b) => {
    const ea = a.etv || 0;
    const eb = b.etv || 0;
    if (eb !== ea) return eb - ea;
    return (b.search_volume || 0) - (a.search_volume || 0);
  };
  const top60 = keywords.slice().sort(sortByImportance).slice(0, 60);

  // ─── TOP 20 longue traîne (4+ mots) ───
  const longTail = keywords
    .filter((k) => k.word_count >= 4)
    .slice()
    .sort(sortByImportance)
    .slice(0, 20);

  // Ensemble unique (top60 + longTail)
  const allMap = new Map();
  [...top60, ...longTail].forEach((k) => {
    if (!allMap.has(k.keyword)) allMap.set(k.keyword, k);
  });
  const allKeywords = [...allMap.values()];

  // Mots-clés actuellement classés en TOP 20 sur Google
  const top20Ranked = allKeywords
    .filter((k) => k.rank > 0 && k.rank <= 20)
    .slice()
    .sort((a, b) => a.rank - b.rank);

  // ─── Construction du mail ───
  const lines = [];
  lines.push('Bonjour,');
  lines.push('');
  lines.push('Voici les mots-clés positionnés dans le TOP 20 cette semaine sur Google');
  lines.push('pour ' + domain + ' :');
  lines.push('');
  if (top20Ranked.length === 0) {
    lines.push('(aucun mot-clé en TOP 20 cette semaine)');
  } else {
    top20Ranked.forEach((k, i) => {
      lines.push(
        (i + 1) + '. ' + k.keyword + ' — En ' + k.rank + (k.rank === 1 ? 'ère' : 'ème') + ' place'
      );
    });
  }
  lines.push('');
  lines.push('* Mots clés génériques + mots de marques.');
  lines.push('');
  lines.push(
    'Actuellement, ' +
      allKeywords.length +
      ' mots clés sont suivis / travaillés au total, vous allez le recevoir petit à petit.'
  );
  lines.push('');
  lines.push('--- Listing des mots-clés ('+ allKeywords.length +') ---');
  lines.push('');
  lines.push('TOP 60 par importance :');
  top60.forEach((k, i) => {
    lines.push(
      '  ' + (i + 1) + '. ' + k.keyword +
      (k.search_volume ? '  [vol. ' + k.search_volume + ']' : '') +
      (k.rank ? '  [pos. ' + k.rank + ']' : '')
    );
  });
  if (longTail.length) {
    lines.push('');
    lines.push('TOP 20 longue traîne :');
    longTail.forEach((k, i) => {
      lines.push(
        '  ' + (i + 1) + '. ' + k.keyword +
        (k.search_volume ? '  [vol. ' + k.search_volume + ']' : '') +
        (k.rank ? '  [pos. ' + k.rank + ']' : '')
      );
    });
  }

  // ─── Envoi du mail via EmailJS ───
  let emailSent = false;
  let emailStatus = null;
  try {
    const emailResp = await fetch(EMAILJS_ENDPOINT, {
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
          email: email,
          message: 'Analyse SEO de ' + domain + ' — ' + allKeywords.length + ' mots-clés',
        },
      }),
    });
    emailSent = emailResp.ok;
    emailStatus = emailResp.status;
  } catch (err) {
    emailSent = false;
    emailStatus = 'error: ' + err.message;
  }

  return res.status(200).json({
    ok: true,
    domain,
    locationCode,
    languageCode,
    total: allKeywords.length,
    top60Count: top60.length,
    longTailCount: longTail.length,
    top20RankedCount: top20Ranked.length,
    emailSent,
    emailStatus,
  });
};
