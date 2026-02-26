from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from urllib.parse import urlparse, quote_plus
import time
import json
import os
import sys
import requests
import re
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# =============================================
# CONFIG
# =============================================
MEMORY_FILE = "sites_traites.json"
RAPPORT_EMAIL = "benoit@lecourtier.net"
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USER = "benoit@lecourtier.net"
SMTP_PASSWORD = os.environ["SMTP_PASSWORD"]
SMTP_FROM = "anne-charlotte@alti-web.fr"
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
PRENOM = "Anne Charlotte"
NOM = "Hubsch"
EMAIL = "anne-charlotte@alti-web.fr"
TELEPHONE = "0679967502"
MESSAGE = """Hello,
Je fais suite à votre demande pour un audit de Référencement Google SEO (visibilité)
sur notre site alti-web.fr/seo-referencement-toulon
(100% gratuit ❤️, 100% sur mesure ❤️ & 100% humain ❤️  )
et ... il vous servira dans tous les cas.
Vous ne voyez pas d'inconvénients que je vous l'envoie sous 24/48h ?
(+ avec le fichier excel)
merci,
- Anne-Charlotte
anne-charlotte@alti-web.fr"""
# =============================================
# PLATEFORMES / ANNUAIRES À IGNORER
# =============================================
PLATEFORMES_DOMAINES = [
    "doctolib.fr", "pagesjaunes.fr", "yelp.fr", "yelp.com",
    "tripadvisor.fr", "tripadvisor.com", "facebook.com", "instagram.com",
    "linkedin.com", "twitter.com", "x.com", "tiktok.com",
    "leboncoin.fr", "indeed.fr", "indeed.com", "glassdoor.fr",
    "pinterest.com", "pinterest.fr", "booking.com", "airbnb.fr",
    "airbnb.com", "therapie.com", "resalib.fr", "crenolibre.fr",
    "mondocteur.fr", "kelformation.com", "superprof.fr",
    "starofservice.com", "wecasa.fr", "treatwell.fr",
    "planity.com", "kiute.com", "balinea.com", "unyque.fr",
    "genially.com", "canva.com", "medium.com", "blogspot.com",
    "wordpress.com", "wixsite.com", "jimdo.com", "weebly.com",
    "shopify.com", "etsy.com", "amazon.fr", "amazon.com",
    "groupon.fr", "groupon.com", "mapquest.com", "mappy.com",
    "qwant.com", "bing.com", "yahoo.com", "wikipedia.org",
    "journaldesfemmes.fr", "doctissimo.fr", "aufeminin.com",
    "marmiton.org", "commentcamarche.net", "linternaute.com",
    "toutpratique.com", "passeportsante.net", "santemedecine.fr",
    "annuaire.com", "118712.fr", "horaires.lefigaro.fr",
    "local.fr", "cylex.fr", "infobel.com", "europages.fr",
    "societe.com", "verif.com", "infogreffe.fr", "manageo.fr",
    "score3.fr", "pappers.fr", "maps.google.com", "maps.apple.com",
    "trustpilot.com", "avis-verifies.com", "google.com", "google.fr",
]
PLATEFORMES_PATTERNS = [
    r"annuaire", r"directory", r"listing", r"avis-client",
    r"top-\d+", r"meilleur", r"classement", r"comparateur",
    r"comparatif",
]
def est_plateforme_par_domaine(url):
    """Vérifie si l'URL appartient à une plateforme/annuaire connue"""
    domaine = get_domaine(url)
    for p in PLATEFORMES_DOMAINES:
        if domaine == p or domaine.endswith("." + p):
            return True
    return False
def est_plateforme_par_url(url):
    """Vérifie si l'URL contient des patterns typiques d'annuaires/plateformes"""
    url_lower = url.lower()
    for pattern in PLATEFORMES_PATTERNS:
        if re.search(pattern, url_lower):
            return True
    return False
def detecter_plateforme_par_contenu(driver):
    """Analyse le contenu de la page pour détecter si c'est une plateforme/annuaire IA"""
    try:
        page_source = driver.page_source.lower()
        url_courante = driver.current_url.lower()
        # Indicateurs forts de plateforme/annuaire
        indicateurs_forts = [
            "prendre rendez-vous en ligne",
            "réserver en ligne",
            "book online",
            "tous les praticiens",
            "voir tous les résultats",
            "filtrer par",
            "résultats pour",
            "annuaire des professionnels",
            "trouvez un professionnel",
            "find a professional",
            "powered by doctolib",
            "powered by planity",
        ]
        # Indicateurs moyens (il en faut plusieurs)
        indicateurs_moyens = [
            "avis vérifiés",
            "note globale",
            "étoiles sur",
            "voir les avis",
            "laisser un avis",
            "verified reviews",
            "profil du praticien",
            "praticiens à proximité",
            "autres professionnels",
            "catégories similaires",
            "sponsored",
            "annonce",
            "publicité",
            "résultats sponsorisés",
        ]
        # Vérification indicateurs forts (1 seul suffit)
        for ind in indicateurs_forts:
            if ind in page_source:
                return True, f"Indicateur fort détecté : '{ind}'"
        # Vérification indicateurs moyens (il en faut 3+)
        score = sum(1 for ind in indicateurs_moyens if ind in page_source)
        if score >= 3:
            return True, f"Score plateforme élevé ({score} indicateurs moyens)"
        # Vérifier si le titre ou les meta contiennent des signes d'annuaire
        try:
            title = driver.title.lower()
            annuaire_mots = ["annuaire", "directory", "listing", "top ", "meilleur", "classement", "comparateur", "avis sur"]
            for mot in annuaire_mots:
                if mot in title:
                    return True, f"Titre de la page contient : '{mot}'"
        except:
            pass
        return False, ""
    except:
        return False, ""
def est_plateforme(driver, url):
    """Détection complète : domaine + URL + contenu de la page"""
    # Check 1 : domaine connu
    if est_plateforme_par_domaine(url):
        print(f"  🚫 PLATEFORME DÉTECTÉE (domaine connu) : {get_domaine(url)} — SKIP")
        return True
    # Check 2 : pattern dans l'URL
    if est_plateforme_par_url(url):
        print(f"  🚫 PLATEFORME DÉTECTÉE (pattern URL) : {url} — SKIP")
        return True
    # Check 3 : analyse du contenu de la page
    est_plat, raison = detecter_plateforme_par_contenu(driver)
    if est_plat:
        print(f"  🚫 PLATEFORME DÉTECTÉE (contenu) : {raison} — SKIP")
        return True
    return False
# =============================================
# MÉMOIRE
# =============================================
def charger_memoire():
    if os.path.exists(MEMORY_FILE):
        with open(MEMORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []
def sauvegarder_memoire(sites):
    with open(MEMORY_FILE, "w", encoding="utf-8") as f:
        json.dump(sites, f, indent=2, ensure_ascii=False)
def get_domaine(url):
    parsed = urlparse(url)
    return parsed.netloc.lower().replace("www.", "")
def deja_traite(url, memoire):
    domaine = get_domaine(url)
    return domaine in [get_domaine(u) for u in memoire]
def marquer_traite(url, memoire):
    memoire.append(url)
    sauvegarder_memoire(memoire)
    print(f"  💾 Site enregistré en mémoire : {get_domaine(url)}")
# =============================================
# RECHERCHE D'EMAIL SUR LE SITE
# =============================================
def extraire_emails_page(driver):
    emails_trouves = set()
    try:
        page_text = driver.page_source
        pattern = r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}'
        emails = re.findall(pattern, page_text)
        for email in emails:
            email = email.lower().strip()
            if not any(ext in email for ext in [".png", ".jpg", ".gif", ".svg", ".webp",
                                                 "wix.com", "example.com", "sentry.io",
                                                 "googleapis.com", "w3.org", "schema.org"]):
                emails_trouves.add(email)
    except:
        pass
    return list(emails_trouves)
def chercher_email_site(driver, url_base):
    print("  🔍 Recherche d'une adresse email sur le site...")
    emails = extraire_emails_page(driver)
    if emails:
        print(f"  📧 Email trouvé sur la page courante : {emails[0]}")
        return emails[0]
    pages_a_tester = []
    try:
        for a in driver.find_elements(By.CSS_SELECTOR, "a"):
            text = (a.text or "").lower()
            href = (a.get_attribute("href") or "").lower()
            if any(mot in text or mot in href for mot in [
                "contact", "mention", "légal", "legal", "cgv", "cgu",
                "condition", "à propos", "a-propos", "about", "qui sommes",
                "nous contacter", "nous écrire", "infos", "informations"
            ]):
                full_href = a.get_attribute("href")
                if full_href and full_href not in pages_a_tester:
                    pages_a_tester.append(full_href)
    except:
        pass
    for page_url in pages_a_tester[:5]:
        try:
            print(f"  🔍 Scan de : {page_url}")
            driver.get(page_url)
            time.sleep(2)
            emails = extraire_emails_page(driver)
            if emails:
                print(f"  📧 Email trouvé : {emails[0]}")
                return emails[0]
        except:
            continue
    print("  ❌ Aucun email trouvé sur le site.")
    return None
def envoyer_message_email(destinataire, url_site):
    print(f"  📤 Envoi du message par email à {destinataire}...")
    msg = MIMEMultipart()
    msg["From"] = f"Anne Charlotte <{SMTP_FROM}>"
    msg["Reply-To"] = SMTP_FROM
    msg["To"] = destinataire
    msg["Subject"] = "Audit SEO gratuit pour votre site"
    msg.attach(MIMEText(MESSAGE, "plain", "utf-8"))
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        print(f"  ✅ Email envoyé à {destinataire}")
        return True
    except Exception as e:
        print(f"  ❌ Erreur envoi email : {e}")
        return False
# =============================================
# ÉTAPE 1 : Demander à Claude une idée de recherche
# =============================================
def demander_recherche_claude():
    print("🤖 Demande à Claude une idée de recherche...")
    response = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01"
        },
        json={
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 200,
            "messages": [
                {
                    "role": "user",
                    "content": """Donne moi "bien etre" et un secteur géographique alatoire en france  .
Réponds UNIQUEMENT avec la requête Google à taper, rien d'autre.
Exemple de format de réponse : plombier Toulouse Le cabinet
Ne mets pas de guillemets, juste les mots."""
                }
            ]
        }
    )
    data = response.json()
    if "content" not in data:
        print(f"❌ Erreur API Claude : {json.dumps(data, indent=2)}")
        sys.exit(1)
    recherche = data["content"][0]["text"].strip().strip('"')
    print(f"🔍 Recherche suggérée par Claude : {recherche}")
    return recherche
# =============================================
# ÉTAPE 2 : Remplir le formulaire
# =============================================
def remplir_formulaire(driver):
    champs = driver.find_elements(By.CSS_SELECTOR, "input, textarea, select")
    champs_remplis = 0
    for champ in champs:
        name = (champ.get_attribute("name") or "").lower()
        placeholder = (champ.get_attribute("placeholder") or "").lower()
        typ = (champ.get_attribute("type") or "").lower()
        tag = champ.tag_name.lower()
        label_text = ""
        if "captcha" in name or "recaptcha" in name:
            continue
        if not champ.is_displayed():
            continue
        if typ in ("hidden", "submit", "button", "checkbox", "radio"):
            continue
        champ_id = champ.get_attribute("id")
        if champ_id:
            try:
                label = driver.find_element(By.CSS_SELECTOR, f"label[for='{champ_id}']")
                label_text = (label.text or "").lower()
            except:
                pass
        identifiant = f"{name} {placeholder} {label_text}"
        try:
            if tag == "textarea":
                champ.clear()
                champ.send_keys(MESSAGE)
                print(f"  ✅ Message rempli (textarea: {name})")
                champs_remplis += 1
            elif any(m in identifiant for m in ["prénom", "prenom", "first"]):
                champ.clear()
                champ.send_keys(PRENOM)
                print(f"  ✅ Prénom rempli ({name})")
                champs_remplis += 1
            elif any(m in identifiant for m in ["nom", "last", "surname"]) and "prenom" not in identifiant and "prénom" not in identifiant:
                champ.clear()
                champ.send_keys(NOM)
                print(f"  ✅ Nom rempli ({name})")
                champs_remplis += 1
            elif any(m in identifiant for m in ["email", "mail", "courriel"]):
                champ.clear()
                champ.send_keys(EMAIL)
                print(f"  ✅ Email rempli ({name})")
                champs_remplis += 1
            elif any(m in identifiant for m in ["tel", "phone", "téléphone", "telephone", "mobile"]):
                champ.clear()
                champ.send_keys(TELEPHONE)
                print(f"  ✅ Téléphone rempli ({name})")
                champs_remplis += 1
            elif any(m in identifiant for m in ["message", "commentaire", "demande", "description"]):
                champ.clear()
                champ.send_keys(MESSAGE)
                print(f"  ✅ Message rempli ({name})")
                champs_remplis += 1
            else:
                if typ in ("text", "") and not champ.get_attribute("value"):
                    print(f"  ⚠️ Champ non reconnu ignoré : name={name}, placeholder={placeholder}")
        except Exception as e:
            print(f"  ❌ Erreur sur {name}: {e}")
    return champs_remplis > 0
# =============================================
# MAIN
# =============================================
memoire = charger_memoire()
print(f"Sites déjà traités : {len(memoire)}\n")
recherche = demander_recherche_claude()
options = Options()
options.add_argument("--headless=new")
options.add_argument("--disable-blink-features=AutomationControlled")
options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
driver = webdriver.Chrome(options=options)
try:
    query = quote_plus(recherche)
    driver.get(f"https://www.google.fr/search?q={query}&num=20")
    time.sleep(5)
    try:
        btn = driver.find_element(By.XPATH, "//button[contains(., 'Tout accepter')]")
        btn.click()
        time.sleep(2)
    except:
        pass
    # Récupérer les liens bruts (pré-filtrage domaine/URL uniquement)
    liens_bruts = []
    NB_SITES_CIBLE = 20
    nb_recherches = 0
    max_recherches = 5
    while len(liens_bruts) < NB_SITES_CIBLE * 2 and nb_recherches < max_recherches:
        if nb_recherches > 0:
            print(f"\n🔄 Recherche supplémentaire ({nb_recherches + 1}/{max_recherches})...")
            recherche = demander_recherche_claude()
            query = quote_plus(recherche)
            driver.get(f"https://www.google.fr/search?q={query}&num=20")
            time.sleep(5)
            try:
                btn = driver.find_element(By.XPATH, "//button[contains(., 'Tout accepter')]")
                btn.click()
                time.sleep(2)
            except:
                pass
        for el in driver.find_elements(By.CSS_SELECTOR, "a"):
            href = el.get_attribute("href") or ""
            if href.startswith("http") and "google" not in href and "youtube" not in href:
                if href not in liens_bruts and not deja_traite(href, memoire):
                    # Pré-filtrage rapide par domaine (sans charger la page)
                    if est_plateforme_par_domaine(href):
                        print(f"  🚫 PLATEFORME (domaine) : {get_domaine(href)} — SKIP")
                        continue
                    if est_plateforme_par_url(href):
                        print(f"  🚫 PLATEFORME (URL pattern) : {href} — SKIP")
                        continue
                    liens_bruts.append(href)
        nb_recherches += 1
    print(f"\nLiens candidats après pré-filtrage : {len(liens_bruts)}")
    # Rapport de suivi
    rapport = []
    sites_traites_count = 0
    sites_plateforme_count = 0
    for i, url in enumerate(liens_bruts, 1):
        if sites_traites_count >= NB_SITES_CIBLE:
            print(f"\n✅ Objectif atteint : {NB_SITES_CIBLE} vrais sites traités !")
            break
        print(f"\n{'='*60}")
        print(f"[{sites_traites_count + 1}/{NB_SITES_CIBLE}] (lien {i}/{len(liens_bruts)}) Visite de : {url}")
        print(f"{'='*60}")
        driver.get(url)
        time.sleep(3)
        # Détection plateforme par contenu (après chargement de la page)
        est_plat, raison = detecter_plateforme_par_contenu(driver)
        if est_plat:
            print(f"  🚫 PLATEFORME DÉTECTÉE (contenu) : {raison} — SKIP")
            sites_plateforme_count += 1
            rapport.append({"url": url, "statut": f"🚫 Plateforme ignorée ({raison})"})
            continue
        sites_traites_count += 1
        # Chercher la page contact
        contact_url = None
        for a in driver.find_elements(By.CSS_SELECTOR, "a"):
            text = (a.text or "").lower()
            href = (a.get_attribute("href") or "").lower()
            if any(mot in text for mot in ["contact", "formulaire", "nous contacter", "nous écrire"]) or \
               any(mot in href for mot in ["contact", "formulaire"]):
                contact_url = a.get_attribute("href")
                break
        if contact_url:
            print(f"  Page contact : {contact_url}")
            driver.get(contact_url)
            time.sleep(3)
            forms = driver.find_elements(By.CSS_SELECTOR, "form")
            if forms:
                print("  Formulaire détecté — remplissage en cours...")
                success = remplir_formulaire(driver)
                if success:
                    formulaire_soumis = False
                    try:
                        submit = None
                        try:
                            submit = driver.find_element(By.CSS_SELECTOR, "button[type='submit'], input[type='submit']")
                        except:
                            pass
                        if not submit:
                            for btn in driver.find_elements(By.CSS_SELECTOR, "button, a[role='button'], [class*='submit'], [data-testid*='submit']"):
                                btn_text = (btn.text or "").strip().lower()
                                if any(mot in btn_text for mot in ["envoyer", "soumettre", "submit", "send", "valider", "confirmer"]):
                                    submit = btn
                                    break
                        if not submit:
                            try:
                                submit = forms[0].find_element(By.CSS_SELECTOR, "button")
                            except:
                                pass
                        if submit:
                            submit.click()
                            print("  🚀 Formulaire soumis !")
                            time.sleep(3)
                            formulaire_soumis = True
                            marquer_traite(url, memoire)
                            rapport.append({"url": url, "statut": "✅ Formulaire soumis"})
                        else:
                            print("  ❌ Bouton submit non trouvé")
                    except Exception as e:
                        print(f"  ❌ Erreur soumission : {e}")
                    if not formulaire_soumis:
                        print("  🔄 Fallback : recherche d'un email sur le site...")
                        driver.get(url)
                        time.sleep(3)
                        email_trouve = chercher_email_site(driver, url)
                        if email_trouve:
                            if envoyer_message_email(email_trouve, url):
                                marquer_traite(url, memoire)
                                rapport.append({"url": url, "statut": f"✅ Email envoyé à {email_trouve} (formulaire non soumis)"})
                            else:
                                rapport.append({"url": url, "statut": f"⚠️ Email trouvé ({email_trouve}) mais envoi échoué"})
                        else:
                            rapport.append({"url": url, "statut": "❌ Formulaire non soumis et aucun email trouvé"})
                else:
                    print("  🔄 Remplissage échoué, recherche d'un email sur le site...")
                    driver.get(url)
                    time.sleep(3)
                    email_trouve = chercher_email_site(driver, url)
                    if email_trouve:
                        if envoyer_message_email(email_trouve, url):
                            marquer_traite(url, memoire)
                            rapport.append({"url": url, "statut": f"✅ Email envoyé à {email_trouve} (remplissage formulaire échoué)"})
                        else:
                            rapport.append({"url": url, "statut": f"⚠️ Email trouvé ({email_trouve}) mais envoi échoué"})
                    else:
                        rapport.append({"url": url, "statut": "❌ Remplissage formulaire échoué et aucun email trouvé"})
            else:
                print("  Aucun formulaire détecté — recherche d'un email...")
                email_trouve = chercher_email_site(driver, url)
                if email_trouve:
                    if envoyer_message_email(email_trouve, url):
                        marquer_traite(url, memoire)
                        rapport.append({"url": url, "statut": f"✅ Email envoyé à {email_trouve} (pas de formulaire)"})
                    else:
                        rapport.append({"url": url, "statut": f"⚠️ Email trouvé ({email_trouve}) mais envoi échoué"})
                else:
                    rapport.append({"url": url, "statut": "❌ Pas de formulaire ni d'email trouvé"})
        else:
            print("  Aucune page contact trouvée — recherche d'un email...")
            email_trouve = chercher_email_site(driver, url)
            if email_trouve:
                if envoyer_message_email(email_trouve, url):
                    marquer_traite(url, memoire)
                    rapport.append({"url": url, "statut": f"✅ Email envoyé à {email_trouve} (pas de page contact)"})
                else:
                    rapport.append({"url": url, "statut": f"⚠️ Email trouvé ({email_trouve}) mais envoi échoué"})
            else:
                rapport.append({"url": url, "statut": "❌ Pas de page contact ni d'email trouvé"})
finally:
    driver.quit()
# =============================================
# ÉTAPE 3 : Envoi du rapport par email
# =============================================
def envoyer_rapport(rapport, recherche):
    now = datetime.now().strftime("%d/%m/%Y %H:%M")

    body = f"""Rapport de prospection automatique — {now}
Recherche : {recherche}
Sites analysés : {len([r for r in rapport if '🚫' not in r['statut']])}
Plateformes ignorées : {len([r for r in rapport if '🚫' in r['statut']])}
{'='*60}
DÉTAIL PAR SITE :
{'='*60}
"""
    nb_ok = 0
    for i, r in enumerate(rapport, 1):
        body += f"{i}. {r['url']}\n   → {r['statut']}\n\n"
        if "✅" in r["statut"]:
            nb_ok += 1
    body += f"""{'='*60}
RÉSUMÉ :
  - Vrais sites visités : {len([r for r in rapport if '🚫' not in r['statut']])}
  - Plateformes ignorées : {len([r for r in rapport if '🚫' in r['statut']])}
  - Actions réussies (formulaire ou email) : {nb_ok}
  - Total sites en mémoire : {len(memoire)}
{'='*60}
"""
    msg = MIMEMultipart()
    msg["From"] = f"Anne Charlotte <{SMTP_FROM}>"
    msg["To"] = RAPPORT_EMAIL
    msg["Subject"] = f"[Alti-Web] Rapport prospection — {now}"
    msg.attach(MIMEText(body, "plain", "utf-8"))
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        print(f"\n📧 Rapport envoyé à {RAPPORT_EMAIL}")
    except Exception as e:
        print(f"\n❌ Erreur envoi email : {e}")
        rapport_file = f"rapport_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        with open(rapport_file, "w", encoding="utf-8") as f:
            f.write(body)
        print(f"📄 Rapport sauvegardé localement : {rapport_file}")
        print("\n📋 Rapport affiché ci-dessous :\n")
        print(body)
envoyer_rapport(rapport, recherche)
print(f"\n{'='*60}")
print(f"Terminé ! {sites_traites_count} vrais sites traités, {sites_plateforme_count} plateformes ignorées")
print(f"Total sites en mémoire : {len(memoire)}")
print(f"{'='*60}")
