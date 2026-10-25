"""Tests des routes de l'API des marchés (avec base de données de test)."""

from datetime import datetime, timedelta, timezone

import numpy as np
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from finance.models import User

from .models import Actif, CoursHistorique

DEBUT = datetime(2026, 10, 23, 10, 0, tzinfo=timezone.utc)


def creer_cours(actif, closes, debut=DEBUT):
    CoursHistorique.objects.bulk_create(
        CoursHistorique(
            actif=actif,
            horodatage=debut + timedelta(minutes=5 * i),
            open=c,
            high=c * 1.001,
            low=c * 0.999,
            close=c,
            volume=1000,
        )
        for i, c in enumerate(closes)
    )


def marche_aleatoire(n=300, graine=42):
    retours = np.random.default_rng(graine).normal(0, 0.002, n)
    return list(100 * np.cumprod(1 + retours))


def serie_avec_choc():
    retours = np.array([1e-4 if i % 2 == 0 else -1e-4 for i in range(200)])
    retours[150] = 0.05
    return list(100 * np.cumprod(1 + retours))


class BaseApiTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            telephone="+237690000000", password="Motdepasse-Solide-2026", nom="N", prenom="P"
        )
        cls.aapl = Actif.objects.create(symbole="AAPL", nom="Apple Inc.", type_actif="action")
        cls.msft = Actif.objects.create(symbole="MSFT", nom="Microsoft", type_actif="action")
        cls.tsla = Actif.objects.create(symbole="TSLA", nom="Tesla", type_actif="action")
        cls.gspc = Actif.objects.create(symbole="^GSPC", nom="S&P 500", type_actif="indice")
        cls.vide = Actif.objects.create(symbole="ETH-USD", nom="Ethereum", type_actif="crypto")

        cls.closes_aapl = marche_aleatoire()
        creer_cours(cls.aapl, cls.closes_aapl)
        creer_cours(cls.msft, [2 * c for c in cls.closes_aapl])  # mêmes rendements qu'AAPL
        creer_cours(cls.tsla, serie_avec_choc())
        creer_cours(cls.gspc, cls.closes_aapl)

    def setUp(self):
        self.client.force_authenticate(self.user)


class AuthentificationTests(BaseApiTest):
    def test_toutes_les_routes_exigent_un_token(self):
        self.client.force_authenticate(None)
        for url in [
            "/api/actifs/",
            "/api/actifs/AAPL/volatilite/",
            "/api/actifs/AAPL/pics/",
            "/api/cours/",
            "/api/correlations/?actifs=AAPL,MSFT",
        ]:
            self.assertEqual(self.client.get(url).status_code, 401, url)


class ActifsTests(BaseApiTest):
    def test_liste_et_filtres(self):
        r = self.client.get("/api/actifs/")
        self.assertEqual(len(r.data), 5)  # pas de pagination
        r = self.client.get("/api/actifs/?type_actif=indice")
        self.assertEqual([a["symbole"] for a in r.data], ["^GSPC"])
        r = self.client.get("/api/actifs/?search=apple")
        self.assertEqual([a["symbole"] for a in r.data], ["AAPL"])

    def test_detail_insensible_a_la_casse_et_symbole_special(self):
        self.assertEqual(self.client.get("/api/actifs/aapl/").data["symbole"], "AAPL")
        self.assertEqual(self.client.get("/api/actifs/%5EGSPC/").data["symbole"], "^GSPC")
        self.assertEqual(self.client.get("/api/actifs/ETH-USD/").status_code, 200)
        self.assertEqual(self.client.get("/api/actifs/XXX/").status_code, 404)


class CoursTests(BaseApiTest):
    def test_filtre_par_actif_et_pagination(self):
        r = self.client.get("/api/cours/?actif=AAPL")
        self.assertEqual(r.data["count"], 300)
        self.assertEqual(len(r.data["results"]), 300)  # page de 500 par défaut
        self.assertEqual(r.data["results"][0]["actif"], "AAPL")
        r = self.client.get("/api/cours/?actif=aapl&taille=50")
        self.assertEqual(len(r.data["results"]), 50)
        self.assertIsNotNone(r.data["next"])

    def test_filtre_par_periode_bornes_incluses(self):
        r = self.client.get("/api/cours/?actif=AAPL&debut=2026-10-23T11:00:00Z&fin=2026-10-23T11:25:00Z")
        self.assertEqual(r.data["count"], 6)  # 11:00, 11:05, ..., 11:25

    def test_date_seule_vaut_minuit_utc(self):
        r = self.client.get("/api/cours/?actif=AAPL&debut=2026-10-24")
        self.assertEqual(r.data["count"], 132)  # bougies à partir de minuit

    def test_ordre_decroissant(self):
        r = self.client.get("/api/cours/?actif=AAPL&ordre=-horodatage")
        self.assertEqual(r.data["results"][0]["horodatage"], "2026-10-24T10:55:00Z")

    def test_date_invalide_et_actif_inconnu(self):
        self.assertEqual(self.client.get("/api/cours/?debut=pas-une-date").status_code, 400)
        self.assertEqual(self.client.get("/api/cours/?actif=XXX").data["count"], 0)


class VolatiliteTests(BaseApiTest):
    def test_valeurs_verifiees_avec_numpy(self):
        r = self.client.get("/api/actifs/AAPL/volatilite/?fenetre=20")
        self.assertEqual(r.status_code, 200)
        closes = np.array(self.closes_aapl)
        rendements = closes[1:] / closes[:-1] - 1
        attendu = np.std(rendements[-20:], ddof=1)  # écart-type des 20 derniers rendements
        self.assertAlmostEqual(r.data["resume"]["volatilite_derniere"], attendu, places=7)
        self.assertAlmostEqual(r.data["serie"][-1]["volatilite"], attendu, places=7)
        self.assertAlmostEqual(r.data["resume"]["rendement_periode"], closes[-1] / closes[0] - 1, places=7)
        self.assertAlmostEqual(r.data["resume"]["amplitude_periode"], (closes.max() * 1.001 - closes.min() * 0.999) / (closes.min() * 0.999), places=7)

    def test_les_20_premiers_points_n_ont_pas_de_volatilite(self):
        serie = self.client.get("/api/actifs/AAPL/volatilite/?fenetre=20").data["serie"]
        self.assertEqual(len(serie), 300)
        self.assertTrue(all(p["volatilite"] is None for p in serie[:20]))
        self.assertIsNotNone(serie[20]["volatilite"])

    def test_frequence_15min(self):
        r = self.client.get("/api/actifs/AAPL/volatilite/?frequence=15min&fenetre=5")
        self.assertEqual(r.data["resume"]["nb_points"], 100)

    def test_periode_par_defaut_7_jours(self):
        creer_cours(self.aapl, [100.0], debut=datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc))
        self.assertEqual(self.client.get("/api/actifs/AAPL/volatilite/").data["resume"]["nb_points"], 300)
        r = self.client.get("/api/actifs/AAPL/volatilite/?debut=2026-08-01")
        self.assertEqual(r.data["resume"]["nb_points"], 301)

    def test_parametres_invalides(self):
        for query in ["fenetre=1", "fenetre=abc", "frequence=2h", "debut=2026-10-24&fin=2026-10-23"]:
            r = self.client.get(f"/api/actifs/AAPL/volatilite/?{query}")
            self.assertEqual(r.status_code, 400, query)

    def test_actif_inconnu_et_symboles_speciaux(self):
        self.assertEqual(self.client.get("/api/actifs/XXX/volatilite/").status_code, 404)
        self.assertEqual(self.client.get("/api/actifs/%5EGSPC/volatilite/").status_code, 200)
        self.assertEqual(self.client.get("/api/actifs/aapl/volatilite/").status_code, 200)

    def test_actif_sans_cours(self):
        r = self.client.get("/api/actifs/ETH-USD/volatilite/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["serie"], [])
        self.assertEqual(r.data["resume"]["nb_points"], 0)


class PicsTests(BaseApiTest):
    def test_le_choc_de_tesla_est_detecte(self):
        r = self.client.get("/api/actifs/TSLA/pics/?fenetre=10")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data["pics"]), 1)
        pic = r.data["pics"][0]
        self.assertEqual(pic["nb_points"], 10)
        self.assertGreater(pic["score_max"], 2)
        # le choc a lieu à la bougie n°150 : 10:00 + 150 x 5 min = 22:30
        self.assertEqual(pic["debut"], datetime(2026, 10, 23, 22, 30, tzinfo=timezone.utc))

    def test_marche_aleatoire_pas_de_pic_extreme(self):
        r = self.client.get("/api/actifs/AAPL/pics/?seuil=10")
        self.assertEqual(r.data["pics"], [])
        self.assertIsNotNone(r.data["limite"])

    def test_actif_sans_cours_et_seuil_invalide(self):
        self.assertEqual(self.client.get("/api/actifs/ETH-USD/pics/").data["pics"], [])
        self.assertEqual(self.client.get("/api/actifs/AAPL/pics/?seuil=50").status_code, 400)


class CorrelationsTests(BaseApiTest):
    def test_actifs_aux_memes_rendements(self):
        r = self.client.get("/api/correlations/?actifs=AAPL,MSFT")
        self.assertEqual(r.status_code, 200)
        self.assertAlmostEqual(r.data["correlations"]["AAPL"]["MSFT"], 1.0, places=5)
        self.assertEqual(r.data["observations"]["AAPL"]["MSFT"], 299)
        self.assertEqual(r.data["correlations"]["AAPL"]["AAPL"], 1.0)

    def test_minuscules_et_symbole_special(self):
        r = self.client.get("/api/correlations/?actifs=aapl,%5EGSPC,tsla")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["actifs"], ["AAPL", "^GSPC", "TSLA"])
        correlation = r.data["correlations"]["AAPL"]["TSLA"]
        self.assertTrue(-1 <= correlation <= 1)

    def test_actif_sans_cours_donne_null(self):
        r = self.client.get("/api/correlations/?actifs=AAPL,ETH-USD")
        self.assertIsNone(r.data["correlations"]["AAPL"]["ETH-USD"])
        self.assertEqual(r.data["observations"]["AAPL"]["ETH-USD"], 0)

    def test_parametres_invalides(self):
        self.assertEqual(self.client.get("/api/correlations/").status_code, 400)
        self.assertEqual(self.client.get("/api/correlations/?actifs=AAPL").status_code, 400)
        self.assertEqual(self.client.get("/api/correlations/?actifs=AAPL,AAPL").status_code, 400)
        self.assertEqual(self.client.get("/api/correlations/?actifs=AAPL,XXX").status_code, 400)
        onze = ",".join(f"S{i}" for i in range(11))
        self.assertEqual(self.client.get(f"/api/correlations/?actifs={onze}").status_code, 400)