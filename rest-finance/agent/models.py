from django.db import models

# Create your models here.
class Analysis(models.Model):
    asset = models.CharField(max_length=10)
    date = models.DateField()
    close = models.FloatField()
    previous_close = models.FloatField()
    change_pct = models.FloatField()
    analysis = models.TextField()
    sources =models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints=[
            models.UniqueConstraint(fields=["date", "asset"], 
                                     name="unique_asset_date_analyse") #Une analyse doit etre unique par asset et par date
        ]

    def __str__(self):
        return f"{self.asset} {self.date} ({self.change_pct} %)"
