from datetime import date

from drf_spectacular.utils import extend_schema
from google.genai import errors
from rest_framework import generics, status
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from marches.models import IndicateurJournalier

from .graphe import decrire_portefeuilles, repondre
from .models import Message
from .serializers import (
    ExplicationSerializer,
    MessageSerializer,
    QuestionSerializer,
    ReponseSerializer,
)
from .services import expliquer_pic

NB_MESSAGES_MEMOIRE = 10  # derniers messages renvoyés à l'agent pour qu'il suive la conversation

class ExplicationPicView(APIView):
    """Explication d'un pic journalier : générée au premier appel, puis lue en base."""

    @extend_schema(responses=ExplicationSerializer)
    def get(self, request, symbole, jour):
        try:
            jour = date.fromisoformat(jour)
        except ValueError:
            return Response({"detail": "Date attendue au format AAAA-MM-JJ."}, status=status.HTTP_400_BAD_REQUEST)

        pic = get_object_or_404(IndicateurJournalier, actif__symbole=symbole.upper(), date=jour, est_pic=True)
        try:
            explication = expliquer_pic(pic)
        except errors.APIError as erreur:
            return Response({"detail": f"Erreur de l'IA : {erreur}"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(ExplicationSerializer(explication).data)


def construire_question(donnees):
    """Ajoute à la question les actifs et la période choisis dans l'interface."""
    question = donnees["message"]
    if donnees.get("symboles"):
        question += f"\n(Actifs concernés : {', '.join(donnees['symboles'])}.)"
    if donnees.get("dateDebut") or donnees.get("dateFin"):
        question += f"\n(Période : du {donnees.get('dateDebut', '...')} au {donnees.get('dateFin', '...')}.)"
    return question


class QuestionAssistantView(APIView):
    """Pose une question à l'assistant IA ; la question et la réponse sont enregistrées."""

    @extend_schema(request=QuestionSerializer, responses=ReponseSerializer)
    def post(self, request):
        serializer = QuestionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        derniers = Message.objects.filter(utilisateur=request.user).order_by("-date_creation", "-id")
        historique = [(m.role, m.contenu) for m in reversed(list(derniers[:NB_MESSAGES_MEMOIRE]))]

        try:
            resultat = repondre(
                construire_question(serializer.validated_data),
                historique,
                decrire_portefeuilles(request.user),
            )
        except Exception as erreur:  # quota Gemini, réseau... : on prévient le front sans planter
            return Response(
                {"detail": f"L'assistant est indisponible : {erreur}"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        Message.objects.create(
            utilisateur=request.user,
            role=Message.Role.UTILISATEUR,
            contenu=serializer.validated_data["message"],
        )
        reponse = Message.objects.create(
            utilisateur=request.user,
            role=Message.Role.ASSISTANT,
            contenu=resultat["reponse"],
            sources=resultat["sources"],
        )
        return Response({
            "reponse": reponse.contenu,
            "dateCreation": reponse.date_creation,
            "sources": reponse.sources,
        })


class HistoriqueAssistantView(generics.ListAPIView):
    """Conversation de l'utilisateur connecté avec l'assistant, du plus ancien au plus récent."""

    serializer_class = MessageSerializer
    pagination_class = None

    def get_queryset(self):
        return Message.objects.filter(utilisateur=self.request.user)

