from django.db import models

# Create your models here.


class SynchronisationYahoo(models.Model):

    class Statut(models.TextChoices):
        EN_ATTENTE = "en_attente", "En attente"
        EN_COURS = "en_cours", "En cours"
        TERMINE = "termine", "Terminé"
        ECHEC = "echec", "Échec"

    categorie = models.CharField(max_length=30)
    marche = models.CharField(max_length=50)

    date_debut = models.DateTimeField(auto_now_add=True)
    date_fin = models.DateTimeField(null=True, blank=True)

    statut = models.CharField(
        max_length=20,
        choices=Statut.choices,
        default=Statut.EN_ATTENTE
    )

    actifs_decouverts = models.PositiveIntegerField(default=0)
    actifs_crees = models.PositiveIntegerField(default=0)
    actifs_actualises = models.PositiveIntegerField(default=0)

    erreur = models.TextField(blank=True)

    class Meta:
        ordering = ["-date_debut"]
        verbose_name = "synchronisation Yahoo"
        verbose_name_plural = "synchronisations Yahoo"

    def __str__(self):
        return f"{self.categorie} - {self.marche} - {self.statut}"

