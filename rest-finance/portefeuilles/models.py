from django.db import models

# Create your models here.
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class Portefeuille(models.Model):
    "Un portefeuille appartient a un utilisateur et contient des actifs"

    proprietaire = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="portefeuilles"
    )
    nom = models.CharField(max_length=100)
    date_creation = models.DateTimeField(auto_now_add=True)
    actifs = models.ManyToManyField(
        "marches.Actif", through="PortefeuilleActif", related_name="portefeuilles"
    )

    class Meta:
        ordering = ["nom"]
        constraints = [
            models.UniqueConstraint(
                fields=["proprietaire", "nom"], name="portefeuille_nom_unique_par_utilisateur"
            )
        ]

    def __str__(self):
        return f"{self.nom} ({self.proprietaire})"


class PortefeuilleActif(models.Model):
    """Ligne d'un portefeuille : un actif, la date d'ajout et une quantité facultative."""

    portefeuille = models.ForeignKey(Portefeuille, on_delete=models.CASCADE, related_name="lignes")
    actif = models.ForeignKey("marches.Actif", on_delete=models.CASCADE, related_name="lignes")
    date_ajout = models.DateTimeField(auto_now_add=True)
    quantite = models.DecimalField(
        max_digits=20,
        decimal_places=8,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.00000001"))],
        help_text="Quantité détenue (facultatif).",
    )

    class Meta:
        ordering = ["actif__symbole"]
        verbose_name = "actif du portefeuille"
        verbose_name_plural = "actifs du portefeuille"
        constraints = [
            models.UniqueConstraint(
                fields=["portefeuille", "actif"], name="actif_unique_par_portefeuille"
            )
        ]

    def __str__(self):
        return f"{self.portefeuille.nom} : {self.actif.symbole}"