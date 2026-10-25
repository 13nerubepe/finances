"""Tests des calculs (sans base de données) avec des chiffres vérifiables à la main."""

import numpy as np
import pandas as pd
from django.test import SimpleTestCase

from .indicateurs import (
    amplitude_periode,
    calculer_correlations,
    calculer_volatilite,
    detecter_pics,
    regrouper,
)


def tableau(closes, debut="2026-10-23 10:00"):
    index = pd.date_range(debut, periods=len(closes), freq="5min", tz="UTC")
    closes = pd.Series(closes, index=index, dtype="float64")
    return pd.DataFrame(
        {"open": closes, "high": closes * 1.01, "low": closes * 0.99, "close": closes, "volume": 100.0}
    )


class VolatiliteTests(SimpleTestCase):
    def test_exemple_chiffre(self):
        # 100 -> 102 (+2 %) -> 100,98 (-1 %) -> 104,0094 (+3 %)
        r = calculer_volatilite(tableau([100.0, 102.0, 100.98, 104.0094]), fenetre=3)
        self.assertAlmostEqual(r["rendement"].iloc[1], 0.02, places=9)
        self.assertAlmostEqual(r["rendement"].iloc[2], -0.01, places=9)
        self.assertAlmostEqual(r["rendement"].iloc[3], 0.03, places=9)
        self.assertTrue(r["volatilite"].iloc[:3].isna().all())  # pas assez de rendements
        self.assertAlmostEqual(r["volatilite"].iloc[3], 0.0208167, places=6)

    def test_amplitude_d_une_bougie_et_de_la_periode(self):
        df = tableau([100.0, 100.0])
        df["high"] = [105.0, 110.0]
        df["low"] = [100.0, 98.0]
        r = calculer_volatilite(df, fenetre=2)
        self.assertAlmostEqual(r["amplitude"].iloc[0], 0.05)  # (105-100)/100
        self.assertAlmostEqual(amplitude_periode(df), (110 - 98) / 98)


class RegrouperTests(SimpleTestCase):
    def test_5min_vers_15min(self):
        df = tableau([100.0, 101.0, 102.0, 103.0, 104.0, 105.0])
        df["open"] = [1, 2, 3, 4, 5, 6]
        df["high"] = [10, 30, 20, 40, 60, 50]
        df["low"] = [9, 8, 7, 6, 5, 4]
        groupe = regrouper(df, "15min")
        self.assertEqual(len(groupe), 2)
        premiere = groupe.iloc[0]
        self.assertEqual(
            (premiere.open, premiere.high, premiere.low, premiere.close, premiere.volume),
            (1, 30, 7, 102.0, 300.0),
        )


class PicsTests(SimpleTestCase):
    def test_un_choc_donne_un_seul_pic(self):
        retours = np.array([1e-4 if i % 2 == 0 else -1e-4 for i in range(200)])
        retours[150] = 0.05  # choc de +5 %
        closes = 100 * np.cumprod(1 + retours)
        resultat = calculer_volatilite(tableau(closes), fenetre=10)
        reponse = detecter_pics(resultat, seuil=2.0)
        self.assertEqual(len(reponse["pics"]), 1)
        pic = reponse["pics"][0]
        # le choc reste dans la fenêtre pendant 10 bougies : la volatilité reste élevée 10 points
        self.assertEqual(pic["nb_points"], 10)
        self.assertAlmostEqual(pic["variation_prix"], 0.05, delta=0.005)
        self.assertGreater(pic["score_max"], 2.0)

    def test_serie_plate_aucun_pic(self):
        resultat = calculer_volatilite(tableau([100.0] * 50), fenetre=10)
        reponse = detecter_pics(resultat, seuil=2.0)
        self.assertEqual(reponse["pics"], [])
        self.assertIsNone(reponse["limite"])


class CorrelationsTests(SimpleTestCase):
    def setUp(self):
        retours = np.random.default_rng(1).normal(0, 0.01, 100)
        index = pd.date_range("2026-10-23 10:00", periods=100, freq="5min", tz="UTC")
        self.a = pd.Series(100 * np.cumprod(1 + retours), index=index)
        self.b = pd.Series(50 * np.cumprod(1 - retours), index=index)  # rendements opposés
        self.c = self.a * 3  # mêmes rendements que a

    def test_correlations_connues(self):
        corr, obs = calculer_correlations({"A": self.a, "B": self.b, "C": self.c})
        self.assertAlmostEqual(corr["A"]["B"], -1.0, places=5)
        self.assertAlmostEqual(corr["A"]["C"], 1.0, places=5)
        self.assertEqual(corr["B"]["A"], corr["A"]["B"])  # matrice symétrique
        self.assertEqual(corr["A"]["A"], 1.0)
        self.assertEqual(obs["A"]["B"], 99)

    def test_horodatages_communs_seulement(self):
        une_sur_deux = self.a.iloc[::2]  # 50 points
        corr, obs = calculer_correlations({"A": self.a, "D": une_sur_deux})
        self.assertEqual(obs["A"]["D"], 49)

    def test_pas_assez_de_donnees(self):
        vide = self.a.iloc[0:0]
        corr, obs = calculer_correlations({"A": self.a, "V": vide})
        self.assertIsNone(corr["A"]["V"])
        self.assertEqual(obs["A"]["V"], 0)