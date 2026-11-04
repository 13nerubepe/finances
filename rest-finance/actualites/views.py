from django.shortcuts import render


from rest_framework import viewsets, filters

from .models import Article, Source
from .serializers import ArticleSerializer, SourceSerializer


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

        return queryset


class SourceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Source.objects.all()
    serializer_class = SourceSerializer

