from django.db import models


class Explication(models.Model):
    """Explication d'un pic journalier, générée une seule fois par Gemini puis réutilisée (cache)."""

    pic = models.OneToOneField(
        "marches.IndicateurJournalier",
        on_delete=models.CASCADE,
        related_name="explication",
    )
    texte = models.TextField()
    sources = models.JSONField(default=list)
    modele = models.CharField(max_length=50)
    date_creation = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.pic.actif.symbole} {self.pic.date}"
