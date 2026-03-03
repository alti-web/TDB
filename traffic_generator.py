#!/usr/bin/env python3
"""
Générateur de trafic web - Simule des visites humaines via BrightData Browser API.
"""

import argparse
import os
import random
import time
import sys
from urllib.parse import urlparse, urljoin

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.action_chains import ActionChains
from fake_useragent import UserAgent


def load_env():
    """Charge les variables depuis .env si le fichier existe."""
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


load_env()

# --- Configuration par défaut ---
MIN_DELAY = 15   # secondes min entre chaque page
MAX_DELAY = 45   # secondes max entre chaque page
PAUSE_BETWEEN_VISITS_MIN = 30
PAUSE_BETWEEN_VISITS_MAX = 90
PAGES_PER_VISIT_MIN = 2
PAGES_PER_VISIT_MAX = 4

# Résolutions d'écran courantes
SCREEN_RESOLUTIONS = [
    (1920, 1080), (1366, 768), (1536, 864),
    (1440, 900), (1280, 720), (1600, 900),
]


def log(msg, level="INFO"):
    timestamp = time.strftime("%H:%M:%S")
    print(f"[{timestamp}] [{level}] {msg}")


def human_delay(min_s=None, max_s=None):
    """Pause aléatoire pour simuler un comportement humain."""
    if min_s is None:
        min_s = MIN_DELAY
    if max_s is None:
        max_s = MAX_DELAY
    delay = random.uniform(min_s, max_s)
    log(f"  Pause {delay:.1f}s...")
    time.sleep(delay)


def smooth_scroll(driver):
    """Scroll progressif comme un humain qui lit la page."""
    total_height = driver.execute_script("return document.body.scrollHeight")
    viewport_height = driver.execute_script("return window.innerHeight")
    current = 0

    while current < total_height:
        scroll_step = random.randint(100, 350)
        current += scroll_step
        driver.execute_script(f"window.scrollTo(0, {current});")
        time.sleep(random.uniform(0.3, 1.2))

        # Parfois on s'arrête plus longtemps (lecture)
        if random.random() < 0.2:
            time.sleep(random.uniform(1.5, 4.0))

    # Remonter un peu parfois
    if random.random() < 0.4:
        scroll_back = random.randint(100, 400)
        driver.execute_script(f"window.scrollBy(0, -{scroll_back});")
        time.sleep(random.uniform(0.5, 1.5))


def random_mouse_movement(driver):
    """Mouvements de souris aléatoires sur la page."""
    try:
        body = driver.find_element(By.TAG_NAME, "body")
        actions = ActionChains(driver)
        for _ in range(random.randint(2, 5)):
            x_offset = random.randint(-200, 200)
            y_offset = random.randint(-200, 200)
            actions.move_to_element_with_offset(body, x_offset, y_offset)
            actions.pause(random.uniform(0.1, 0.5))
        actions.perform()
    except Exception:
        pass  # pas critique


def get_internal_links(driver, base_domain):
    """Récupère les liens internes (même domaine) de la page courante."""
    links = []
    try:
        elements = driver.find_elements(By.TAG_NAME, "a")
        for el in elements:
            href = el.get_attribute("href")
            if not href:
                continue
            parsed = urlparse(href)
            # Lien interne : même domaine ou relatif
            if parsed.netloc == "" or parsed.netloc == base_domain:
                full_url = urljoin(driver.current_url, href)
                # Ignorer les ancres, mailto, tel, javascript
                if any(full_url.startswith(p) for p in ["mailto:", "tel:", "javascript:"]):
                    continue
                if "#" in full_url:
                    full_url = full_url.split("#")[0]
                if full_url not in links:
                    links.append(full_url)
    except Exception as e:
        log(f"  Erreur collecte liens: {e}", "WARN")
    return links


def create_driver(sbr_endpoint):
    """Crée une instance Selenium connectée à BrightData Browser API."""
    log("Connexion à BrightData Browser API...")

    options = Options()

    # Résolution aléatoire
    width, height = random.choice(SCREEN_RESOLUTIONS)
    options.add_argument(f"--window-size={width},{height}")

    # User-Agent aléatoire
    try:
        ua = UserAgent()
        user_agent = ua.chrome
    except Exception:
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    options.add_argument(f"--user-agent={user_agent}")

    log(f"  Résolution: {width}x{height}")
    log(f"  User-Agent: {user_agent[:60]}...")

    # Connexion au Remote WebDriver de BrightData
    driver = webdriver.Remote(
        command_executor=sbr_endpoint,
        options=options
    )

    driver.set_page_load_timeout(60)
    return driver


def run_visit(visit_num, total_visits, target_url, sbr_endpoint, min_delay=MIN_DELAY, max_delay=MAX_DELAY):
    """Exécute une visite complète : page d'accueil + 2-3 pages internes."""
    log(f"=== Visite {visit_num}/{total_visits} ===")

    base_domain = urlparse(target_url).netloc
    driver = None

    try:
        driver = create_driver(sbr_endpoint)

        # 1. Visite de la page cible
        log(f"  -> {target_url}")
        driver.get(target_url)
        time.sleep(random.uniform(2, 4))  # attente chargement

        # Comportement humain sur la page
        smooth_scroll(driver)
        random_mouse_movement(driver)
        human_delay(min_delay, max_delay)

        # 2. Collecter les liens internes
        internal_links = get_internal_links(driver, base_domain)
        log(f"  {len(internal_links)} liens internes trouvés")

        if not internal_links:
            log("  Aucun lien interne, fin de la visite", "WARN")
            return

        # 3. Visiter 2-3 pages internes aléatoires
        nb_pages = random.randint(PAGES_PER_VISIT_MIN, PAGES_PER_VISIT_MAX)
        nb_pages = min(nb_pages, len(internal_links))
        pages_to_visit = random.sample(internal_links, nb_pages)

        for i, page_url in enumerate(pages_to_visit, 1):
            log(f"  Page {i}/{nb_pages}: {page_url[:80]}...")
            try:
                driver.get(page_url)
                time.sleep(random.uniform(2, 4))

                smooth_scroll(driver)
                random_mouse_movement(driver)

                if i < nb_pages:
                    human_delay(min_delay, max_delay)
            except Exception as e:
                log(f"  Erreur navigation: {e}", "WARN")
                continue

        log(f"  Visite {visit_num} terminée")

    except Exception as e:
        log(f"  Erreur visite {visit_num}: {e}", "ERROR")
    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass


def main():
    parser = argparse.ArgumentParser(
        description="Générateur de trafic web via BrightData Browser API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples:
  python traffic_generator.py --url https://example.com
  python traffic_generator.py --url https://example.com --visits 10
  python traffic_generator.py --url https://example.com --min-delay 20 --max-delay 60

L'endpoint BrightData est lu depuis .env (SBR_ENDPOINT) ou via --sbr.
        """
    )
    parser.add_argument("--url", required=True, help="URL cible à visiter")
    parser.add_argument("--sbr", default=os.environ.get("SBR_ENDPOINT", ""), help="Endpoint BrightData Browser API (ou variable SBR_ENDPOINT dans .env)")
    parser.add_argument("--visits", type=int, default=5, help="Nombre de visites (défaut: 5)")
    parser.add_argument("--min-delay", type=int, default=MIN_DELAY, help=f"Délai min entre pages en secondes (défaut: {MIN_DELAY})")
    parser.add_argument("--max-delay", type=int, default=MAX_DELAY, help=f"Délai max entre pages en secondes (défaut: {MAX_DELAY})")

    args = parser.parse_args()

    # Valider l'URL
    parsed = urlparse(args.url)
    if not parsed.scheme or not parsed.netloc:
        print("Erreur: URL invalide. Utilisez le format https://example.com")
        sys.exit(1)

    if not args.sbr:
        print("Erreur: endpoint BrightData requis. Utilisez --sbr ou définissez SBR_ENDPOINT dans .env")
        sys.exit(1)

    min_delay = args.min_delay
    max_delay = args.max_delay

    log(f"Cible: {args.url}")
    log(f"Visites: {args.visits}")
    log(f"Délai entre pages: {min_delay}-{max_delay}s")
    log(f"BrightData endpoint: {args.sbr[:40]}...")
    print("-" * 50)

    for i in range(1, args.visits + 1):
        run_visit(i, args.visits, args.url, args.sbr, min_delay, max_delay)

        # Pause entre les visites (sauf la dernière)
        if i < args.visits:
            pause = random.uniform(PAUSE_BETWEEN_VISITS_MIN, PAUSE_BETWEEN_VISITS_MAX)
            log(f"Pause entre visites: {pause:.0f}s...")
            time.sleep(pause)

    print("-" * 50)
    log(f"Terminé : {args.visits} visites effectuées.")


if __name__ == "__main__":
    main()
