import math

import pandas as pd
import yfinance as yf
from django.utils import timezone

from .models import CoursHistorique

INTERVALLE = "5m"
JOURS_MAX = 59  # Yahoo ne conserve qu'environ 60 jours de données à 5 minutes
JOURS_INITIAL = 5  # fenêtre quand l'actif n'a encore aucun cours (couvre un week-end)
COLONNES = ["open", "high", "low", "close", "volume"]


def normaliser_bougies(df):
    """Met le tableau renvoyé par yfinance dans un format propre :
    colonnes en minuscules, index en UTC, lignes incompletes supprimees, sans doublons"""
    if df is None or df.empty:
        return pd.DataFrame(columns=COLONNES)

    df = df.rename(columns=str.lower)[COLONNES].copy()

    if df.index.tz is None:
        df.index = df.index.tz_localize("UTC")
    else:
        df.index = df.index.tz_convert("UTC")

    df = df.dropna(subset=["open", "high", "low", "close"])
    df["volume"] = df["volume"].fillna(0)
    return df[~df.index.duplicated(keep="last")]


def recuperer_bougies(symbole, jours):
    df = yf.Ticker(symbole).history(
        period=f"{jours}d", interval=INTERVALLE, auto_adjust=False, actions=False
    )
    return normaliser_bougies(df)


def calculer_fenetre_jours(actif, jours=None):
    if jours is not None:
        return min(max(jours, 1), JOURS_MAX)

    dernier = actif.cours.order_by("-horodatage").values_list("horodatage", flat=True).first()
    if dernier is None:
        return JOURS_INITIAL

    ecart_jours = (timezone.now() - dernier).total_seconds() / 86400
    return min(max(math.ceil(ecart_jours) + 1, 1), JOURS_MAX)


def ingerer_actif(actif, jours=None):
    fenetre = calculer_fenetre_jours(actif, jours)
    df = recuperer_bougies(actif.symbole, fenetre)
    if df.empty:
        return 0, 0

    objets = [
        CoursHistorique(
            actif=actif,
            horodatage=horodatage.to_pydatetime(),
            open=float(ligne["open"]),
            high=float(ligne["high"]),
            low=float(ligne["low"]),
            close=float(ligne["close"]),
            volume=int(ligne["volume"]),
        )
        for horodatage, ligne in df.iterrows()
    ]

    avant = actif.cours.count()
    CoursHistorique.objects.bulk_create(objets, ignore_conflicts=True, batch_size=500)
    return len(objets), actif.cours.count() - avant