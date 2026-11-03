
import math

import pandas as pd
import yfinance as yf

from django.utils import timezone

from marches.models import Actif, CoursHistorique


# Configuration Yahoo Finance
INTERVALLE = "5m"

# Yahoo conserve environ 60 jours de données intrajournalières
JOURS_MAX = 59

# Première récupération : cinq jours
JOURS_INITIAL = 5

COLONNES = ["open", "high", "low", "close", "volume"]


def normaliser_bougies(df):
    """
    Normalise les données reçues de Yahoo Finance :
    - colonnes en minuscules ;
    - gestion des colonnes MultiIndex ;
    - dates en UTC ;
    - suppression des lignes incomplètes ;
    - suppression des doublons.
    """

    if df is None or df.empty:
        return pd.DataFrame(columns=COLONNES)

    df = df.copy()

    # Gestion des colonnes MultiIndex éventuelles
    if isinstance(df.columns, pd.MultiIndex):

        colonnes_trouvees = False

        for niveau in range(df.columns.nlevels):

            noms = [
                str(colonne).lower()
                for colonne in df.columns.get_level_values(niveau)
            ]

            if all(colonne in noms for colonne in COLONNES):
                df.columns = df.columns.get_level_values(niveau)
                colonnes_trouvees = True
                break

        if not colonnes_trouvees:
            raise ValueError(
                "Impossible d'identifier les colonnes OHLCV de Yahoo Finance."
            )

    # Normalisation des noms de colonnes
    df.columns = [str(colonne).lower() for colonne in df.columns]

    colonnes_absentes = [
        colonne for colonne in COLONNES
        if colonne not in df.columns
    ]

    if colonnes_absentes:
        raise ValueError(
            f"Colonnes manquantes dans les données Yahoo : {colonnes_absentes}"
        )

    df = df[COLONNES].copy()

    # Conversion des dates en UTC
    index = pd.DatetimeIndex(df.index)

    if index.tz is None:
        index = index.tz_localize("UTC")
    else:
        index = index.tz_convert("UTC")

    df.index = index

    # Conversion des valeurs numériques
    for colonne in COLONNES:
        df[colonne] = pd.to_numeric(
            df[colonne],
            errors="coerce"
        )

    # Suppression des cours incomplets
    df = df.dropna(
        subset=["open", "high", "low", "close"]
    )

    # Les volumes absents deviennent zéro
    df["volume"] = df["volume"].fillna(0)

    # Suppression des volumes négatifs
    df = df[df["volume"] >= 0]

    # Suppression des dates en double
    df = df[~df.index.duplicated(keep="last")]

    # Tri chronologique
    df = df.sort_index()

    return df


def recuperer_bougies(symbole, jours):
    """
    Télécharge les bougies de 5 minutes depuis Yahoo Finance.
    """

    if not symbole:
        raise ValueError("Le symbole Yahoo Finance est obligatoire.")

    jours = min(max(int(jours), 1), JOURS_MAX)

    try:

        ticker = yf.Ticker(symbole)

        df = ticker.history(
            period=f"{jours}d",
            interval=INTERVALLE,
            auto_adjust=False,
            actions=False,
            raise_errors=True,
        )

        return normaliser_bougies(df)

    except Exception as erreur:

        raise RuntimeError(
            f"Erreur de récupération Yahoo Finance pour {symbole} : {erreur}"
        ) from erreur


def calculer_fenetre_jours(actif, jours=None):
    """
    Détermine la période à télécharger.

    - Si aucun cours n'existe : cinq jours.
    - Sinon : reprend à partir du dernier cours enregistré.
    - Limite : 59 jours.
    """

    if jours is not None:
        return min(max(int(jours), 1), JOURS_MAX)

    dernier = (
        actif.cours
        .order_by("-horodatage")
        .values_list("horodatage", flat=True)
        .first()
    )

    if dernier is None:
        return JOURS_INITIAL

    # Garantir la compatibilité des fuseaux horaires
    if timezone.is_naive(dernier):
        dernier = timezone.make_aware(
            dernier,
            timezone.get_current_timezone()
        )

    ecart_jours = (
        timezone.now() - dernier
    ).total_seconds() / 86400

    return min(
        max(math.ceil(ecart_jours) + 1, 1),
        JOURS_MAX
    )


def ingerer_actif(actif, jours=None):
    """
    Télécharge les cours d'un actif et les enregistre
    dans CoursHistorique sans créer de doublons.

    Retourne :
    - nombre de bougies récupérées ;
    - nombre de nouvelles bougies enregistrées.
    """

    fenetre = calculer_fenetre_jours(actif, jours)

    df = recuperer_bougies(
        actif.symbole,
        fenetre
    )

    if df.empty:
        return 0, 0

    objets = []

    for horodatage, ligne in df.iterrows():

        volume = (
            0
            if pd.isna(ligne["volume"])
            else int(ligne["volume"])
        )

        objets.append(
            CoursHistorique(
                actif=actif,
                horodatage=horodatage.to_pydatetime(),
                open=float(ligne["open"]),
                high=float(ligne["high"]),
                low=float(ligne["low"]),
                close=float(ligne["close"]),
                volume=volume,
            )
        )

    # Nombre de bougies avant insertion
    avant = actif.cours.count()

    # Insertion sans doublons
    CoursHistorique.objects.bulk_create(
        objets,
        ignore_conflicts=True,
        batch_size=500,
    )

    # Nombre de bougies réellement ajoutées
    apres = actif.cours.count()

    nouvelles_bougies = apres - avant

    return len(objets), nouvelles_bougies
