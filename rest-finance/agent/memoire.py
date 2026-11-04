"""Mémoire de l'assistant : un résumé glissant des anciens messages + les messages récents mot pour mot."""

from google import genai

from .models import Message, Resume
from .services import MODELE

TAILLE_FENETRE = 10  # messages récents toujours envoyés tels quels à l'agent
SEUIL_RESUME = 20    # à 20 messages non résumés, on résume les plus anciens pour n'en garder que 10

CONSIGNES_RESUME = """Tu tiens la mémoire d'un assistant d'analyse financière.
Voici le résumé actuel de la conversation et des messages plus récents.
Écris le nouveau résumé, en français, en 15 lignes maximum.
Garde absolument : les actifs et les dates évoqués, les chiffres cités (variations, z-scores),
les causes identifiées avec leurs sources, les préférences de l'utilisateur et les questions restées ouvertes.
Supprime les formules de politesse et les répétitions.

Résumé actuel :
{resume}

Messages à intégrer :
{messages}"""


def resumer(ancien_resume, messages):
    """Demande à Gemini un nouveau résumé qui intègre l'ancien et les messages donnés."""
    texte_messages = "\n".join(f"{m.role} : {m.contenu}" for m in messages)
    client = genai.Client()
    reponse = client.models.generate_content(
        model=MODELE,
        contents=CONSIGNES_RESUME.format(resume=ancien_resume or "(aucun)", messages=texte_messages),
    )
    return reponse.text


def contexte_conversation(utilisateur):
    """Renvoie (résumé, messages non résumés) : à eux deux, ils couvrent toute la conversation."""
    resume, _ = Resume.objects.get_or_create(utilisateur=utilisateur)
    non_resumes = list(
        Message.objects.filter(utilisateur=utilisateur, id__gt=resume.dernier_message_id).order_by("id")
    )

    if len(non_resumes) >= SEUIL_RESUME:
        a_resumer = non_resumes[:-TAILLE_FENETRE]
        resume.texte = resumer(resume.texte, a_resumer)
        resume.dernier_message_id = a_resumer[-1].id
        resume.save()
        non_resumes = non_resumes[-TAILLE_FENETRE:]

    return resume.texte, [(m.role, m.contenu) for m in non_resumes]
