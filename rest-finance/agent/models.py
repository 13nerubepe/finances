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

class Message(models.Model):
    """Un message de la conversation entre un utilisateur et l'assistant IA."""

    class Role(models.TextChoices):
        UTILISATEUR = "user", "Utilisateur"
        ASSISTANT = "assistant", "Assistant"

    utilisateur = models.ForeignKey(
        "finance.User",
        on_delete=models.CASCADE,
        related_name="messages_assistant",
    )
    role = models.CharField(max_length=10, choices=Role.choices)
    contenu = models.TextField()
    sources = models.JSONField(default=list, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date_creation", "id"]

    def __str__(self):
        return f"{self.utilisateur} ({self.role}) : {self.contenu[:50]}"

class Resume(models.Model):
    """Résumé des anciens messages d'un utilisateur : l'agent garde le contexte au-delà des derniers messages."""

    utilisateur = models.OneToOneField(
        "finance.User",
        on_delete=models.CASCADE,
        related_name="resume_assistant",
    )
    texte = models.TextField(blank=True)
    dernier_message_id = models.PositiveBigIntegerField(default=0)  # messages déjà inclus dans le résumé
    date_modification = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Résumé de {self.utilisateur}"

