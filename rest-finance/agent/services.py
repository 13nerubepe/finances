import math

from google import genai
from google.genai import types
from marches.models import IndicateurJournalier

from .models import Explication
from actualites.services.rss_collector import collecter_pour_pic


MODELE = "gemini-2.5-flash"
recherche_google = types.Tool(google_search=types.GoogleSearch())

TYPES_PIC = {
    "specifique": "propre à l'actif : le mouvement du marché ne l'explique pas",
    "systemique": "lié au marché : l'indice de référence a bougé dans le même sens",
}


def pourcentage(log_rendement):
    """Convertit un log-rendement en variation en % (ex. 0.05 -> 5.13)."""
    return round((math.exp(log_rendement) - 1) * 100, 2)

def articles_du_pic(pic):
    """Articles rattachés au pic ; si aucun, on les collecte d'abord sur Google News."""
    if not pic.articles.exists():
        try:
            collecter_pour_pic(pic)
        except OSError:
            pass  # Google News indisponible : Gemini complétera avec sa recherche web
    return pic.articles.select_related("source")[:10]

def construire_prompt(pic, articles):
    actif = pic.actif
    if pic.est_pic:
        lignes = [f"Actif : {actif.nom} ({actif.symbole}), pic de volatilité du {pic.date:%d/%m/%Y}."]
    else:
        lignes = [f"Actif : {actif.nom} ({actif.symbole}), journée du {pic.date:%d/%m/%Y} (mouvement non exceptionnel)."]
    if pic.rendement is not None:
        variation = f"- Variation du jour : {pourcentage(pic.rendement)} %"
        if pic.z is not None:
            variation += f", soit {pic.z:.1f} fois la volatilité habituelle"
        lignes.append(variation + ".")
    if pic.gap is not None:
        lignes.append(f"- Écart à l'ouverture (gap) : {pourcentage(pic.gap)} %.")
    if pic.z_volume is not None:
        lignes.append(f"- Volume anormal (z) : {pic.z_volume:.1f} (0 = volume habituel).")
    if pic.type_pic:
        lignes.append(f"- Type de pic : {TYPES_PIC[pic.type_pic]}.")
    if actif.indice_reference:
        indice = IndicateurJournalier.objects.filter(actif=actif.indice_reference, date=pic.date).first()
        if indice and indice.rendement is not None:
            lignes.append(f"- Indice {actif.indice_reference.symbole} le même jour : {pourcentage(indice.rendement)} %.")

    if articles:
        lignes.append("\nArticles publiés autour de cette date :")
        for article in articles:
            lignes.append(f"- {article.titre} ({article.source.nom}) : {article.lien}")
    else:
        lignes.append("\nAucun article en base pour cette date.")

    lignes.append(
        "\nExplique en français, en 5 phrases maximum, la cause la plus probable de ce mouvement "
        "(si la journée était calme, dis-le et cite ce qui a pu rythmer le marché). "
        "Appuie-toi d'abord sur les articles fournis, complète avec une recherche web sur cette date précise. "
        "N'invente aucun chiffre. Si aucune cause claire n'apparaît, dis-le."
    )
    return "\n".join(lignes)


def extraire_sources(reponse):
    """Liste des pages web utilisées par la recherche Google de Gemini."""
    sources = []
    if not reponse.candidates:
        return sources
    metadonnees = reponse.candidates[0].grounding_metadata
    if metadonnees and metadonnees.grounding_chunks:
        for morceau in metadonnees.grounding_chunks:
            if morceau.web:
                sources.append({"titre": morceau.web.title, "url": morceau.web.uri})
    return sources


def expliquer_pic(pic):
    """Renvoie l'explication du pic : lue en base si elle existe, sinon demandée à Gemini puis enregistrée."""
    deja_faite = Explication.objects.filter(pic=pic).first()
    if deja_faite:
        return deja_faite

    articles = list(articles_du_pic(pic))
    client = genai.Client()
    reponse = client.models.generate_content(
        model=MODELE,
        contents=construire_prompt(pic, articles),
        config=types.GenerateContentConfig(tools=[recherche_google]),
    )
    texte = (reponse.text or "").strip()
    if not texte:  # réponse bloquée ou vide : on n'enregistre rien, l'appel pourra être retenté
        raise RuntimeError(f"Réponse vide de Gemini pour {pic.actif.symbole} le {pic.date}")
    sources = [{"titre": a.titre, "url": a.lien} for a in articles] + extraire_sources(reponse)
    return Explication.objects.create(pic=pic, texte=texte, sources=sources, modele=MODELE)
