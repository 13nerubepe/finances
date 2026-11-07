"""Outils de l'agent : chaque outil lit nos données (pics, indicateurs, explications) à partir d'un ticker."""

from datetime import date, datetime, timedelta, timezone

from langchain_core.tools import tool

from marches.models import Actif, CoursHistorique, IndicateurJournalier

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
        f"variation : {_pourcent(ligne.rendement)} %, volatilité annualisée : {volatilite} %, "
        f"z-score : {_valeur(ligne.z)}, volume anormal (z) : {_valeur(ligne.z_volume)}, "
        f"gap d'ouverture : {_pourcent(ligne.gap)} %, bêta : {_valeur(ligne.beta)}, pic : {pic}."
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


@tool
def cours_autour_d_une_heure(symbole: str, moment: str, heures: int = 6) -> str:
    """Donne les bougies horaires d'un actif autour d'un moment précis, pour expliquer un mouvement
    à une heure donnée (clic sur le graphique). moment au format AAAA-MM-JJTHH:MM (UTC) ;
    heures = nombre d'heures avant et après ce moment (1 à 24, 6 par défaut)."""
    actif = _actif(symbole)
    if actif is None:
        return f"Actif inconnu : {symbole}."
    try:
        instant = datetime.fromisoformat(moment.strip().replace("Z", "+00:00"))
    except ValueError:
        return "Moment attendu au format AAAA-MM-JJTHH:MM."
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=timezone.utc)
    marge = timedelta(hours=max(1, min(int(heures), 24)))

    bougies = list(
        CoursHistorique.objects.filter(
            actif=actif, horodatage__range=(instant - marge, instant + marge)
        ).order_by("horodatage")
    )
    if not bougies:
        return f"Aucun cours horaire pour {actif.symbole} autour du {instant:%d/%m/%Y %H:%M} UTC."

    lignes = [f"Bougies horaires de {actif.nom} ({actif.symbole}) autour du {instant:%d/%m/%Y %H:%M} UTC :"]
    precedent = None
    for b in bougies:
        variation = "n/d" if not precedent else f"{round((b.close - precedent) / precedent * 100, 2)} %"
        repere = "  <- moment demandé" if abs(b.horodatage - instant) < timedelta(minutes=30) else ""
        lignes.append(
            f"- {b.horodatage:%d/%m %H:%M} : ouverture {_valeur(b.open)}, haut {_valeur(b.high)}, "
            f"bas {_valeur(b.low)}, clôture {_valeur(b.close)}, variation {variation}, volume {b.volume}{repere}"
        )
        precedent = b.close
    debut, fin = bougies[0].open, bougies[-1].close
    if debut:
        lignes.append(f"Variation sur la fenêtre : {round((fin - debut) / debut * 100, 2)} %.")
    return "\n".join(lignes)


OUTILS = [lister_pics, indicateurs_du_jour, expliquer_un_pic, cours_autour_d_une_heure]
