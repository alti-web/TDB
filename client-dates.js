// ─── Dates d'ajout des nouveaux clients dans le dashboard ───
// Ce fichier est partagé entre dashboard-altiweb.html, admin-clients-stripe.html
// et le cron Vercel api/cron-4weeks.js. Source unique de vérité.
//
// Format : { 'email@domaine.fr': 'YYYY-MM-DD' }

var NEW_EMAIL_DATES = {
  'auxptitsbonheursdecri@gmail.com': '2026-03-18',
  'veroniquedenis965@gmail.com': '2026-03-18',
  'contact@veronique-lambis-tarologue.com': '2026-03-18',
  'leplae.luc@wanadoo.fr': '2026-03-19',
  'amandineleana0303@gmail.com': '2026-03-20',
  'contact@technoprint3d.fr': '2026-03-20',
  'beauvezeaventure@gmail.com': '2026-03-26',
  'hetrezenlisieux@gmail.com': '2026-03-26',
  'info@hetrezen.com': '2026-03-26',
  'klouaneh@gmail.com': '2026-03-26',
  'cmdpomes@gmail.com': '2026-03-27',
  'sandrinejegou@orange.fr': '2026-04-02',
  'contact@sophrologiehypnose-sjegou.com': '2026-04-02',
  'contact@aufildespierres.com': '2026-04-02',
  'sandpillet362@gmail.com': '2026-04-02',
  'redflow19@gmail.com': '2026-04-09',
  'contact@frelon19.fr': '2026-04-09',
  'satnamarie@yahoo.com': '2026-04-10',
  'lecoiffeurdupassage@gmail.com': '2026-04-10',
  'votreinstanttherapie@gmail.com': '2026-04-20',
  'info@essenterra.fr': '2026-05-02',
  'severinemoulliere@gmail.com': '2026-05-02'
};

// Compatibilité navigateur (admin-clients-stripe.html, dashboard-altiweb.html)
if (typeof window !== 'undefined') {
  window.NEW_EMAIL_DATES = NEW_EMAIL_DATES;
}
// Compatibilité Node.js / Vercel functions (api/cron-4weeks.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NEW_EMAIL_DATES;
}
