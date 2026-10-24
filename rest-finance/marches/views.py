from django.shortcuts import render

# Create your views here.
from datetime import timedelta

from django.db.models import Max
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema
from rest_framework import generics
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.filters import SearchFilter
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ReadOnlyModelViewSet

from . import indicateurs
from .filters import CoursFilter
from .models import Actif, CoursHistorique
from .pagination import PaginationCours
from .serializers import (
    ActifSerializer,
    CorrelationsReponseSerializer,
    CoursSerializer,
    ParametresCorrelationsSerializer,
    ParametresPicsSerializer,
    ParametresVolatiliteSerializer,
    PicsReponseSerializer,
    VolatiliteReponseSerializer,
)

PERIODE_PAR_DEFAUT = timedelta(days=7)
CHAMPS_BOUGIE = ("horodatage", "open", "high", "low", "close", "volume")


def _periode(debut, fin, derniere_bougie):
    """Si 'fin' est absente : dernière bougie disponible. Si 'debut' est absent : 7 jours avant 'fin'."""
    if fin is None:
        fin = derniere_bougie
    if debut is None and fin is not None:
        debut = fin - PERIODE_PAR_DEFAUT
    return debut, fin


def _charger(actif, debut, fin, frequence):
    """Lit les bougies d'un actif sur la période et les regroupe selon la fréquence.
    Renvoie (tableau, debut_applique, fin_appliquee)."""
    bougies = actif.cours.all()
    derniere = bougies.aggregate(derniere=Max("horodatage"))["derniere"]
    debut, fin = _periode(debut, fin, derniere)
    if fin is None:  # l'actif n'a aucun cours
        return indicateurs.tableau_vide(), None, None

    bougies = bougies.filter(horodatage__gte=debut, horodatage__lte=fin)
    if bougies.count() > indicateurs.MAX_BOUGIES:
        raise ValidationError(
            {"debut": "Période trop longue : réduis la période demandée (resserre 'debut' et 'fin')."}
        )
    lignes = bougies.order_by("horodatage").values_list(*CHAMPS_BOUGIE)
    tableau = indicateurs.bougies_en_tableau(lignes)
    return indicateurs.regrouper(tableau, frequence), debut, fin


def _parametres(serializer_class, request):
    serializer = serializer_class(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


class ActifViewSet(ReadOnlyModelViewSet):
    """Liste des actifs et indicateurs de volatilité par actif."""

    queryset = Actif.objects.all()
    serializer_class = ActifSerializer
    lookup_field = "symbole"
    lookup_value_regex = r"[^/]+"  # accepte ^GSPC, BTC-USD, BRK.B...
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["type_actif", "est_suivi"]
    search_fields = ["symbole", "nom"]
    pagination_class = None  # liste courte : pas de pagination

    def get_object(self):
        # Le symbole est reconnu quelle que soit la casse : /actifs/aapl/ = /actifs/AAPL/
        return get_object_or_404(self.get_queryset(), symbole__iexact=self.kwargs["symbole"])

    @extend_schema(
        parameters=[ParametresVolatiliteSerializer], responses=VolatiliteReponseSerializer
    )
    @action(detail=True, methods=["get"], url_path="volatilite")
    def volatilite(self, request, symbole=None):
        """Rendement, volatilité glissante et amplitude de chaque bougie, plus un résumé."""
        actif = self.get_object()
        p = _parametres(ParametresVolatiliteSerializer, request)
        df, debut, fin = _charger(actif, p.get("debut"), p.get("fin"), p["frequence"])

        reponse = {
            "actif": actif.symbole,
            "fenetre": p["fenetre"],
            "frequence": p["frequence"],
            "debut": debut,
            "fin": fin,
        }
        if df.empty:
            return Response({**reponse, "resume": indicateurs.resume_vide(), "serie": []})

        resultat = indicateurs.calculer_volatilite(df, p["fenetre"])
        reponse["resume"] = indicateurs.resumer(df, resultat)
        reponse["serie"] = indicateurs.serie_json(resultat)
        return Response(reponse)

    @extend_schema(parameters=[ParametresPicsSerializer], responses=PicsReponseSerializer)
    @action(detail=True, methods=["get"], url_path="pics")
    def pics(self, request, symbole=None):
        """Périodes de volatilité inhabituelle (utile pour l'agent qui cherche le contexte)."""
        actif = self.get_object()
        p = _parametres(ParametresPicsSerializer, request)
        df, debut, fin = _charger(actif, p.get("debut"), p.get("fin"), p["frequence"])

        reponse = {
            "actif": actif.symbole,
            "fenetre": p["fenetre"],
            "frequence": p["frequence"],
            "seuil": p["seuil"],
            "debut": debut,
            "fin": fin,
        }
        if df.empty:
            return Response({**reponse, "moyenne": None, "ecart_type": None, "limite": None, "pics": []})

        resultat = indicateurs.calculer_volatilite(df, p["fenetre"])
        reponse.update(indicateurs.detecter_pics(resultat, p["seuil"]))
        return Response(reponse)


class CoursListView(generics.ListAPIView):
    """Séries temporelles des cours, filtrables par actif et par période."""

    queryset = CoursHistorique.objects.select_related("actif")
    serializer_class = CoursSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = CoursFilter
    pagination_class = PaginationCours


class CorrelationsView(APIView):
    @extend_schema(
        parameters=[ParametresCorrelationsSerializer], responses=CorrelationsReponseSerializer
    )
    def get(self, request):
        """Matrice de corrélations entre les rendements de plusieurs actifs."""
        p = _parametres(ParametresCorrelationsSerializer, request)
        symboles = p["actifs"]

        connus = {a.symbole.upper(): a for a in Actif.objects.all()}
        inconnus = [s for s in symboles if s not in connus]
        if inconnus:
            raise ValidationError({"actifs": f"Actif(s) inconnu(s) : {', '.join(inconnus)}."})
        actifs = [connus[s] for s in symboles]

        # Période commune à tous les actifs
        derniere = CoursHistorique.objects.filter(actif__in=actifs).aggregate(
            derniere=Max("horodatage")
        )["derniere"]
        debut, fin = _periode(p.get("debut"), p.get("fin"), derniere)

        series = {}
        for actif in actifs:
            if fin is None:
                series[actif.symbole] = indicateurs.tableau_vide()["close"]
                continue
            df, _, _ = _charger(actif, debut, fin, p["frequence"])
            series[actif.symbole] = df["close"]

        correlations, observations = indicateurs.calculer_correlations(series)
        return Response(
            {
                "actifs": [a.symbole for a in actifs],
                "frequence": p["frequence"],
                "debut": debut,
                "fin": fin,
                "correlations": correlations,
                "observations": observations,
            }
        )