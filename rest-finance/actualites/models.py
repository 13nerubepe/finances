from django.db import models

# Create your models here.
class Source(models.Model):
    nom = models.CharField(max_length=200, unique=True)
    url_flux = models.URLField(max_length=1000)
    actif = models.BooleanField(default=True)
    derniere_collecte = models.DateTimeField(
        null=True,
        blank=True,
    )
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nom"]
        verbose_name = "Source RSS"
        verbose_name_plural = "Sources RSS"

    def __str__(self):
        return self.nom


class Article(models.Model):
    source = models.ForeignKey(
        Source,
        on_delete=models.CASCADE,
        related_name="articles",
    )
    titre = models.CharField(max_length=500)
    lien = models.URLField(max_length=1000, unique=True)
    auteur = models.CharField(max_length=200, blank=True)
    contenu = models.TextField(blank=True)
    date_publication = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
    )
    themes = models.JSONField(default=list, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    pics = models.ManyToManyField(
        "marches.IndicateurJournalier",
        blank=True,
        related_name="articles",
    )


    class Meta:
        ordering = ["-date_publication", "-date_creation"]
        verbose_name = "Article financier"
        verbose_name_plural = "Articles financiers"

    def __str__(self):
        return self.titre
