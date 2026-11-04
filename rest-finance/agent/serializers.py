from rest_framework import serializers

from .models import Explication, Message


class ExplicationSerializer(serializers.ModelSerializer):
    symbole = serializers.CharField(source="pic.actif.symbole")
    date = serializers.DateField(source="pic.date")
    z = serializers.FloatField(source="pic.z")
    type_pic = serializers.CharField(source="pic.type_pic")

    class Meta:
        model = Explication
        fields = ["symbole", "date", "z", "type_pic", "texte", "sources", "modele", "date_creation"]

class QuestionSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=2000)
    symboles = serializers.ListField(child=serializers.CharField(max_length=20), required=False)
    dateDebut = serializers.DateField(required=False)
    dateFin = serializers.DateField(required=False)

# SourceSerializer et ReponseSerializer sont la juste pour document la reponse dans swagger
class SourceSerializer(serializers.Serializer):
    titre = serializers.CharField()
    url = serializers.CharField()
    type = serializers.CharField()


class ReponseSerializer(serializers.Serializer):
    reponse = serializers.CharField()
    dateCreation = serializers.DateTimeField()
    sources = SourceSerializer(many=True)


class MessageSerializer(serializers.ModelSerializer):
    dateCreation = serializers.DateTimeField(source="date_creation", read_only=True)

    class Meta:
        model = Message
        fields = ["id", "role", "contenu", "dateCreation"]
