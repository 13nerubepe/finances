from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from marches.models import Actif

from .models import User

# Noms de champs attendus par le frontend
DONNEES_VALIDES = {
    "first_name": "Yves",
    "last_name": "Mballa",
    "email": "yves@example.com",
    "phone": "+237690000000",
    "password": "Motdepasse-Solide-2026",
}


class InscriptionTests(APITestCase):
    def inscrire(self, **modifications):
        return self.client.post(reverse("inscription"), {**DONNEES_VALIDES, **modifications})

    def test_inscription_reussie(self):
        r = self.inscrire()
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("password", r.data)  # le mot de passe n'est jamais renvoyé
        user = User.objects.get(telephone="+237690000000")
        self.assertNotEqual(user.password, DONNEES_VALIDES["password"])  # il est haché
        self.assertTrue(user.check_password(DONNEES_VALIDES["password"]))

    def test_espaces_dans_le_telephone_sont_retires(self):
        r = self.inscrire(phone="+237 690 000 000")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data["phone"], "+237690000000")

    def test_numero_sans_indicatif_est_normalise(self):
        r = self.inscrire(phone="696543193")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data["phone"], "+237696543193")

    def test_numero_avec_237_sans_plus_est_normalise(self):
        r = self.inscrire(phone="237696543193")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data["phone"], "+237696543193")

    def test_telephone_invalide(self):
        r = self.inscrire(phone="0690000000")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", r.data)

    def test_telephone_deja_utilise(self):
        self.inscrire()
        r = self.inscrire(email="autre@example.com", phone="690000000")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", r.data)

    def test_email_deja_utilise(self):
        self.inscrire()
        r = self.inscrire(email="YVES@example.com", phone="691111111")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", r.data)

    def test_mot_de_passe_trop_faible(self):
        r = self.inscrire(password="12345678")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_champ_manquant(self):
        donnees = {k: v for k, v in DONNEES_VALIDES.items() if k != "last_name"}
        r = self.client.post(reverse("inscription"), donnees)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("last_name", r.data)


class AuthentificationTests(APITestCase):
    def setUp(self):
        User.objects.create_user(
            telephone=DONNEES_VALIDES["phone"],
            password=DONNEES_VALIDES["password"],
            nom=DONNEES_VALIDES["last_name"],
            prenom=DONNEES_VALIDES["first_name"],
            email=DONNEES_VALIDES["email"],
        )
        self.identifiants = {"email": DONNEES_VALIDES["email"], "password": DONNEES_VALIDES["password"]}

    def _connexion(self):
        return self.client.post(reverse("connexion"), self.identifiants)

    def test_connexion_reussie(self):
        r = self._connexion()
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn("access", r.data)
        self.assertNotIn("refresh", r.data)  # le refresh est dans un cookie httpOnly
        self.assertIn("refresh_token", r.cookies)
        self.assertEqual(r.data["utilisateur"]["phone"], "+237690000000")

    def test_connexion_mauvais_mot_de_passe(self):
        r = self.client.post(reverse("connexion"), {**self.identifiants, "password": "faux"})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_moi_sans_token_refuse(self):
        r = self.client.get(reverse("profile"))
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_moi_avec_token(self):
        access = self._connexion().data["access"]
        r = self.client.get(reverse("profile"), HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["first_name"], "Yves")

    def test_rafraichir_avec_le_cookie(self):
        self._connexion()  # le client de test garde le cookie
        r = self.client.post(reverse("rafraichir"))
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn("access", r.data)

    def test_deconnexion_invalide_le_refresh(self):
        refresh = self._connexion().cookies["refresh_token"].value
        r = self.client.post(reverse("deconnexion"))
        self.assertEqual(r.status_code, status.HTTP_205_RESET_CONTENT)
        # On remet l'ancien cookie : il ne doit plus fonctionner
        self.client.cookies["refresh_token"] = refresh
        r = self.client.post(reverse("rafraichir"))
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_changer_mot_de_passe(self):
        access = self._connexion().data["access"]
        r = self.client.post(
            reverse("mot-de-passe"),
            {"current_password": DONNEES_VALIDES["password"], "new_password": "Nouveau-Solide-2027"},
            HTTP_AUTHORIZATION=f"Bearer {access}",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(User.objects.get().check_password("Nouveau-Solide-2027"))

    def test_creation_superuser(self):
        admin = User.objects.create_superuser(
            telephone="691111111", password="Admin-Solide-2026", nom="A", prenom="B"
        )
        self.assertTrue(admin.is_staff and admin.is_superuser)
        self.assertEqual(admin.telephone, "+237691111111")


class PortefeuilleTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(telephone="690000000", password="x", nom="A", prenom="B")
        self.autre = User.objects.create_user(telephone="690000001", password="x", nom="C", prenom="D")
        Actif.objects.create(symbole="AAPL", nom="Apple", type_actif=Actif.TypeActif.ACTION)
        self.client.force_authenticate(self.user)

    def _creer(self, nom="Tech"):
        return self.client.post(reverse("portefeuille-list"), {"nom": nom}, format="json")

    def _ajouter(self, pk, **donnees):
        return self.client.post(reverse("portefeuille-actifs", args=[pk]), donnees, format="json")

    def test_creer_un_portefeuille(self):
        r = self._creer()
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data["nb_actifs"], 0)

    def test_nom_en_double_refuse(self):
        self._creer("Tech")
        r = self._creer("tech")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("nom", r.data)

    def test_ajouter_un_actif_avec_quantite(self):
        pk = self._creer().data["id"]
        r = self._ajouter(pk, symbole="aapl", quantite="10")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data["symbole"], "AAPL")
        self.assertEqual(r.data["quantite"], Decimal("10"))

    def test_ajouter_deux_fois_le_meme_actif(self):
        pk = self._creer().data["id"]
        self._ajouter(pk, symbole="AAPL")
        r = self._ajouter(pk, symbole="AAPL")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_actif_inconnu(self):
        pk = self._creer().data["id"]
        r = self._ajouter(pk, symbole="XXXX")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("symbole", r.data)

    def test_detail_liste_les_actifs(self):
        pk = self._creer().data["id"]
        self._ajouter(pk, symbole="AAPL")
        r = self.client.get(reverse("portefeuille-detail", args=[pk]))
        self.assertEqual(r.data["nb_actifs"], 1)
        self.assertEqual(r.data["actifs"][0]["symbole"], "AAPL")

    def test_modifier_puis_retirer_un_actif(self):
        pk = self._creer().data["id"]
        self._ajouter(pk, symbole="AAPL")
        url = reverse("portefeuille-actif", args=[pk, "aapl"])
        r = self.client.patch(url, {"quantite": "5"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["quantite"], Decimal("5"))
        r = self.client.delete(url)
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(self.client.get(reverse("portefeuille-detail", args=[pk])).data["nb_actifs"], 0)

    def test_portefeuille_d_un_autre_invisible(self):
        pk = self._creer().data["id"]
        self.client.force_authenticate(self.autre)
        self.assertEqual(self.client.get(reverse("portefeuille-detail", args=[pk])).status_code, 404)
        self.assertEqual(self._ajouter(pk, symbole="AAPL").status_code, 404)

    def test_sans_token_refuse(self):
        self.client.force_authenticate(None)
        r = self.client.get(reverse("portefeuille-list"))
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
