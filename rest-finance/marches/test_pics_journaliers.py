from datetime import date

from django.urls import reverse
from rest_framework.test import APITestCase

from agent.models import Explication
from finance.models import User

from .models import Actif, IndicateurJournalier


class PicsJournaliersTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(User.objects.create_user(telephone="690000000", password="x", nom="A", prenom="B"))
        aapl = Actif.objects.create(symbole="AAPL", nom="Apple", type_actif=Actif.TypeActif.ACTION)
        nvda = Actif.objects.create(symbole="NVDA", nom="Nvidia", type_actif=Actif.TypeActif.ACTION)
        self.pic_aapl = IndicateurJournalier.objects.create(
            actif=aapl, date=date(2026, 7, 31), rendement=-0.0943, z=-4.1, est_pic=True, type_pic="specifique"
        )
        IndicateurJournalier.objects.create(actif=aapl, date=date(2026, 7, 30), rendement=0.01, z=0.5)
        IndicateurJournalier.objects.create(
            actif=nvda, date=date(2026, 2, 6), rendement=0.07, z=3.75, est_pic=True, type_pic="systemique"
        )

    def lister(self, **filtres):
        return self.client.get(reverse("pics-journaliers"), filtres).data

    def test_seuls_les_pics_les_plus_recents_d_abord(self):
        self.assertEqual([p["date"] for p in self.lister()], ["2026-07-31", "2026-02-06"])

    def test_variation_en_pourcentage(self):
        self.assertEqual(self.lister(symbole="aapl")[0]["variation"], -9.0)

    def test_filtres(self):
        self.assertEqual(len(self.lister(symbole="NVDA")), 1)
        self.assertEqual(len(self.lister(debut="2026-03-01")), 1)
        self.assertEqual(self.lister(type_pic="systemique")[0]["symbole"], "NVDA")

    def test_explication_disponible(self):
        self.assertFalse(self.lister(symbole="AAPL")[0]["explication_disponible"])
        Explication.objects.create(pic=self.pic_aapl, texte="Résultats décevants.", modele="test")
        self.assertTrue(self.lister(symbole="AAPL")[0]["explication_disponible"])
