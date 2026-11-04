from django.db import models

# Create your models here.
from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from decimal import Decimal

from django.core.validators import MinValueValidator, RegexValidator

# pour controller le format du num tel (mobile camerounais : 6 suivi de 8 chiffres)
validateur_telephone = RegexValidator(
    regex=r"^\+2376\d{8}$",
    message="Le numéro doit etre au format: 6XXXXXXXX, 2376XXXXXXXX ou +2376XXXXXXXX",
)

def normaliser_telephone(telephone):
    """Ramène un numéro au format +237XXXXXXXXX. Ainsi on uniformise les numeros"""
    telephone = telephone.replace(" ", "")
    if len(telephone) == 9:
        telephone = "+237" + telephone
    elif len(telephone) == 12 and telephone.startswith("237"):
        telephone = "+" + telephone
    return telephone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _creer(self, telephone, password, **extra):
        telephone = normaliser_telephone(telephone)
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


class Portefeuille(models.Model):
    """Un portefeuille appartient à un utilisateur et regroupe les actifs qu'il suit."""

    utilisateur = models.ForeignKey(
        "finance.User",
        on_delete=models.CASCADE,
        related_name="portefeuilles"
    )
    nom = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    devise = models.CharField(max_length=10, default="USD")
    actifs = models.ManyToManyField(
        "marches.Actif",
        through="Position",
        related_name="portefeuilles"
    )
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nom"]
        verbose_name = "Portefeuille"
        verbose_name_plural = "Portefeuilles"
        constraints = [
            models.UniqueConstraint(
                fields=["utilisateur", "nom"],
                name="portefeuille_nom_unique_par_utilisateur"
            )
        ]

    def __str__(self):
        return f"{self.nom} - {self.utilisateur}"


class Position(models.Model):
    """
    Un actif dans un portefeuille, avec une quantité facultative.
    Ce modèle ne représente pas une transaction financière.
    """

    portefeuille = models.ForeignKey(
        Portefeuille,
        on_delete=models.CASCADE,
        related_name="positions"
    )
    actif = models.ForeignKey(
        "marches.Actif",
        on_delete=models.CASCADE,
        related_name="positions"
    )
    quantite = models.DecimalField(
        max_digits=20,
        decimal_places=8,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.00000001"))],
        help_text="Quantité détenue (facultatif).",
    )
    date_ajout = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["actif__symbole"]
        constraints = [
            models.UniqueConstraint(
                fields=["portefeuille", "actif"],
                name="position_unique_portefeuille_actif"
            )
        ]

    def __str__(self):
        return f"{self.portefeuille.nom} - {self.actif.symbole}"
