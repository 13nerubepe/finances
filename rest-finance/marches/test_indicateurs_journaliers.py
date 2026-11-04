import numpy as np
import pandas as pd
from django.test import SimpleTestCase

from .indicateurs_journaliers import calculer_indicateurs


def construire_cours(rendements, volume=1_000_000):
    """Cours fictifs (jours ouvrés) dont les log-rendements de clôture valent `rendements`."""
    close = 100 * np.exp(np.cumsum(np.r_[0.0, rendements]))
    dates = pd.bdate_range("2026-01-01", periods=len(close))
    return pd.DataFrame(
        {"open": close, "high": close * 1.01, "low": close * 0.99, "close": close, "volume": volume},
        index=dates,
    )


def bruit(graine, taille, ecart_type=0.01):
    """Rendements aléatoires « calmes » (1 % par jour), toujours les mêmes pour une graine donnée."""
    return np.random.default_rng(graine).normal(0, ecart_type, taille)


class CalculsDeBaseTests(SimpleTestCase):
    def test_rendement_logarithmique(self):
        ind = calculer_indicateurs(construire_cours([0.02, -0.01]))
        self.assertTrue(np.isnan(ind["rendement"].iloc[0]))  # pas de veille le premier jour
        self.assertAlmostEqual(ind["rendement"].iloc[1], 0.02)
        self.assertAlmostEqual(ind["rendement"].iloc[2], -0.01)

    def test_volatilite_attend_20_rendements(self):
        ind = calculer_indicateurs(construire_cours(bruit(1, 30)))
        self.assertTrue(ind["volatilite"].iloc[:20].isna().all())
        self.assertFalse(np.isnan(ind["volatilite"].iloc[20]))

    def test_annualisation_actions_et_cryptos(self):
        cours = construire_cours(bruit(1, 40))
        actions = calculer_indicateurs(cours)
        crypto = calculer_indicateurs(cours, jours_par_an=365)
        jour = cours.index[-1]
        self.assertAlmostEqual(actions.loc[jour, "volatilite_annuelle"], actions.loc[jour, "volatilite"] * np.sqrt(252))
        self.assertAlmostEqual(crypto.loc[jour, "volatilite_annuelle"], crypto.loc[jour, "volatilite"] * np.sqrt(365))

    def test_gap_d_ouverture(self):
        cours = construire_cours([0.0, 0.0])
        cours.loc[cours.index[2], "open"] = 105  # ouverture à 105 après une clôture à 100
        ind = calculer_indicateurs(cours)
        self.assertAlmostEqual(ind["gap"].iloc[2], np.log(105 / 100))

    def test_volume_nul_ignore(self):
        ind = calculer_indicateurs(construire_cours(bruit(1, 40), volume=0))
        self.assertTrue(ind["z_volume"].isna().all())


class DetectionDesPicsTests(SimpleTestCase):
    def test_z_utilise_la_volatilite_de_la_veille(self):
        ind = calculer_indicateurs(construire_cours(bruit(1, 40)))
        self.assertAlmostEqual(ind["z"].iloc[30], ind["rendement"].iloc[30] / ind["volatilite"].iloc[29])

    def test_un_seul_pic_le_jour_du_choc(self):
        rendements = bruit(0, 100)
        rendements[80] = 0.08  # +8 % un jour où le marché bouge d'environ 1 %
        ind = calculer_indicateurs(construire_cours(rendements))
        self.assertEqual(list(ind.index[ind["est_pic"]]), [ind.index[81]])

    def test_le_seuil_change_la_detection(self):
        rendements = bruit(0, 100)
        rendements[80] = 0.04  # z d'environ 3,6
        cours = construire_cours(rendements)
        self.assertTrue(calculer_indicateurs(cours, seuil=2.5)["est_pic"].iloc[81])
        self.assertFalse(calculer_indicateurs(cours, seuil=5)["est_pic"].iloc[81])

    def test_aucun_regard_vers_le_futur(self):
        cours = construire_cours(bruit(2, 120))
        sur_90_jours = calculer_indicateurs(cours.iloc[:90])
        sur_120_jours = calculer_indicateurs(cours).iloc[:90]
        colonnes = ["rendement", "volatilite", "z", "parkinson", "z_volume", "gap"]
        pd.testing.assert_frame_equal(sur_90_jours[colonnes], sur_120_jours[colonnes])


class TypeDePicTests(SimpleTestCase):
    def test_sans_indice_pas_de_beta_ni_de_type(self):
        ind = calculer_indicateurs(construire_cours(bruit(1, 100)))
        self.assertTrue(ind["beta"].isna().all())
        self.assertTrue(ind["type_pic"].isna().all())

    def test_beta_puis_pic_systemique_et_pic_specifique(self):
        marche = bruit(3, 150)
        actif = 1.5 * marche + bruit(4, 150, 0.003)  # l'actif suit le marché avec un bêta de 1,5
        marche[120], actif[120] = -0.06, -0.09     # krach du marché, l'actif suit (1,5 x -6 %)
        marche[135], actif[135] = 0.0, -0.08       # marché calme, seul l'actif chute
        indice = calculer_indicateurs(construire_cours(marche))
        ind = calculer_indicateurs(construire_cours(actif), indice["rendement"])

        self.assertAlmostEqual(ind["beta"].iloc[119], 1.5, delta=0.1)
        self.assertEqual(ind["type_pic"].iloc[121], "systemique")
        self.assertEqual(ind["type_pic"].iloc[136], "specifique")
