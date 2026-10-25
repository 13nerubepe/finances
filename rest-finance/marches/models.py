from django.db import models

# Create your models here.

class Actif(models.Model):
    class TypeActif(models.TextChoices):
        ACTION = "action", "Action"
        INDICE = "indice", "Indice"
        CRYPTO = "crypto", "Cryptomonnaie"

    symbole = models.CharField(max_length=20, unique=True)  # AAPL, ^GSPC, BTC-USD par exemple
    nom = models.CharField(max_length=100)
    type_actif = models.CharField(max_length=10, choices=TypeActif.choices)
    devise = models.CharField(max_length=10, default="USD")
    est_suivi = models.BooleanField(
        default=True, help_text="Si décoché, l'ingestion ignore cet actif."
    )
    indice_reference = models.ForeignKey(
                "self", null=True, blank=True, on_delete=models.SET_NULL
            )

    class Meta:
        ordering = ["symbole"]
        

    def __str__(self):
        return f"{self.symbole} - {self.nom}"


class CoursHistorique(models.Model):
    """Toutes les 5 minutes pour un actif."""

    actif = models.ForeignKey(Actif, on_delete=models.CASCADE, related_name="cours")
    horodatage = models.DateTimeField()
    open = models.FloatField()
    high = models.FloatField()
    low = models.FloatField()
    close = models.FloatField()
    volume = models.BigIntegerField(default=0)

    class Meta:
        ordering = ["actif", "horodatage"]
        verbose_name = "cours historique"
        verbose_name_plural = "cours historiques"
        constraints = [
            models.UniqueConstraint(
                fields=["actif", "horodatage"], name="cours_unique_par_actif_et_horodatage"
            )
        ]

    def __str__(self):
        return f"{self.actif.symbole} {self.horodatage:%Y-%m-%d %H:%M} close={self.close}"

class CoursJournalier(models.Model):
    actif = models.ForeignKey(Actif, on_delete=models.CASCADE, related_name="cours_journaliers")
    date = models.DateField()
    open = models.FloatField()
    high = models.FloatField()
    low = models.FloatField()
    close = models.FloatField()
    volume = models.BigIntegerField(default=0)

    class Meta:
        ordering = ["actif","date"]
        unique_together = ["actif","date"]

    def __str__(self):
        return f"{self.actif.symbole} {self.date} open={self.open} close={self.close}"