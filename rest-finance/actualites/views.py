import re

from django.db.models import Q
from rest_framework import filters, viewsets

from marches.models import Actif

from .models import Article, Source
from .serializers import ArticleSerializer, SourceSerializer

SUFFIXES_NOM = re.compile(
    r"[\s,]+(inc\.?|corp\.?|corporation|co\.?|company|ltd\.?|limited|plc|s\.?a\.?|usd)$",
    re.IGNORECASE,
)


def nom_court(nom):
    resultat = nom.strip()
    while True:
        nettoye = SUFFIXES_NOM.sub("", resultat).strip()
        if nettoye == resultat:
            return resultat
        resultat = nettoye


class ArticleViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ArticleSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["titre", "contenu", "source__nom"]
    ordering_fields = ["date_publication", "date_creation"]

    def get_queryset(self):
        queryset = Article.objects.select_related("source")

        theme = self.request.query_params.get("theme")
        if theme:
            queryset = queryset.filter(themes__contains=[theme])

        symbole = self.request.query_params.get("symbole")
        if symbole:
            actif = Actif.objects.filter(symbole__iexact=symbole).first()
            if not actif:
                return queryset.none()

            nom = nom_court(actif.nom)
            queryset = queryset.filter(
                Q(source__nom=f"Yahoo Finance - {actif.symbole}")
                | Q(source__nom=f"Yahoo Finance - {nom}")
                | Q(titre__icontains=nom)
            )

        return queryset


class SourceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Source.objects.all()
    serializer_class = SourceSerializer