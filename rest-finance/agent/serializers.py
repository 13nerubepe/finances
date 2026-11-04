from rest_framework import serializers

from .models import Explication


class ExplicationSerializer(serializers.ModelSerializer):
    symbole = serializers.CharField(source="pic.actif.symbole")
    date = serializers.DateField(source="pic.date")
    z = serializers.FloatField(source="pic.z")
    type_pic = serializers.CharField(source="pic.type_pic")

    class Meta:
        model = Explication
        fields = ["symbole", "date", "z", "type_pic", "texte", "sources", "modele", "date_creation"]
