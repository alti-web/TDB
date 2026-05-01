# -*- coding: utf-8 -*-
"""
Génère le PDF Charte_Handicap_RSE.pdf en y ajoutant la nouvelle section 08
'Mise en invalidité du prestataire' après l'ancienne section 07
(Force majeure et cas d'empêchement). Les sections 08+ sont renumérotées en 09+.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, KeepTogether, HRFlowable, ListFlowable, ListItem,
)


# ───────── Palette ─────────
COL_TITLE     = HexColor('#1a3a5c')   # Bleu marine pour titres
COL_NUM       = HexColor('#2c5e9e')   # Bleu un peu plus clair pour numéros
COL_SUBHEAD   = HexColor('#2c5e9e')   # Sous-section
COL_BODY      = HexColor('#2d3a4b')   # Texte principal
COL_RULE      = HexColor('#1a3a5c')   # Ligne sous titre
COL_EMPH_BLUE = HexColor('#2c5e9e')   # Italique bleu d'emphase
COL_EMPH_RED  = HexColor('#c0392b')   # Encadrés rouges (article pénal)
COL_BOX_BG    = HexColor('#fbeeec')   # Fond léger pour box rouge
COL_BOX_BLUE_BG = HexColor('#eef3fa') # Fond léger pour box bleue d'acceptation


# ───────── Styles ─────────
styles = getSampleStyleSheet()

style_title = ParagraphStyle(
    'TitleBig', parent=styles['Title'],
    fontName='Helvetica-Bold', fontSize=28, leading=34,
    textColor=COL_TITLE, alignment=TA_CENTER,
    spaceBefore=80, spaceAfter=10
)
style_subtitle = ParagraphStyle(
    'Subtitle', parent=styles['Normal'],
    fontName='Helvetica', fontSize=11.5, leading=16,
    textColor=COL_BODY, alignment=TA_CENTER,
    spaceAfter=46
)
style_num = ParagraphStyle(
    'SecNum', parent=styles['Normal'],
    fontName='Helvetica-Bold', fontSize=10, leading=12,
    textColor=COL_NUM, alignment=TA_LEFT,
    spaceBefore=18, spaceAfter=8
)
style_h1 = ParagraphStyle(
    'SecTitle', parent=styles['Heading1'],
    fontName='Helvetica-Bold', fontSize=17, leading=22,
    textColor=COL_TITLE, alignment=TA_LEFT,
    spaceBefore=2, spaceAfter=4
)
style_h2 = ParagraphStyle(
    'SubHead', parent=styles['Heading2'],
    fontName='Helvetica-Bold', fontSize=11.5, leading=15,
    textColor=COL_SUBHEAD, alignment=TA_LEFT,
    spaceBefore=14, spaceAfter=6
)
style_h3 = ParagraphStyle(
    'BoxTitle', parent=styles['Heading3'],
    fontName='Helvetica-Bold', fontSize=10.5, leading=13,
    textColor=COL_EMPH_RED, alignment=TA_LEFT,
    spaceBefore=2, spaceAfter=6
)
style_body = ParagraphStyle(
    'Body', parent=styles['BodyText'],
    fontName='Helvetica', fontSize=10, leading=15,
    textColor=COL_BODY, alignment=TA_JUSTIFY,
    spaceAfter=8
)
style_bullet = ParagraphStyle(
    'Bullet', parent=style_body,
    fontSize=10, leading=14, leftIndent=14, bulletIndent=2,
    spaceAfter=4
)
style_emph = ParagraphStyle(
    'EmphBlue', parent=style_body,
    fontName='Helvetica-BoldOblique', fontSize=10, leading=14,
    textColor=COL_EMPH_BLUE, alignment=TA_LEFT, leftIndent=10,
    spaceBefore=8, spaceAfter=10
)
style_emph_red = ParagraphStyle(
    'EmphRed', parent=style_body,
    fontName='Helvetica-BoldOblique', fontSize=10, leading=14,
    textColor=COL_EMPH_RED, alignment=TA_LEFT, leftIndent=10,
    spaceBefore=8, spaceAfter=10
)
style_quote_red_title = ParagraphStyle(
    'QuoteRedTitle', parent=styles['Normal'],
    fontName='Helvetica-Bold', fontSize=10, leading=13,
    textColor=COL_EMPH_RED, alignment=TA_LEFT, spaceAfter=6
)
style_quote_red = ParagraphStyle(
    'QuoteRed', parent=styles['Normal'],
    fontName='Helvetica', fontSize=9.5, leading=13,
    textColor=COL_EMPH_RED, alignment=TA_JUSTIFY,
    spaceAfter=8
)
style_quote_blue_title = ParagraphStyle(
    'QuoteBlueTitle', parent=styles['Normal'],
    fontName='Helvetica-Bold', fontSize=10, leading=13,
    textColor=COL_TITLE, alignment=TA_LEFT, spaceAfter=6
)
style_quote_blue = ParagraphStyle(
    'QuoteBlue', parent=styles['Normal'],
    fontName='Helvetica', fontSize=9.5, leading=13,
    textColor=COL_BODY, alignment=TA_JUSTIFY,
    spaceAfter=4
)
style_footer = ParagraphStyle(
    'Footer', parent=styles['Normal'],
    fontName='Helvetica-Oblique', fontSize=8.5, leading=11,
    textColor=COL_BODY, alignment=TA_CENTER,
)


# ───────── Helpers ─────────
def section_header(num, title):
    """Renvoie [Spacer, Paragraph(num), Paragraph(title), HR]."""
    return [
        Paragraph(f"<b>{num}</b>", style_num),
        Paragraph(title, style_h1),
        HRFlowable(width="100%", thickness=0.6, color=COL_RULE,
                   spaceBefore=2, spaceAfter=10),
    ]


def bullets(items, style=None):
    style = style or style_body
    li = [ListItem(Paragraph(t, style), leftIndent=10) for t in items]
    return ListFlowable(li, bulletType='bullet', start='•',
                        leftIndent=18, bulletColor=COL_BODY,
                        bulletFontSize=9)


def red_box(title_html, paragraphs):
    """Encadré rouge (utilisé pour articles pénaux)."""
    inner = []
    inner.append(Paragraph(title_html, style_quote_red_title))
    for p in paragraphs:
        inner.append(Paragraph(p, style_quote_red))
    tbl = Table([[inner]], colWidths=[16.0 * cm])
    tbl.setStyle(TableStyle([
        ('BOX',         (0, 0), (-1, -1), 1, COL_EMPH_RED),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('RIGHTPADDING',(0, 0), (-1, -1), 14),
        ('TOPPADDING',  (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 12),
        ('BACKGROUND',  (0, 0), (-1, -1), COL_BOX_BG),
    ]))
    return tbl


def blue_box(title_html, paragraphs):
    """Encadré bleu pour acceptation finale."""
    inner = []
    inner.append(Paragraph(title_html, style_quote_blue_title))
    for p in paragraphs:
        inner.append(Paragraph(p, style_quote_blue))
    tbl = Table([[inner]], colWidths=[16.0 * cm])
    tbl.setStyle(TableStyle([
        ('BOX',         (0, 0), (-1, -1), 1, COL_TITLE),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('RIGHTPADDING',(0, 0), (-1, -1), 14),
        ('TOPPADDING',  (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 12),
        ('BACKGROUND',  (0, 0), (-1, -1), COL_BOX_BLUE_BG),
    ]))
    return tbl


def referent_box():
    """Petit cadre 'Référent Handicap & RSE'."""
    inner = [
        Paragraph("<b>Référent Handicap &amp; RSE</b>", style_quote_blue_title),
        Paragraph("[Votre nom]", style_quote_blue),
        Paragraph("[Votre email]", style_quote_blue),
        Paragraph("[Votre téléphone]", style_quote_blue),
    ]
    tbl = Table([[inner]], colWidths=[8.0 * cm], hAlign='CENTER')
    tbl.setStyle(TableStyle([
        ('BOX',         (0, 0), (-1, -1), 0.6, COL_TITLE),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('RIGHTPADDING',(0, 0), (-1, -1), 14),
        ('TOPPADDING',  (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 10),
    ]))
    return tbl


# ───────── Construction du document ─────────
story = []

# ───── Titre principal ─────
story.append(Paragraph("CHARTE HANDICAP &amp; RSE", style_title))
story.append(Paragraph(
    "Cadre de collaboration, engagements mutuels<br/>"
    "et protections du prestataire.",
    style_subtitle))

# ───── 01 ─────
story += section_header("01", "Objet de cette charte")
story.append(Paragraph(
    "Le dirigeant d'Alti-Web est en situation de handicap. Cette charte a pour objet "
    "de formaliser le cadre de travail entre le prestataire et ses clients, en tenant "
    "compte de cette réalité.", style_body))
story.append(Paragraph("Elle vise à :", style_body))
story.append(bullets([
    "Poser un cadre de collaboration bienveillant, humain et sans pression inutile.",
    "Rappeler les protections légales dont bénéficie le prestataire en situation de handicap.",
    "Définir clairement la nature des engagements (obligation de moyens).",
    "Prévenir tout malentendu ou litige lié à la situation de handicap du prestataire.",
    "Protéger le prestataire contre tout abus lié à sa vulnérabilité reconnue.",
]))
story.append(Paragraph(
    "Cette charte complète les conditions générales de vente et le contrat de prestation. "
    "Elle est communiquée au client avant le début de la mission.", style_emph))

# ───── 02 ─────
story += section_header("02", "Situation du prestataire")
story.append(Paragraph(
    "En toute transparence, et afin de poser un cadre clair pour la collaboration, le "
    "prestataire porte à la connaissance du client les éléments suivants :", style_body))
story.append(bullets([
    "<b>Reconnaissance RQTH :</b> le prestataire bénéficie d'une reconnaissance de la "
    "qualité de travailleur handicapé (RQTH).",
    "<b>Taux d'incapacité :</b> le taux de handicap reconnu est de <b>80% et plus</b>, "
    "attribué <b>sans limitation de durée</b> (carte mobilité inclusion mention invalidité).",
    "<b>Maladie neurodégénérative :</b> le prestataire est atteint d'une <b>maladie "
    "neurodégénérative</b> diagnostiquée et suivie médicalement. Cette pathologie peut "
    "entraîner des variations dans les délais de réalisation, sans affecter la qualité "
    "de l'expertise délivrée.",
    "<b>Curatelle renforcée :</b> le prestataire est placé sous un régime de "
    "<b>curatelle renforcée</b>, mesure de protection juridique prononcée par le juge "
    "des tutelles. Ce régime implique l'assistance du curateur pour les actes de "
    "disposition et la gestion des comptes.",
]))
story.append(Paragraph(
    "Ces informations sont communiquées dans un souci de transparence et de prévention. "
    "Elles ne peuvent en aucun cas être utilisées au détriment du prestataire.",
    style_emph))

# ───── 03 ─────
story += section_header("03", "Organisation interne")
story.append(Paragraph(
    "L'ensemble des prestations SEO est réalisé <b>exclusivement en interne, par "
    "Benoît et Anne-Charlotte</b>.", style_body))
story.append(Paragraph(
    "Cette organisation garantit un suivi personnalisé, une cohérence dans les "
    "livrables et un interlocuteur unique tout au long de la mission.", style_body))

# ───── 04 ─────
story += section_header("04", "Un cadre de travail bienveillant")
story.append(Paragraph("a) Zéro stress, zéro pression", style_h2))
story.append(Paragraph(
    "Nous créons un cadre de travail apaisé. Chacun avance à son rythme. Nos échanges "
    "sont basés sur l'écoute, la patience et la clarté. Si un sujet est complexe, "
    "nous prenons le temps de l'expliquer autrement. Pas de jargon inutile, pas "
    "d'urgence artificielle.", style_body))
story.append(Paragraph("b) Le droit à l'erreur pour tous", style_h2))
story.append(Paragraph(
    "L'erreur est humaine et fait partie de tout processus d'amélioration :",
    style_body))
story.append(bullets([
    "Un brief incomplet ou une consigne mal formulée ? On clarifie ensemble.",
    "Une recommandation qui ne donne pas le résultat espéré ? On ajuste.",
    "Un malentendu ? On en parle, sans jugement.",
    "Un retard dans vos validations ? On réorganise le planning.",
]))
story.append(Paragraph(
    "Un climat de confiance où chacun peut se tromper sans crainte est le meilleur "
    "terreau pour des résultats durables.", style_emph))

# ───── 05 ─────
story += section_header("05", "Obligation de moyens, pas de résultat")
story.append(Paragraph(
    "Le SEO est par nature une <b>prestation intellectuelle soumise à une obligation "
    "de moyens</b>, et non de résultat. Le prestataire s'engage à mettre en œuvre son "
    "expertise, les bonnes pratiques et les méthodologies éprouvées du référencement "
    "naturel.", style_body))
story.append(Paragraph(
    "Le prestataire ne garantit aucun positionnement précis sur Google ni sur tout "
    "autre moteur de recherche.", style_emph_red))
story.append(Paragraph(
    "Les résultats dépendent de nombreux facteurs externes sur lesquels le prestataire "
    "n'a pas de contrôle total : évolutions algorithmiques, niveau de concurrence, "
    "qualité du contenu fourni par le client, contraintes techniques du site, "
    "réactivité dans la mise en œuvre des recommandations.", style_body))
story.append(Paragraph(
    "En cas de litige, seul le respect de l'obligation de moyens peut être évalué, "
    "et non l'atteinte d'un résultat chiffré.", style_emph))

# ───── 06 ─────
story += section_header("06", "Délais et aménagements liés au handicap")
story.append(Paragraph(
    "Conformément à la <b>loi n° 2005-102 du 11 février 2005</b> pour l'égalité des "
    "droits et des chances, les délais de livraison peuvent être adaptés en raison "
    "de la situation de handicap du prestataire.", style_body))
story.append(Paragraph(
    "La maladie neurodégénérative dont souffre le prestataire peut entraîner des "
    "périodes de fatigue accrue ou de capacité réduite. Ces adaptations constituent "
    "des <b>aménagements raisonnables</b> au sens de la loi.", style_body))
story.append(Paragraph(
    "Un client ne peut pas invoquer un retard lié à l'état de santé du prestataire "
    "comme motif de rupture abusive du contrat.", style_emph))

# ───── 07 ─────
story += section_header("07", "Force majeure et cas d'empêchement")
story.append(Paragraph(
    "Conformément à l'<b>article 1218 du Code civil</b>, sont considérés comme cas de "
    "force majeure entraînant la <b>suspension des obligations sans pénalité</b> :",
    style_body))
story.append(bullets([
    "L'aggravation temporaire de la maladie neurodégénérative du prestataire.",
    "Une hospitalisation ou un arrêt médical lié à la situation de handicap.",
    "Tout événement imprévisible, irrésistible et extérieur au sens de l'article "
    "1218 du Code civil.",
]))
story.append(Paragraph(
    "En cas de survenance, le prestataire (ou son curateur) en informe le client dans "
    "les meilleurs délais. Passé un délai de suspension de <b>3 mois consécutifs</b>, "
    "chacune des parties pourra résilier le contrat sans pénalité.", style_body))

# ───── 08 NOUVEAU : Mise en invalidité ─────
story += section_header("08", "Mise en invalidité du prestataire")
story.append(Paragraph(
    "En complément de l'article 07 ci-dessus, et compte tenu de la nature évolutive "
    "de la maladie neurodégénérative explicitée à l'article 02, il est expressément "
    "convenu entre les parties que :", style_body))
story.append(bullets([
    "<b>En cas de mise en invalidité officielle du prestataire</b> (reconnaissance "
    "d'invalidité prononcée par les autorités médicales et administratives compétentes — "
    "MDPH, médecin-conseil de la Sécurité sociale, médecin du travail, etc.), "
    "<b>le contrat de prestation est automatiquement et définitivement stoppé</b> "
    "à la date de la mise en invalidité.",
    "<b>Aucune demande de remboursement</b> des sommes déjà versées au titre des "
    "prestations réalisées ne sera réalisable, ni au prorata temporis, ni à un autre "
    "titre. Les paiements antérieurs restent dus et acquis au prestataire en "
    "contrepartie du travail effectivement accompli.",
    "<b>Un justificatif officiel</b> de la mise en invalidité sera bien sûr fourni "
    "au client, sur simple demande écrite, dans le respect du secret médical et de "
    "la confidentialité des données de santé (cf. article 11 / 12 ci-après).",
]))
story.append(Paragraph(
    "Cette clause s'inscrit dans la continuité du droit de la force majeure "
    "(article 1218 du Code civil) et tient compte de la particulière vulnérabilité "
    "du prestataire, déjà rappelée aux articles 02 et 11. Elle est acceptée par le "
    "client lors du règlement de la première facture (cf. clause d'acceptation finale).",
    style_emph))

# ───── 09 (ex-08) ─────
story += section_header("09", "Limitation de responsabilité")
story.append(Paragraph(
    "La responsabilité financière du prestataire est <b>limitée au montant des "
    "honoraires effectivement versés</b> pour la prestation concernée.", style_body))
story.append(Paragraph(
    "Cette clause, standard en prestation de services intellectuels, est valable en "
    "B2B. Elle couvre l'ensemble des dommages directs et exclut tout dommage indirect "
    "(perte de chiffre d'affaires, perte de clientèle, atteinte à l'image, etc.).",
    style_body))

# ───── 10 (ex-09) ─────
story += section_header("10", "Protection contre la discrimination")
story.append(Paragraph(
    "Conformément aux <b>articles 225-1 et 225-2 du Code pénal</b>, toute "
    "discrimination fondée sur le handicap est un délit :", style_body))
story.append(bullets([
    "Le refus de contracter en raison du handicap du prestataire.",
    "La rupture contractuelle motivée par la situation de handicap.",
    "Toute condition discriminatoire imposée en lien avec le handicap.",
    "Le harcèlement ou les pressions liés à la situation de handicap.",
]))
story.append(Paragraph(
    "Sanctions encourues : jusqu'à 3 ans d'emprisonnement et 45 000 euros d'amende "
    "pour les personnes physiques.", style_emph_red))

# ───── 11 (ex-10) ─────
story += section_header("11", "Protection contre l'abus de faiblesse")
story.append(Paragraph(
    "Le prestataire, en raison de son handicap reconnu à 80% et plus, de sa maladie "
    "neurodégénérative et de son placement sous curatelle renforcée, est une "
    "<b>personne dont la particulière vulnérabilité est établie</b> au sens de la "
    "loi pénale.", style_body))
story.append(Paragraph(
    "À ce titre, l'<b>article 223-15-2 du Code pénal</b> protège le prestataire contre "
    "tout abus frauduleux de sa situation de faiblesse.", style_body))
story.append(Paragraph("Comportements constitutifs d'un abus de faiblesse",
                       style_h2))
story.append(Paragraph(
    "Sont notamment susceptibles de constituer un abus de faiblesse au sens de "
    "l'article 223-15-2 du Code pénal :", style_body))
story.append(bullets([
    "<b>Demandes techniques abusives :</b> exiger des prestations hors du périmètre "
    "contractuel, des modifications excessives non prévues au devis, ou des "
    "interventions techniques disproportionnées en profitant de la vulnérabilité du "
    "prestataire.",
    "<b>Demandes hors cadre :</b> toute tentative d'obtenir des services non "
    "contractualisés, des heures de travail supplémentaires non rémunérées, ou des "
    "engagements dépassant le périmètre de la mission, en exploitant la difficulté "
    "du prestataire à refuser.",
    "<b>Demandes de remboursement abusives :</b> exiger le remboursement de "
    "prestations dûment réalisées, en profitant de l'état de vulnérabilité du "
    "prestataire pour obtenir une restitution qui n'est pas fondée juridiquement.",
    "<b>Pressions, intimidation ou menaces :</b> tout comportement visant à exercer "
    "une pression psychologique sur le prestataire en exploitant sa situation de "
    "handicap.",
]))
story.append(Spacer(1, 6))
story.append(red_box(
    "ARTICLE 223-15-2 DU CODE PÉNAL",
    [
        "« Est puni de <b>trois ans d'emprisonnement et de 375 000 euros d'amende</b> "
        "l'abus frauduleux de l'état d'ignorance ou de la situation de faiblesse [...] "
        "d'une personne dont la particulière vulnérabilité, due [...] à une maladie, à "
        "une infirmité, à une déficience physique ou psychique [...] est apparente ou "
        "connue de son auteur, pour conduire [...] cette personne à un acte ou à une "
        "abstention qui lui sont gravement préjudiciables. »",
        "<b>Lorsque l'infraction est commise par voie numérique</b> (email, téléphone, "
        "visioconférence, messagerie en ligne), <b>les peines sont portées à 5 ans "
        "d'emprisonnement et 750 000 euros d'amende</b> (loi n° 2024-420 du 10 mai 2024).",
    ]
))
story.append(Spacer(1, 8))
story.append(Paragraph(
    "Le prestataire, assisté de son curateur, se réserve le droit de signaler tout "
    "comportement abusif aux autorités compétentes et de déposer plainte le cas "
    "échéant.", style_body))

# ───── 12 (ex-11) ─────
story += section_header("12", "Confidentialité et données de santé")
story.append(Paragraph(
    "Les informations relatives à la situation de handicap du prestataire communiquées "
    "dans cette charte le sont dans un cadre strictement contractuel.", style_body))
story.append(bullets([
    "Le client <b>n'a aucun droit d'exiger des informations médicales complémentaires</b> "
    "(nature exacte de la pathologie, traitements, pronostic).",
    "Toute divulgation par le client des informations de santé du prestataire à des "
    "tiers constituerait une atteinte à la vie privée (<b>article 9 du Code civil</b>) "
    "et une violation de la protection des données de santé (<b>RGPD, article 9</b>).",
    "Les informations relatives à la curatelle renforcée sont couvertes par le secret "
    "et ne peuvent être communiquées à des tiers sans autorisation.",
]))
story.append(Paragraph(
    "Le prestataire communique uniquement les informations nécessaires au bon "
    "déroulement de la mission (disponibilité, délais, aménagements), sans avoir à "
    "en détailler les raisons médicales.", style_emph))

# ───── 13 (ex-12) ─────
story += section_header("13", "Rôle du curateur dans la relation commerciale")
story.append(Paragraph(
    "La curatelle renforcée implique que le curateur assiste le prestataire pour "
    "certains actes. Dans le cadre de la relation commerciale :", style_body))
story.append(bullets([
    "Le curateur peut être amené à <b>co-signer les engagements contractuels</b> "
    "importants (contrats, devis significatifs, avenants).",
    "Le curateur assure le <b>suivi des encaissements et des paiements</b>.",
    "En cas de litige ou de réclamation, le curateur est l'interlocuteur privilégié "
    "pour les questions juridiques et financières.",
    "Tout acte obtenu du prestataire sans l'assistance de son curateur, lorsque "
    "celle-ci est requise, est susceptible d'être <b>annulé</b> (article 465 du Code civil).",
]))

# ───── 14 (ex-13) ─────
story += section_header("14", "Notre démarche RSE au quotidien")
story.append(Paragraph("Éthique professionnelle", style_h2))
story.append(Paragraph(
    "Nous pratiquons un SEO responsable (White Hat), conforme aux directives des "
    "moteurs de recherche. Pas de techniques trompeuses, pas de promesses irréalistes.",
    style_body))
story.append(Paragraph("Sobriété numérique", style_h2))
story.append(Paragraph(
    "Nous sensibilisons nos clients à l'impact environnemental du web : optimisation "
    "du poids des pages, des images, réduction des requêtes inutiles.", style_body))
story.append(Paragraph("Transparence et honnêteté", style_h2))
story.append(Paragraph(
    "Nous privilégions toujours l'intérêt du client. Si une prestation n'est pas "
    "adaptée à vos besoins, nous vous le dirons.", style_body))
story.append(Paragraph("Respect des données personnelles", style_h2))
story.append(Paragraph(
    "Nous traitons les données qui nous sont confiées dans le strict respect du RGPD.",
    style_body))

# ───── 15 (ex-14) ─────
story += section_header("15", "Vos droits en tant que client")
story.append(bullets([
    "<b>Droit à l'information :</b> vous pouvez nous interroger à tout moment sur "
    "nos méthodes et les résultats obtenus.",
    "<b>Droit à l'adaptation :</b> si nos modes de communication ne vous conviennent "
    "pas, nous nous adaptons.",
    "<b>Droit au désaccord :</b> vous pouvez contester une recommandation. Nous "
    "prendrons le temps de trouver un terrain d'entente.",
    "<b>Droit à la déconnexion :</b> nous respectons vos horaires. Aucune pression "
    "ne sera exercée pour obtenir des retours rapides.",
    "<b>Droit à la confidentialité :</b> vos données ne seront jamais partagées "
    "avec des tiers.",
]))

# ───── 16 (ex-15) ─────
story += section_header("16", "Référent et contact")
story.append(Paragraph(
    "Pour toute question relative à cette charte ou à un besoin d'adaptation "
    "particulier :", style_body))
story.append(Spacer(1, 8))
story.append(referent_box())
story.append(Spacer(1, 18))
story.append(Paragraph(
    "Cette charte traduit notre conviction : le professionnalisme et l'humanité "
    "ne sont pas incompatibles. En la partageant avec vous, nous posons les bases "
    "d'une relation de travail claire, respectueuse et protectrice pour chacun.",
    style_emph))

# ───── Acceptation finale ─────
story.append(Spacer(1, 14))
story.append(Paragraph("<b>Merci de votre confiance.</b>", style_body))
story.append(Spacer(1, 6))
story.append(blue_box(
    "ACCEPTATION DE LA CHARTE",
    [
        "La présente charte est réputée lue et acceptée par le client dès le "
        "<b>premier paiement</b> effectué au titre de la prestation. Le règlement "
        "de la première facture vaut reconnaissance expresse par le client de "
        "l'ensemble des dispositions de cette charte, y compris la prise de "
        "connaissance de la situation de handicap du prestataire et des protections "
        "légales applicables.",
    ]
))
story.append(Spacer(1, 18))
story.append(HRFlowable(width="60%", thickness=0.4,
                        color=COL_BODY, hAlign='CENTER'))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "Cette charte Handicap &amp; RSE est un document d'engagement professionnel. "
    "Elle complète les conditions générales de vente et le contrat de prestation. "
    "<b>Version 2.1 — 2026.</b>",
    style_footer))


# ───────── Sortie ─────────
def _on_page(canvas, doc):
    canvas.saveState()
    canvas.restoreState()


doc = SimpleDocTemplate(
    "Charte_Handicap_RSE.pdf",
    pagesize=A4,
    leftMargin=2.4 * cm,
    rightMargin=2.4 * cm,
    topMargin=2.0 * cm,
    bottomMargin=2.0 * cm,
    title="Charte Handicap & RSE — Alti-Web",
    author="Alti-Web",
    subject="Charte Handicap & RSE",
)

doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)
print("PDF généré : Charte_Handicap_RSE.pdf")
