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
#         unique_together = ["actif","date"]
        constraints = [
            models.UniqueConstraint(
                fields=["actif", "date"],
                name="cours_journalier_unique_par_actif_date"
            )
        ]


    def __str__(self):
        return f"{self.actif.symbole} {self.date} open={self.open} close={self.close}"

class IndicateurJournalier(models.Model):
    class TypePic(models.TextChoices):
        SPECIFIQUE = "specifique","Spécifique"
        SYSTEMIQUE = "systemique","Systémique"

    actif = models.ForeignKey(Actif, on_delete=models.CASCADE, related_name="indicateurs")
    date = models.DateField()
    rendement = models.FloatField(null=True,blank=True)
    volatilite = models.FloatField(null=True,blank=True)
    volatilite_annuelle = models.FloatField(null=True,blank=True)
    parkinson = models.FloatField(null=True, blank=True)

    z = models.FloatField(null=True,blank=True)
    z_volume = models.FloatField(null=True,blank=True)
    gap = models.FloatField(null=True,blank=True)
    beta = models.FloatField(null=True,blank=True)
    rendement_anormal = models.FloatField(null=True,blank=True)     
    z_anormal = models.FloatField(null=True,blank=True)
    est_pic = models.BooleanField(default=False)
    type_pic = models.CharField(max_length=20,
                                    choices=TypePic.choices,
                                    blank=True,
                                    default="")

    class Meta:
        ordering = ["actif","date"]
#         unique_together = ["actif","date"] # Logique, on doit avoir un seul rendement par actif par jour
        constraints = [
            models.UniqueConstraint(
                fields=["actif", "date"],
                name="indicateur_unique_par_actif_date"
            )
        ]

    def __str__(self):
        pic = "  - est PIC" if self.est_pic else ""
        return f"{self.actif} - {self.date} - z = {self.z} {pic}"


#     class CorrelationActif(models.Model):
#         """Corrélation entre deux actifs sur une période."""
#
#         actif_1 = models.ForeignKey(
#             Actif,
#             on_delete=models.CASCADE,
#             related_name="correlations_comme_actif_1"
#         )
#
#         actif_2 = models.ForeignKey(
#             Actif,
#             on_delete=models.CASCADE,
#             related_name="correlations_comme_actif_2"
#         )
#
#         date_debut = models.DateField()
#         date_fin = models.DateField()
#
#         coefficient = models.FloatField()
#         nombre_observations = models.PositiveIntegerField(default=0)
#
#         date_calcul = models.DateTimeField(auto_now=True)
#
#         class Meta:
#             ordering = ["-date_calcul"]
#             constraints = [
#                 models.UniqueConstraint(
#                     fields=["actif_1", "actif_2", "date_debut", "date_fin"],
#                     name="correlation_unique_periode"
#                 )
#             ]
#
#         def __str__(self):
#             return (
#                 f"{self.actif_1.symbole} / {self.actif_2.symbole} "
#                 f"= {self.coefficient}"
#             )
#
#
#     class MouvementInhabituel(models.Model):
#
#         class TypeMouvement(models.TextChoices):
#             VOLATILITE = "volatilite", "Pic de volatilité"
#             PRIX = "prix", "Variation inhabituelle du prix"
#             VOLUME = "volume", "Volume inhabituel"
#             GAP = "gap", "Écart de cours"
#
#         class Niveau(models.TextChoices):
#             FAIBLE = "faible", "Faible"
#             MOYEN = "moyen", "Moyen"
#             ELEVE = "eleve", "Élevé"
#             CRITIQUE = "critique", "Critique"
#
#         actif = models.ForeignKey(
#             Actif,
#             on_delete=models.CASCADE,
#             related_name="mouvements"
#         )
#
#         type_mouvement = models.CharField(
#             max_length=20,
#             choices=TypeMouvement.choices
#         )
#
#         niveau = models.CharField(
#             max_length=20,
#             choices=Niveau.choices
#         )
#
#         date_detection = models.DateTimeField()
#         valeur_observee = models.FloatField(null=True, blank=True)
#         valeur_reference = models.FloatField(null=True, blank=True)
#         score_anomalie = models.FloatField(null=True, blank=True)
#
#         description = models.TextField(blank=True)
#         est_analyse = models.BooleanField(default=False)
#
#         class Meta:
#             ordering = ["-date_detection"]
#
#         def __str__(self):
#             return (
#                 f"{self.actif.symbole} - "
#                 f"{self.type_mouvement} - {self.niveau}"
#             )