
from django.test import TestCase# Create your tests here.
from .memoire import contexte_conversation
from unittest.mock import patch

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from finance.models import User

from .models import Message

REPONSE_FACTICE = {"reponse": "AAPL a chuté après ses résultats.", "sources": [{"titre": "T", "url": "u", "type": "actualite"}]}


@patch("agent.views.repondre", return_value=REPONSE_FACTICE)
class AssistantTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(telephone="690000000", password="x", nom="A", prenom="B")
        self.client.force_authenticate(self.user)

    def poser(self, message="Pourquoi AAPL a chuté ?"):
        return self.client.post(reverse("assistant-question"), {"message": message}, format="json")

    def test_question_enregistre_question_et_reponse(self, faux_repondre):
        r = self.poser()
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["reponse"], REPONSE_FACTICE["reponse"])
        self.assertEqual(r.data["sources"][0]["type"], "actualite")
        self.assertEqual(list(Message.objects.values_list("role", flat=True)), ["user", "assistant"])

    def test_l_agent_recoit_l_historique(self, faux_repondre):
        self.poser("Première question")
        self.poser("Et ensuite ?")
        historique = faux_repondre.call_args.args[1]
        self.assertEqual(historique, [("user", "Première question"), ("assistant", REPONSE_FACTICE["reponse"])])

    def test_historique_ne_montre_que_mes_messages(self, faux_repondre):
        self.poser()
        autre = User.objects.create_user(telephone="690000001", password="x", nom="C", prenom="D")
        self.client.force_authenticate(autre)
        self.assertEqual(self.client.get(reverse("assistant-historique")).data, [])

    def test_historique_dans_l_ordre(self, faux_repondre):
        self.poser()
        r = self.client.get(reverse("assistant-historique"))
        self.assertEqual([m["role"] for m in r.data], ["user", "assistant"])
        self.assertIn("dateCreation", r.data[0])

    def test_message_vide_refuse(self, faux_repondre):
        self.assertEqual(self.poser("").status_code, status.HTTP_400_BAD_REQUEST)

    def test_erreur_de_l_ia_renvoie_503_sans_rien_enregistrer(self, faux_repondre):
        faux_repondre.side_effect = RuntimeError("quota dépassé")
        self.assertEqual(self.poser().status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(Message.objects.count(), 0)

    def test_sans_token_refuse(self, faux_repondre):
        self.client.force_authenticate(None)
        self.assertEqual(self.poser().status_code, status.HTTP_401_UNAUTHORIZED)

@patch("agent.memoire.resumer", return_value="Résumé : AAPL a chuté le 31/07 (z = -4,1).")
class MemoireTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(telephone="690000000", password="x", nom="A", prenom="B")

    def ajouter(self, nombre):
        for i in range(nombre):
            role = "user" if i % 2 == 0 else "assistant"
            Message.objects.create(utilisateur=self.user, role=role, contenu=f"message {i}")

    def test_pas_de_resume_sous_le_seuil(self, faux_resumer):
        self.ajouter(19)
        resume, historique = contexte_conversation(self.user)
        faux_resumer.assert_not_called()
        self.assertEqual(resume, "")
        self.assertEqual(len(historique), 19)  # rien n'est perdu

    def test_au_seuil_on_resume_les_plus_anciens(self, faux_resumer):
        self.ajouter(20)
        resume, historique = contexte_conversation(self.user)
        self.assertEqual(resume, "Résumé : AAPL a chuté le 31/07 (z = -4,1).")
        self.assertEqual(len(faux_resumer.call_args.args[1]), 10)  # les 10 plus anciens résumés
        self.assertEqual(len(historique), 10)
        self.assertEqual(historique[0][1], "message 10")  # la fenêtre commence juste après

    def test_le_nouveau_resume_integre_l_ancien(self, faux_resumer):
        self.ajouter(20)
        contexte_conversation(self.user)
        self.ajouter(10)
        contexte_conversation(self.user)
        self.assertEqual(faux_resumer.call_count, 2)
        self.assertEqual(faux_resumer.call_args.args[0], "Résumé : AAPL a chuté le 31/07 (z = -4,1).")


class ExplicationPicTests(APITestCase):
    def setUp(self):
        from datetime import date

        from marches.models import Actif, IndicateurJournalier

        self.client.force_authenticate(User.objects.create_user(telephone="690000001", password="x", nom="A", prenom="B"))
        aapl = Actif.objects.create(symbole="AAPL", nom="Apple Inc.")
        IndicateurJournalier.objects.create(actif=aapl, date=date(2026, 7, 31), rendement=-0.09, z=-4.1, est_pic=True)

    def demander(self, jour="2026-07-31"):
        return self.client.get(reverse("explication-pic", args=["AAPL", jour]))

    @patch("agent.views.expliquer_pic", side_effect=ValueError("No API key was provided."))
    def test_cle_google_absente_renvoie_503(self, _faux):
        reponse = self.demander()
        self.assertEqual(reponse.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("GOOGLE_API_KEY", reponse.data["detail"])

    def test_jour_sans_indicateur_renvoie_404(self):
        self.assertEqual(self.demander("2026-07-30").status_code, status.HTTP_404_NOT_FOUND)

    @patch("agent.views.expliquer_pic")
    def test_un_jour_sans_pic_peut_etre_explique(self, faux):
        from datetime import date

        from marches.models import Actif, IndicateurJournalier

        IndicateurJournalier.objects.create(
            actif=Actif.objects.get(symbole="AAPL"), date=date(2026, 7, 30), rendement=0.004, z=0.5, est_pic=False
        )
        faux.return_value = type("E", (), {"texte": "RAS", "sources": [], "modele": "m"})()
        with patch("agent.views.ExplicationSerializer") as serial:
            serial.return_value.data = {"texte": "RAS"}
            self.assertEqual(self.demander("2026-07-30").status_code, status.HTTP_200_OK)
