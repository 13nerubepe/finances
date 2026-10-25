import numpy as np
import pandas as pd

COLONNES = ["open", "high", "low", "close", "volume"]
FREQUENCES = {"5min": "5min", "15min": "15min", "1h": "1h", "1j": "1D"}
MAX_BOUGIES = 50_000  # garde-fou : au-delà, on demande de réduire la période


def tableau_vide():
    index = pd.DatetimeIndex([], tz="UTC", name="horodatage")
    return pd.DataFrame({c: pd.Series(dtype="float64") for c in COLONNES}, index=index)


def bougies_en_tableau(lignes):
    """lignes : itérable de tuples (horodatage, open, high, low, close, volume)."""
    lignes = list(lignes)
    if not lignes:
        return tableau_vide()
    df = pd.DataFrame.from_records(lignes, columns=["horodatage"] + COLONNES)
    df["horodatage"] = pd.to_datetime(df["horodatage"], utc=True)
    return df.set_index("horodatage").sort_index().astype("float64")


def regrouper(df, frequence):
    """Regroupe les bougies de 5 min dans une fréquence plus large (15min, 1h, 1j)."""
    if frequence == "5min" or df.empty:
        return df
    regroupe = df.resample(FREQUENCES[frequence]).agg(
        {"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}
    )
    return regroupe.dropna(subset=["close"])


def calculer_volatilite(df, fenetre):
    """Rendement, volatilité glissante et amplitude de chaque bougie.

    rendement  = close / close précédent - 1
    volatilité = écart-type des `fenetre` derniers rendements
    amplitude  = (high - low) / low
    """
    resultat = pd.DataFrame(index=df.index)
    resultat["close"] = df["close"]
    resultat["rendement"] = df["close"] / df["close"].shift(1) - 1
    resultat["volatilite"] = resultat["rendement"].rolling(fenetre).std()
    resultat["amplitude"] = ((df["high"] - df["low"]) / df["low"]).replace(
        [np.inf, -np.inf], np.nan
    )
    return resultat


def _nombre(valeur, decimales=8):
    return None if pd.isna(valeur) else round(float(valeur), decimales)


def amplitude_periode(df):
    """(plus haut de la période - plus bas de la période) / plus bas."""
    bas = df["low"].min()
    if pd.isna(bas) or bas == 0:
        return None
    return (df["high"].max() - bas) / bas


def resume_vide():
    return {
        "nb_points": 0,
        "volatilite_derniere": None,
        "volatilite_moyenne": None,
        "amplitude_periode": None,
        "rendement_periode": None,
    }


def resumer(df, resultat):
    vol = resultat["volatilite"].dropna()
    rendement = df["close"].iloc[-1] / df["close"].iloc[0] - 1 if len(df) >= 2 else None
    return {
        "nb_points": int(len(resultat)),
        "volatilite_derniere": _nombre(vol.iloc[-1]) if not vol.empty else None,
        "volatilite_moyenne": _nombre(vol.mean()) if not vol.empty else None,
        "amplitude_periode": _nombre(amplitude_periode(df)),
        "rendement_periode": _nombre(rendement) if rendement is not None else None,
    }


def serie_json(resultat):
    return [
        {
            "horodatage": horodatage.to_pydatetime(),
            "close": _nombre(close),
            "rendement": _nombre(rendement),
            "volatilite": _nombre(volatilite),
            "amplitude": _nombre(amplitude),
        }
        for horodatage, close, rendement, volatilite, amplitude in resultat.itertuples()
    ]


def detecter_pics(resultat, seuil):
    """Repère les périodes où la volatilité glissante dépasse
    moyenne + seuil x écart-type (calculés sur la période demandée).
    Les points consécutifs au-dessus du seuil forment un seul pic."""
    vol = resultat["volatilite"].dropna()
    reponse = {"moyenne": None, "ecart_type": None, "limite": None, "pics": []}
    if len(vol) < 2:
        return reponse

    moyenne, ecart = float(vol.mean()), float(vol.std())
    reponse["moyenne"], reponse["ecart_type"] = _nombre(moyenne), _nombre(ecart)
    if not ecart > 0:  # série plate (ou NaN) : rien d'anormal à signaler
        return reponse

    limite = moyenne + seuil * ecart
    reponse["limite"] = _nombre(limite)

    depasse = vol > limite
    numero_de_serie = (depasse != depasse.shift(fill_value=False)).cumsum()
    close = resultat["close"]
    close_precedent = close.shift(1)

    for _, bloc in vol[depasse].groupby(numero_de_serie[depasse]):
        debut, fin = bloc.index[0], bloc.index[-1]
        reponse["pics"].append(
            {
                "debut": debut.to_pydatetime(),
                "fin": fin.to_pydatetime(),
                "nb_points": int(len(bloc)),
                "horodatage_max": bloc.idxmax().to_pydatetime(),
                "volatilite_max": _nombre(bloc.max()),
                "score_max": _nombre((bloc.max() - moyenne) / ecart, 4),
                "variation_prix": _nombre(close.loc[fin] / close_precedent.loc[debut] - 1),
            }
        )
    return reponse


def calculer_correlations(series_close, min_observations=3):
    """Corrélation de Pearson entre les rendements de chaque paire d'actifs.

    Pour chaque paire, on garde uniquement les horodatages où les DEUX actifs ont un cours,
    puis on calcule les rendements entre ces horodatages communs : les deux rendements
    couvrent alors exactement la même durée (important entre une action et une crypto).

    series_close : dict {symbole: Series des close, index = horodatage}
    Renvoie (correlations, observations), chacun sous forme {symbole: {symbole: valeur}}.
    """
    symboles = list(series_close)
    correlations = {a: {} for a in symboles}
    observations = {a: {} for a in symboles}

    for i, a in enumerate(symboles):
        for b in symboles[i:]:
            if a == b:
                correlations[a][a] = 1.0
                observations[a][a] = max(len(series_close[a]) - 1, 0)
                continue
            commun = pd.concat([series_close[a], series_close[b]], axis=1, join="inner").dropna()
            rendements = (commun / commun.shift(1) - 1).dropna()
            n = len(rendements)
            valeur = np.nan
            if n >= min_observations:
                valeur = rendements.iloc[:, 0].corr(rendements.iloc[:, 1])
            correlations[a][b] = correlations[b][a] = _nombre(valeur, 6)
            observations[a][b] = observations[b][a] = n
    return correlations, observations