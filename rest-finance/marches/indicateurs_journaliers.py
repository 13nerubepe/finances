"""Moteur d'indicateurs journaliers : source unique des pics (agent et tableau de bord).


Entrée  : cours : DataFrame indexé par date, colonnes open, high, low, close, volume.
          rendement_indice : Series des log-rendements de l'indice de référence
          (même index de dates), ou None si l'actif n'a pas d'indice (cryptos).
Sortie  : DataFrame indexé par date, colonnes :

    beta                 cov(r, r_indice) / var(r_indice) sur 60 jours glissants
    rendement_anormal    rendement - beta de la veille x rendement de l'indice
    z_anormal            rendement_anormal / son écart-type des 20 jours précédents
    type_pic             "specifique", "systemique", ou vide (pas de pic, pas d'indice,
                         ou historique insuffisant)

"""

import numpy as np
import pandas as pd
#BON, humblement, apres relacture des articles financiers, je corrige les commentaires
LAMBDA = .94
FENETRE = 20 # Par mois, 20 jours de marches (sauf crypto et indices synthetiques)
FENETRE_BETA = 60 #Beta sur 3 mois de marches

def calculer_indicateurs(cours, rendement_indice=None, seuil=3.0, jours_par_an=252):
 #252 car les marches financiers ferment les weekends, parcontre les crypto ce sera 365( si on faisait aussi les indices synthetiques, ce serait aussi 365)
    close = cours["close"]
    ind = pd.DataFrame(index=cours.index)
    ind["rendement"] = np.log(close/close.shift(1))
    variance = (ind["rendement"]**2).ewm(alpha=1 - LAMBDA, adjust=False, min_periods=FENETRE).mean()
    ind["volatilite"] = np.sqrt(variance)
    ind["volatilite_annuelle"] = ind["volatilite"] * np.sqrt(jours_par_an)
    parkinson = np.log(cours["high"]/cours["low"])**2 / (4*np.log(2))
    ind["parkinson"] = np.sqrt(parkinson.rolling(FENETRE).mean())
    ind["z"] = ind["rendement"]/ind["volatilite"].shift(1)
    log_volume = np.log(cours["volume"].where(cours["volume"]>0))
    moyenne = log_volume.rolling(FENETRE).mean().shift(1)
    ecart = log_volume.rolling(FENETRE).std().shift(1)
    ind["z_volume"] = (log_volume - moyenne)/ecart
    ind["gap"]=np.log(cours["open"]/close.shift(1))
    ind["est_pic"] = ind["z"].abs() > seuil #  pic : rendement supérieur à `seuil` fois la volatilité de la veille

    ind["beta"] = np.nan
    ind["rendement_anormal"] = np.nan
    ind["z_anormal"] = np.nan
    ind["type_pic"] = None

    if rendement_indice is not None:
        r = ind["rendement"]
        rm = rendement_indice.reindex(ind.index)

        ind["beta"] = r.rolling(FENETRE_BETA).cov(rm) / rm.rolling(FENETRE_BETA).var()
        ind["rendement_anormal"] = r - ind["beta"].shift(1) * rm

        ecart = ind["rendement_anormal"].rolling(FENETRE).std().shift(1)
        ind["z_anormal"] = ind["rendement_anormal"] / ecart

        type_pic = np.select(
            [ind["z_anormal"].abs() > seuil, ind["z_anormal"].notna()],
            ["specifique", "systemique"],
            default=None,
        )
        ind["type_pic"] = pd.Series(type_pic, index=ind.index).where(ind["est_pic"])


    return ind