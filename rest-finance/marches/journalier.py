"""Données journalières d'un actif : import Yahoo Finance puis calcul des indicateurs et des pics.
Utilisé par les commandes importer_cours et calculer_indicateurs, le planificateur
et l'ajout d'un actif dans un portefeuille."""

import pandas as pd
import yfinance as yf
from django.conf import settings

from .indicateurs_journaliers import calculer_indicateurs
from .models import Actif, CoursJournalier, IndicateurJournalier

COLONNES = [
    "rendement", "volatilite", "volatilite_annuelle", "parkinson", "z",
    "z_volume", "gap", "beta", "rendement_anormal", "z_anormal",
]


def nombre(valeur):
    """NaN (valeur manquante pour pandas) -> None (NULL en base)."""
    if pd.isna(valeur):
        return None
    return float(valeur)


def importer_cours(actif, periode="1y"):
    """Télécharge les cours journaliers de l'actif et les enregistre sans doublon.
    Renvoie le nombre de jours reçus (0 si Yahoo ne renvoie rien)."""
    df = yf.Ticker(actif.symbole).history(period=periode, interval="1d", auto_adjust=True)
    df = df.dropna(subset=["Close"])
    cours = [
        CoursJournalier(
            actif=actif,
            date=jour.date(),
            open=ligne["Open"],
            high=ligne["High"],
            low=ligne["Low"],
            close=ligne["Close"],
            volume=int(ligne["Volume"] or 0),
        )
        for jour, ligne in df.iterrows()
    ]
    CoursJournalier.objects.bulk_create(
        cours,
        update_conflicts=True,
        unique_fields=["actif", "date"],
        update_fields=["open", "high", "low", "close", "volume"],
    )
    return len(cours)


def charger_cours(actif):
    lignes = list(actif.cours_journaliers.values("date", "open", "high", "low", "close", "volume"))
    if not lignes:
        return None
    return pd.DataFrame(lignes).set_index("date")


def calculer(actif):
    """Calcule et enregistre les indicateurs de l'actif. Renvoie (nombre de jours, nombre de pics)."""
    cours = charger_cours(actif)
    if cours is None:
        return 0, 0

    rendement_indice = None
    if actif.indice_reference:
        cours_indice = charger_cours(actif.indice_reference)
        if cours_indice is not None:
            rendement_indice = calculer_indicateurs(cours_indice)["rendement"]

    jours_par_an = 365 if actif.type_actif == Actif.TypeActif.CRYPTO else 252
    resultats = calculer_indicateurs(cours, rendement_indice, settings.SEUIL_PIC, jours_par_an)

    objets = []
    for jour, ligne in resultats.iterrows():
        if isinstance(ligne["type_pic"], str):
            type_pic = ligne["type_pic"]
        else:
            type_pic = ""

        objet = IndicateurJournalier(
            actif=actif,
            date=jour,
            rendement=nombre(ligne["rendement"]),
            volatilite=nombre(ligne["volatilite"]),
            volatilite_annuelle=nombre(ligne["volatilite_annuelle"]),
            parkinson=nombre(ligne["parkinson"]),
            z=nombre(ligne["z"]),
            z_volume=nombre(ligne["z_volume"]),
            gap=nombre(ligne["gap"]),
            beta=nombre(ligne["beta"]),
            rendement_anormal=nombre(ligne["rendement_anormal"]),
            z_anormal=nombre(ligne["z_anormal"]),
            est_pic=bool(ligne["est_pic"]),
            type_pic=type_pic,
        )
        objets.append(objet)

    IndicateurJournalier.objects.bulk_create(
        objets,
        update_conflicts=True,
        unique_fields=["actif", "date"],
        update_fields=COLONNES + ["est_pic", "type_pic"],
    )

    nbr_pics = 0
    for objet in objets:
        if objet.est_pic:
            nbr_pics = nbr_pics + 1
    return len(objets), nbr_pics


def preparer(actif, periode="1y"):
    """Rend un actif exploitable par l'agent : indice de référence, cours journaliers, indicateurs.
    Renvoie (nombre de jours, nombre de pics)."""
    if actif.type_actif == Actif.TypeActif.ACTION and actif.indice_reference is None:
        actif.indice_reference = Actif.objects.filter(symbole="^GSPC").first()
        actif.save(update_fields=["indice_reference"])

    indice = actif.indice_reference
    if indice and not indice.cours_journaliers.exists():
        importer_cours(indice, periode)
        calculer(indice)

    importer_cours(actif, periode)
    return calculer(actif)
