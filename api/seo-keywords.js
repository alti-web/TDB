// Vercel Serverless Function — Analyse SEO d'un site
// Endpoint : POST /api/seo-keywords
// Body : { url, email, location_code? }
//
// Flow :
//   1. Récupère le HTML du site et extrait le texte
//   2. Claude (Opus 4.7) analyse le contenu et propose :
//        • 60 mots-clés principaux
//        • 30 mots-clés longue traîne (4+ mots)
//   3. DataForSEO ranked_keywords récupère les positions actuelles du domaine
//   4. Croise les deux listes pour identifier les mots-clés Claude
//      qui sont actuellement classés en TOP 20 sur Google
//   5. Envoie un email récap via EmailJS

// ─────────── ANTHROPIC ───────────
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-opus-4-7';

const SEO_SYSTEM_PROMPT = `Tu es un expert SEO français senior.
Analyse le contenu d'un site web fourni et propose :
- 60 mots-clés principaux (1 à 3 mots), pertinents et avec un volume de recherche probable
- 30 mots-clés longue traîne (4 mots ou plus), spécifiques et à intention forte

Règles strictes :
- Mots-clés en français exclusivement (sauf si le site est dans une autre langue)
- Couvrir : services/produits, ville/région, intentions (achat, comparaison, info, urgence)
- Inclure le secteur d'activité ET la zone géographique du site
- Pas de duplication entre les deux listes
- Pas de marques ou concurrents (sauf si c'est le sujet du site)
- Privilégier les requêtes commerciales et locales`;

const SEO_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['main_keywords', 'long_tail_keywords'],
  properties: {
    main_keywords: {
      type: 'array',
      description: '60 mots-clés principaux (1-3 mots)',
      items: { type: 'string' },
    },
    long_tail_keywords: {
      type: 'array',
      description: '30 mots-clés longue traîne (4+ mots)',
      items: { type: 'string' },
    },
  },
};

// ─────────── DATAFORSEO ───────────
const DATAFORSEO_API = 'https://api.dataforseo.com/v3';
const DATAFORSEO_AUTH =
  process.env.DATAFORSEO_AUTH ||
  'YmVub2l0QGxlY291cnRpZXIubmV0OmM5ZWQyM2JiNTdhZTE1ODc=';

// ─────────── EMAILJS ───────────
const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';
const EMAILJS_SERVICE_ID = 'service_12wtkng';
const EMAILJS_TEMPLATE_ID = 'template_tib1gk7';
const EMAILJS_USER_ID = 'nf_vsJRJn_ucqKgbR';

// ─────────── HELPERS ───────────
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

// Récupère et nettoie le HTML du site (texte brut, capé à 80K chars ≈ 20K tokens)
async function fetchSiteText(url) {
  const fetchUrl = url.startsWith('http') ? url : 'https://' + url;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const resp = await fetch(fetchUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AltiWeb-SEO-Bot/1.0; +https://alti-web.fr)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status + ' lors du fetch du site');
    const html = await resp.text();
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&[a-z]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.slice(0, 80000);
  } finally {
    clearTimeout(timer);
  }
}

// Demande à Claude d'extraire 60 + 30 mots-clés du contenu du site
async function getKeywordsFromClaude(domain, siteText) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY non configurée sur Vercel');

  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    system: [
      {
        type: 'text',
        text: SEO_SYSTEM_PROMPT,
        // Cache no-op tant que le prompt < 4096 tokens (limite Opus 4.7).
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content:
          'Site analysé : ' + domain +
          '\n\n--- CONTENU EXTRAIT ---\n' + siteText +
          '\n--- FIN CONTENU ---\n\n' +
          'Génère exactement 60 mots-clés principaux + 30 longue traîne. Aucun commentaire.',
      },
    ],
    output_config: {
      effort: 'high',
      format: {
        type: 'json_schema',
        schema: SEO_OUTPUT_SCHEMA,
      },
    },
  };

  const resp = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error('Anthropic ' + resp.status + ' : ' + errText.slice(0, 300));
  }

  const data = await resp.json();
  const textBlock = (data.content || []).find((b) => b.type === 'text');
  if (!textBlock || !textBlock.text) {
    throw new Error('Réponse Anthropic sans contenu texte');
  }
  const parsed = JSON.parse(textBlock.text);
  return {
    main: (parsed.main_keywords || []).filter((s) => typeof s === 'string').map((s) => s.trim()).filter(Boolean).slice(0, 60),
    longTail: (parsed.long_tail_keywords || []).filter((s) => typeof s === 'string').map((s) => s.trim()).filter(Boolean).slice(0, 30),
    usage: data.usage,
  };
}

// DataForSEO ranked_keywords/live pour récupérer toutes les positions du domaine
async function fetchRankedKeywords(domain, locationCode, languageCode) {
  const resp = await fetch(
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
          order_by: ['ranked_serp_element.serp_item.rank_group,asc'],
        },
      ]),
    }
  );
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error('DataForSEO ' + resp.status + ' : ' + t.slice(0, 200));
  }
  const data = await resp.json();
  const task = (data.tasks || [])[0] || {};
  if (task.status_code !== 20000) {
    throw new Error('DataForSEO error : ' + (task.status_message || 'inconnue'));
  }
  const items = ((task.result || [])[0] || {}).items || [];
  // Map keyword (lowercase) → { rank, search_volume }
  const map = new Map();
  for (const it of items) {
    const kw = (it.keyword_data && it.keyword_data.keyword || '').toLowerCase().trim();
    if (!kw) continue;
    const rank = (it.ranked_serp_element && it.ranked_serp_element.serp_item || {}).rank_group || 0;
    const sv = (it.keyword_data && it.keyword_data.keyword_info || {}).search_volume || 0;
    if (!map.has(kw) || rank < map.get(kw).rank) {
      map.set(kw, { rank, search_volume: sv });
    }
  }
  return map;
}

// ─────────── HANDLER ───────────
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
  const locationCode = parseInt(body.location_code || 2250, 10);
  const languageCode = body.language_code || 'fr';

  const domain = extractDomain(inputUrl);
  if (!domain) return res.status(400).json({ ok: false, error: 'URL invalide' });
  if (!isValidEmail(email)) return res.status(400).json({ ok: false, error: 'Email invalide' });

  // ─── 1. Fetch HTML du site ───
  let siteText;
  try {
    siteText = await fetchSiteText(inputUrl);
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: 'Impossible d\'accéder au site : ' + err.message,
    });
  }
  if (!siteText || siteText.length < 200) {
    return res.status(400).json({
      ok: false,
      error: 'Le site renvoie trop peu de contenu pour être analysé',
    });
  }

  // ─── 2. Claude analyse + DataForSEO en parallèle ───
  let claudeResult, rankedMap;
  try {
    const [c, r] = await Promise.all([
      getKeywordsFromClaude(domain, siteText),
      fetchRankedKeywords(domain, locationCode, languageCode).catch((err) => {
        console.error('DataForSEO error (non bloquant):', err.message);
        return new Map(); // continue sans données de positionnement
      }),
    ]);
    claudeResult = c;
    rankedMap = r;
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: 'Erreur d\'analyse : ' + err.message,
    });
  }

  const allClaudeKeywords = [...claudeResult.main, ...claudeResult.longTail];
  const totalKeywords = allClaudeKeywords.length;

  // ─── 3. Croisement : keywords Claude classés en TOP 20 ───
  const top20 = [];
  const allWithRank = [];
  for (const kw of allClaudeKeywords) {
    const data = rankedMap.get(kw.toLowerCase());
    const entry = {
      keyword: kw,
      rank: data ? data.rank : 0,
      search_volume: data ? data.search_volume : 0,
    };
    allWithRank.push(entry);
    if (data && data.rank > 0 && data.rank <= 20) {
      top20.push(entry);
    }
  }
  top20.sort((a, b) => a.rank - b.rank);

  // ─── 4. Construction du mail ───
  const lines = [];
  lines.push('Bonjour,');
  lines.push('');
  lines.push('Voici les mots-clés positionnés dans le TOP 20 cette semaine sur Google');
  lines.push('pour ' + domain + ' :');
  lines.push('');
  if (top20.length === 0) {
    if (rankedMap.size === 0) {
      lines.push('(données de positionnement temporairement indisponibles)');
    } else {
      lines.push('(aucun mot-clé en TOP 20 cette semaine)');
    }
  } else {
    top20.forEach((k, i) => {
      const place = k.rank === 1 ? '1ère' : (k.rank + 'ème');
      lines.push((i + 1) + '. ' + k.keyword + ' — En ' + place + ' place');
    });
  }
  lines.push('');
  lines.push('* Mots clés génériques + mots de marques.');
  lines.push('');
  lines.push(
    'Actuellement, ' + totalKeywords +
    ' mots clés sont suivis / travaillés au total, vous allez le recevoir petit à petit.'
  );
  lines.push('');
  lines.push('--- Listing des mots-clés (' + totalKeywords + ', proposés par notre IA) ---');
  lines.push('');
  lines.push('TOP 60 mots-clés principaux :');
  claudeResult.main.forEach((kw, i) => {
    const data = rankedMap.get(kw.toLowerCase());
    const extra = data && data.rank
      ? '  [pos. ' + data.rank + ', vol. ' + (data.search_volume || 0) + ']'
      : '';
    lines.push('  ' + (i + 1) + '. ' + kw + extra);
  });
  if (claudeResult.longTail.length) {
    lines.push('');
    lines.push('TOP 30 mots-clés longue traîne :');
    claudeResult.longTail.forEach((kw, i) => {
      const data = rankedMap.get(kw.toLowerCase());
      const extra = data && data.rank
        ? '  [pos. ' + data.rank + ', vol. ' + (data.search_volume || 0) + ']'
        : '';
      lines.push('  ' + (i + 1) + '. ' + kw + extra);
    });
  }

  // ─── 5. Envoi du mail via EmailJS ───
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
          message: 'Analyse SEO IA de ' + domain + ' — ' + totalKeywords + ' mots-clés',
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
    total: totalKeywords,
    top60Count: claudeResult.main.length,
    longTailCount: claudeResult.longTail.length,
    top20RankedCount: top20.length,
    rankedDataAvailable: rankedMap.size > 0,
    claudeUsage: claudeResult.usage,
    emailSent,
    emailStatus,
  });
};
