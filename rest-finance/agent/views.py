from datetime import date

from drf_spectacular.utils import extend_schema
from google.genai import errors
from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from marches.models import IndicateurJournalier

from .serializers import ExplicationSerializer
from .services import expliquer_pic


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
