# Create your tests here.
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
