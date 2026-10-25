"""Moteur d'indicateurs journaliers : source unique des pics (agent et tableau de bord).


Entrée  : DataFrame indexé par date, colonnes open, high, low, close, volume.
Sortie  : DataFrame indexé par date, colonnes :
    rendement            log-rendement ln(close / close de la veille)
    volatilite           volatilité EWMA journalière (RiskMetrics, lambda = 0,94)
    volatilite_annuelle  volatilite x racine(jours_par_an)
    parkinson            volatilité intrajournalière (high/low) sur 20 jours
    z                    rendement / volatilité de la veille
    z_volume             z-score du log-volume par rapport aux 20 jours précédents
    gap                  ln(open / close de la veille)
    est_pic              |z| > seuil
"""

import numpy as np
import pandas as pd

LAMBDA = .94
FENETRE = 20 # Fenetre minimale a partir de laquelle les indicateurs sont calcules, valeur arbitraire

def calculer_indicateurs(cours, seuil=3.0, jours_par_an=252): #252 car les marches financiers ferment les weekends, parcontre les crypto ce sera 365( si on faisait aussi les indices synthetiques, ce serait aussi 365)
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
    ind["est_pic"] = ind["z"].abs() > seuil # Le z > 3 egal pic, c'est une valeur concensuelle qui veut juste dire que si les cours s'eloigne de 3 fois la valeur moyenne en valeur absolu, pic

    return ind