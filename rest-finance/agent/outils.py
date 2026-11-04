"""Outils de l'agent : chaque outil lit nos données (pics, indicateurs, explications) à partir d'un ticker."""

from datetime import date, timedelta

from langchain_core.tools import tool

from marches.models import Actif, IndicateurJournalier

from .services import expliquer_pic, pourcentage


def _actif(symbole):
    return Actif.objects.filter(symbole__iexact=symbole.strip()).first()


def _valeur(nombre, chiffres=2):
    return "n/d" if nombre is None else round(nombre, chiffres)


def _pourcent(log_rendement):
    return "n/d" if log_rendement is None else pourcentage(log_rendement)


@tool
def lister_pics(symbole: str, debut: str = "", fin: str = "") -> str:
    """Liste les pics de volatilité d'un actif (ticker, ex. AAPL, NVDA, BTC-USD, ^GSPC).
    debut et fin au format AAAA-MM-JJ, facultatifs : par défaut les 12 derniers mois."""
    actif = _actif(symbole)
    if actif is None:
        return f"Actif inconnu : {symbole}."
    try:
        fin = date.fromisoformat(fin) if fin else date.today()
        debut = date.fromisoformat(debut) if debut else fin - timedelta(days=365)
    except ValueError:
        return "Dates attendues au format AAAA-MM-JJ."

    pics = IndicateurJournalier.objects.filter(
        actif=actif, est_pic=True, date__range=(debut, fin)
    ).order_by("date")
    if not pics:
        return f"Aucun pic pour {actif.symbole} entre le {debut} et le {fin}."

    lignes = [f"Pics de {actif.nom} ({actif.symbole}) :"]
    for pic in pics:
        ligne = f"- {pic.date} : variation {_pourcent(pic.rendement)} %, z = {_valeur(pic.z)}"
        if pic.type_pic:
            ligne += f", pic {pic.type_pic}"
        lignes.append(ligne)
    return "\n".join(lignes)


@tool
def indicateurs_du_jour(symbole: str, jour: str) -> str:
    """Donne tous les indicateurs d'un actif pour un jour précis (AAAA-MM-JJ) : variation,
    volatilité annualisée, z-score, volume anormal, gap d'ouverture, bêta et type de pic."""
    actif = _actif(symbole)
    if actif is None:
        return f"Actif inconnu : {symbole}."
    try:
        jour = date.fromisoformat(jour)
    except ValueError:
        return "Date attendue au format AAAA-MM-JJ."

    ligne = IndicateurJournalier.objects.filter(actif=actif, date=jour).first()
    if ligne is None:
        return f"Pas de cotation pour {actif.symbole} le {jour} (week-end, jour férié, pas calculé ou hors historique)."

    volatilite = "n/d" if ligne.volatilite_annuelle is None else round(ligne.volatilite_annuelle * 100, 1)
    pic = "non"
    if ligne.est_pic:
        pic = f"oui ({ligne.type_pic})" if ligne.type_pic else "oui"
    return (
        f"{actif.nom} ({actif.symbole}) le {ligne.date} : "
        f"variationm: {_pourcent(ligne.rendement)} %,\n volatilité annualisée: {volatilite} %, "
        f"z-score: {_valeur(ligne.z)}, \nvolume anormal (z): {_valeur(ligne.z_volume)}, "
        f"gap d'ouverture: {_pourcent(ligne.gap)} %, \nbêta: {_valeur(ligne.beta)}, pic : {pic}."
    )


@tool
def expliquer_un_pic(symbole: str, jour: str) -> str:
    """Explique la cause d'un pic de volatilité à partir des actualités, avec les sources.
    À utiliser uniquement pour une date qui est un pic (voir lister_pics)."""
    actif = _actif(symbole)
    if actif is None:
        return f"Actif inconnu : {symbole}."
    try:
        jour = date.fromisoformat(jour)
    except ValueError:
        return "Date attendue au format AAAA-MM-JJ."

    pic = IndicateurJournalier.objects.filter(actif=actif, date=jour, est_pic=True).first()
    if pic is None:
        return f"Le {jour} n'est pas un pic pour {actif.symbole}. Utilise lister_pics pour trouver les dates."

    explication = expliquer_pic(pic)
    sources = "\n".join(f"- {s['titre']} : {s['url']}" for s in explication.sources[:5])
    return f"{explication.texte}\n\nSources :\n{sources}"


OUTILS = [lister_pics, indicateurs_du_jour, expliquer_un_pic]
