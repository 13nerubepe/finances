from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


class UserSerializer(serializers.ModelSerializer):

    class Meta:
        model = User
        fields = ["id", "nom", "prenom", "telephone", "date_creation"]
        read_only_fields = fields


class InscriptionSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    class Meta:
        model = User
        fields = ["id", "nom", "prenom", "telephone", "password"]
        read_only_fields = ["id"]

    def to_internal_value(self, data):
        # on met le numéro de téléphone au bon format (retirer les espaces si nécessaire)
        data = data.copy()
        if isinstance(data.get("telephone"), str):
            data["telephone"] = data["telephone"].replace(" ", "")
        return super().to_internal_value(data)

    def validate(self, donnees):
        # On passe un user temporaire pour que le validateur "similarité" fonctionne (par contre ca, je n'ai pas très bien compris)
        user_temporaire = User(
            nom=donnees.get("nom", ""),
            prenom=donnees.get("prenom", ""),
            telephone=donnees.get("telephone", ""),
        )
        validate_password(donnees["password"], user=user_temporaire)
        return donnees

    def create(self, donnees_validees):
        return User.objects.create_user(**donnees_validees)


class ConnexionSerializer(TokenObtainPairSerializer):

    def validate(self, attrs):
        donnees = super().validate(attrs)
        donnees["utilisateur"] = UserSerializer(self.user).data
        return donnees


class DeconnexionSerializer(serializers.Serializer):
    refresh = serializers.CharField()