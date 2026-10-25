from django.test import TestCase

# Create your tests here.
import os
from datetime import timedelta
from io import StringIO
from unittest import skipUnless
from unittest.mock import patch

import pandas as pd
from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.utils import timezone

from .ingestion import (
    COLONNES,
    JOURS_INITIAL,
    JOURS_MAX,
    calculer_fenetre_jours,
    ingerer_actif,
    normaliser_bougies,
)
from .models import Actif, CoursHistorique


def faux_bougies(n=6, debut="2026-10-23 14:00"):
    """Tableau de n bougies de 5 min, au format déjà normalisé (colonnes minuscules, UTC)."""
    index = pd.date_range(debut, periods=n, freq="5min", tz="UTC")
    return pd.DataFrame(
        {
            "open": [100.0 + i for i in range(n)],
            "high": [101.0 + i for i in range(n)],
            "low": [99.0 + i for i in range(n)],
            "close": [100.5 + i for i in range(n)],
            "volume": [1000 + i for i in range(n)],
        },
        index=index,
    )


def creer_actif(symbole="AAPL"):
    return Actif.objects.create(symbole=symbole, nom=symbole, type_actif="action")


class NormaliserBougiesTests(TestCase):
    def test_conversion_en_utc_et_colonnes_minuscules(self):
        index = pd.date_range("2026-10-23 16:00", periods=2, freq="5min", tz="Europe/Paris")
        brut = pd.DataFrame(
            {"Open": [1.0, 2.0], "High": [2.0, 3.0], "Low": [0.5, 1.5], "Close": [1.5, 2.5],
             "Volume": [10, 20], "Dividends": [0, 0]},
            index=index,
        )
        propre = normaliser_bougies(brut)
        self.assertEqual(list(propre.columns), COLONNES)
        # 16:00 à Paris (UTC+2 fin octobre) = 14:00 UTC
        self.assertEqual(propre.index[0].hour, 14)
        self.assertEqual(str(propre.index.tz), "UTC")

    def test_lignes_incompletes_supprimees(self):
        df = faux_bougies(3)
        df.loc[df.index[1], "close"] = float("nan")
        self.assertEqual(len(normaliser_bougies(df)), 2)

    def test_tableau_vide(self):
        propre = normaliser_bougies(pd.DataFrame())
        self.assertTrue(propre.empty)
        self.assertEqual(list(propre.columns), COLONNES)


class FenetreTests(TestCase):
    def test_sans_cours_fenetre_initiale(self):
        self.assertEqual(calculer_fenetre_jours(creer_actif()), JOURS_INITIAL)

    def test_avec_derniere_bougie_il_y_a_un_jour_et_demi(self):
        actif = creer_actif()
        CoursHistorique.objects.create(
            actif=actif, horodatage=timezone.now() - timedelta(days=1.5),
            open=1, high=1, low=1, close=1,
        )
        self.assertEqual(calculer_fenetre_jours(actif), 3)  # ceil(1,5) + 1

    def test_plafond(self):
        actif = creer_actif()
        self.assertEqual(calculer_fenetre_jours(actif, jours=500), JOURS_MAX)
        CoursHistorique.objects.create(
            actif=actif, horodatage=timezone.now() - timedelta(days=200),
            open=1, high=1, low=1, close=1,
        )
        self.assertEqual(calculer_fenetre_jours(actif), JOURS_MAX)


class IngestionTests(TestCase):
    @patch("marches.ingestion.recuperer_bougies")
    def test_enregistre_les_bougies(self, faux):
        faux.return_value = faux_bougies(6)
        actif = creer_actif()
        self.assertEqual(ingerer_actif(actif), (6, 6))
        self.assertEqual(actif.cours.count(), 6)
        premiere = actif.cours.first()
        self.assertEqual((premiere.open, premiere.close, premiere.volume), (100.0, 100.5, 1000))

    @patch("marches.ingestion.recuperer_bougies")
    def test_relancer_ne_cree_pas_de_doublons(self, faux):
        faux.return_value = faux_bougies(6)
        actif = creer_actif()
        ingerer_actif(actif)
        self.assertEqual(ingerer_actif(actif), (6, 0))
        self.assertEqual(actif.cours.count(), 6)

    @patch("marches.ingestion.recuperer_bougies")
    def test_ajoute_seulement_les_nouvelles_bougies(self, faux):
        actif = creer_actif()
        faux.return_value = faux_bougies(6)
        ingerer_actif(actif)
        faux.return_value = faux_bougies(9)  # les 6 premières existent déjà
        self.assertEqual(ingerer_actif(actif), (9, 3))

    @patch("marches.ingestion.recuperer_bougies")
    def test_aucune_donnee(self, faux):
        faux.return_value = pd.DataFrame(columns=COLONNES)
        self.assertEqual(ingerer_actif(creer_actif()), (0, 0))

    def test_unicite_actif_horodatage(self):
        actif = creer_actif()
        h = timezone.now()
        CoursHistorique.objects.create(actif=actif, horodatage=h, open=1, high=1, low=1, close=1)
        with self.assertRaises(IntegrityError), transaction.atomic():
            CoursHistorique.objects.create(actif=actif, horodatage=h, open=2, high=2, low=2, close=2)


class CommandesTests(TestCase):
    def test_charger_actifs_est_idempotent(self):
        call_command("charger_actifs", stdout=StringIO())
        call_command("charger_actifs", stdout=StringIO())
        self.assertEqual(Actif.objects.count(), 7)
        self.assertTrue(Actif.objects.filter(symbole="^GSPC", type_actif="indice").exists())

    @patch("marches.ingestion.recuperer_bougies")
    def test_ingerer_cours(self, faux):
        faux.return_value = faux_bougies(4)
        creer_actif("AAPL")
        sortie = StringIO()
        call_command("ingerer_cours", stdout=sortie)
        self.assertIn("AAPL : 4 bougies reçues, 4 nouvelles", sortie.getvalue())

    @patch("marches.ingestion.recuperer_bougies")
    def test_une_erreur_n_arrete_pas_les_autres_actifs(self, faux):
        def simulation(symbole, jours):
            if symbole == "AAPL":
                raise RuntimeError("panne réseau")
            return faux_bougies(4)

        faux.side_effect = simulation
        creer_actif("AAPL")
        creer_actif("MSFT")
        sortie, erreurs = StringIO(), StringIO()
        call_command("ingerer_cours", stdout=sortie, stderr=erreurs)
        self.assertIn("AAPL : erreur", erreurs.getvalue())
        self.assertIn("MSFT : 4 bougies reçues", sortie.getvalue())

    @patch("marches.ingestion.recuperer_bougies")
    def test_option_symbole_et_est_suivi(self, faux):
        faux.return_value = faux_bougies(2)
        creer_actif("AAPL")
        creer_actif("MSFT")
        Actif.objects.filter(symbole="MSFT").update(est_suivi=False)
        sortie = StringIO()
        call_command("ingerer_cours", "--symbole", "AAPL", "MSFT", stdout=sortie)
        self.assertIn("AAPL", sortie.getvalue())
        self.assertNotIn("MSFT", sortie.getvalue())

    def test_sans_actif_message_d_aide(self):
        sortie = StringIO()
        call_command("ingerer_cours", stdout=sortie)
        self.assertIn("charger_actifs", sortie.getvalue())

    @patch("marches.ingestion.recuperer_bougies")
    def test_etat_cours(self, faux):
        faux.return_value = faux_bougies(3)
        creer_actif("AAPL")
        call_command("ingerer_cours", stdout=StringIO())
        sortie = StringIO()
        call_command("etat_cours", stdout=sortie)
        self.assertIn("AAPL", sortie.getvalue())
        self.assertIn("3", sortie.getvalue())


@skipUnless(
    os.environ.get("TEST_INTERNET") == "1",
    "Test avec internet désactivé : lance-le avec TEST_INTERNET=1.",
)
class TestInternet(TestCase):
    """Vrai téléchargement chez Yahoo Finance. Le Bitcoin est coté 24h/24, 7j/7 :
    ce test fonctionne même le week-end."""

    def test_telechargement_reel_du_bitcoin(self):
        actif = Actif.objects.create(
            symbole="BTC-USD", nom="Bitcoin", type_actif="crypto", devise="USD"
        )
        recues, nouvelles = ingerer_actif(actif, jours=1)
        self.assertGreater(nouvelles, 0, "Aucune donnée reçue : vérifie ta connexion internet.")

        derniere = actif.cours.order_by("-horodatage").first()
        self.assertGreater(derniere.close, 0)
        self.assertGreaterEqual(derniere.high, derniere.low)

        # Relancer ne duplique rien (au plus une ou deux bougies apparues entre-temps)
        _, nouvelles_2 = ingerer_actif(actif, jours=1)
        self.assertLessEqual(nouvelles_2, 2)