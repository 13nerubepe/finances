from django.db import models

# Create your models here.
from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.core.validators import RegexValidator

# pour controller le format du num tel
validateur_telephone = RegexValidator(
    regex=r"^\+?\d{8,15}$",
    message="Le numéro doit etre au format: +2376xxxxxxxx",
)


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _creer(self, telephone, password, **extra):
        if not telephone:
            raise ValueError("Le numéro de téléphone est obligatoire.")
        user = self.model(telephone=telephone, **extra)
        user.set_password(password)  # on hache le mdp
        user.save(using=self._db)
        return user

    def create_user(self, telephone, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._creer(telephone, password, **extra)

    def create_superuser(self, telephone, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self._creer(telephone, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    telephone = models.CharField(
        max_length=16, unique=True, validators=[validateur_telephone]
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_creation = models.DateTimeField(auto_now_add=True)
    email = models.EmailField(unique=True, null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "telephone"
    REQUIRED_FIELDS = ["nom", "prenom"]

    class Meta:
        verbose_name = "utilisateur"
        verbose_name_plural = "utilisateurs"

    def __str__(self):
        return f"{self.prenom} {self.nom} ({self.telephone})"


#     class Portefeuille(models.Model):
#
#         utilisateur = models.ForeignKey(
#             "finance.User",
#             on_delete=models.CASCADE,
#             related_name="portefeuilles"
#         )
#
#         nom = models.CharField(max_length=100)
#
#         description = models.TextField(blank=True)
#
#         devise = models.CharField(
#             max_length=10,
#             default="USD"
#         )
#
#         actifs = models.ManyToManyField(
#             "marches.Actif",
#             through="Position",
#             related_name="portefeuilles"
#         )
#
#         date_creation = models.DateTimeField(auto_now_add=True)
#
#         date_modification = models.DateTimeField(auto_now=True)
#
#         class Meta:
#             ordering = ["-date_creation"]
#             verbose_name = "Portefeuille"
#             verbose_name_plural = "Portefeuilles"
#
#         def __str__(self):
#             return f"{self.nom} - {self.utilisateur}"
#
#
#     class Position(models.Model):
#         """
#         Association entre un portefeuille et un actif surveillé.
#         Ce modèle ne représente pas une transaction financière.
#         """
#
#         portefeuille = models.ForeignKey(
#             Portefeuille,
#             on_delete=models.CASCADE,
#             related_name="positions"
#         )
#
#         actif = models.ForeignKey(
#             "marches.Actif",
#             on_delete=models.CASCADE,
#             related_name="positions"
#         )
#
#         date_ajout = models.DateTimeField(auto_now_add=True)
#
#         class Meta:
#             ordering = ["-date_ajout"]
#             constraints = [
#                 models.UniqueConstraint(
#                     fields=["portefeuille", "actif"],
#                     name="position_unique_portefeuille_actif"
#                 )
#             ]
#
#         def __str__(self):
#             return f"{self.portefeuille.nom} - {self.actif.symbole}"