# from django.test import TestCase

# Create your tests here.
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import User

DONNEES_VALIDES = {
    "nom": "Mballa",
    "prenom": "Yves",
    "telephone": "+237690000000",
    "password": "Motdepasse-Solide-2026",
}


class InscriptionTests(APITestCase):
    def test_inscription_reussie(self):
        r = self.client.post(reverse("inscription"), DONNEES_VALIDES)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("password", r.data)  # le mot de passe n'est jamais renvoyé
        user = User.objects.get(telephone="+237690000000")
        self.assertNotEqual(user.password, DONNEES_VALIDES["password"])  # il est haché
        self.assertTrue(user.check_password(DONNEES_VALIDES["password"]))

    def test_espaces_dans_le_telephone_sont_retires(self):
        donnees = {**DONNEES_VALIDES, "telephone": "+237 690 000 000"}
        r = self.client.post(reverse("inscription"), donnees)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data["telephone"], "+237690000000")

    def test_telephone_invalide(self):
        donnees = {**DONNEES_VALIDES, "telephone": "0690000000"}
        r = self.client.post(reverse("inscription"), donnees)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("telephone", r.data)

    def test_telephone_deja_utilise(self):
        self.client.post(reverse("inscription"), DONNEES_VALIDES)
        r = self.client.post(reverse("inscription"), DONNEES_VALIDES)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("telephone", r.data)

    def test_mot_de_passe_trop_faible(self):
        donnees = {**DONNEES_VALIDES, "password": "12345678"}
        r = self.client.post(reverse("inscription"), donnees)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_champ_manquant(self):
        donnees = {k: v for k, v in DONNEES_VALIDES.items() if k != "nom"}
        r = self.client.post(reverse("inscription"), donnees)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("nom", r.data)


class AuthentificationTests(APITestCase):
    def setUp(self):
        User.objects.create_user(
            telephone=DONNEES_VALIDES["telephone"],
            password=DONNEES_VALIDES["password"],
            nom=DONNEES_VALIDES["nom"],
            prenom=DONNEES_VALIDES["prenom"],
        )
        self.identifiants = {
            "telephone": DONNEES_VALIDES["telephone"],
            "password": DONNEES_VALIDES["password"],
        }

    def _connexion(self):
        return self.client.post(reverse("connexion"), self.identifiants)

    def test_connexion_reussie(self):
        r = self._connexion()
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn("access", r.data)
        self.assertIn("refresh", r.data)
        self.assertEqual(r.data["utilisateur"]["telephone"], "+237690000000")

    def test_connexion_mauvais_mot_de_passe(self):
        r = self.client.post(
            reverse("connexion"), {**self.identifiants, "password": "faux"}
        )
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_moi_sans_token_refuse(self):
        r = self.client.get(reverse("profile"))
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_moi_avec_token(self):
        access = self._connexion().data["access"]
        r = self.client.get(reverse("profile"), HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["prenom"], "Yves")

    def test_rafraichir_donne_un_nouvel_access(self):
        refresh = self._connexion().data["refresh"]
        r = self.client.post(reverse("rafraichir"), {"refresh": refresh})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn("access", r.data)

    def test_deconnexion_invalide_le_refresh(self):
        donnees = self._connexion().data
        en_tete = {"HTTP_AUTHORIZATION": f"Bearer {donnees['access']}"}
        r = self.client.post(
            reverse("deconnexion"), {"refresh": donnees["refresh"]}, **en_tete
        )
        self.assertEqual(r.status_code, status.HTTP_205_RESET_CONTENT)
        # Le refresh ne peut plus servir
        r = self.client.post(reverse("rafraichir"), {"refresh": donnees["refresh"]})
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_deconnexion_exige_d_etre_connecte(self):
        r = self.client.post(reverse("deconnexion"), {"refresh": "x"})
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_creation_superuser(self):
        admin = User.objects.create_superuser(
            telephone="+237691111111", password="Admin-Solide-2026", nom="A", prenom="B"
        )
        self.assertTrue(admin.is_staff and admin.is_superuser)