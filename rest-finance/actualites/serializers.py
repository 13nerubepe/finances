
from rest_framework import serializers

from .models import Article, Source


class SourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Source
        fields = [
            "id",
            "nom",
            "url_flux",
            "actif",
            "derniere_collecte",
        ]


class ArticleSerializer(serializers.ModelSerializer):
    source_nom = serializers.CharField(
        source="source.nom",
        read_only=True,
    )

    class Meta:
        model = Article
        fields = [
            "id",
            "titre",
            "lien",
            "auteur",
            "contenu",
            "date_publication",
            "themes",
            "source",
            "source_nom",
        ]
