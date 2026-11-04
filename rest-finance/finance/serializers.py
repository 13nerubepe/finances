from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken


from .models import User, normaliser_telephone, Portefeuille

class PortefeuilleSerializer(serializers.ModelSerializer):
    actifs = serializers.SlugRelatedField(many=True, read_only=True, slug_field="symbole")

    class Meta:
        model = Portefeuille
        fields = ["id", "nom", "description", "devise", "actifs", "date_creation"]
        read_only_fields = ["id", "date_creation"]


class PositionSerializer(serializers.Serializer):
    symbole = serializers.CharField()


class UserSerializer(serializers.ModelSerializer):
    # Noms attendus par le frontend, reliés aux champs du modèle
    first_name = serializers.CharField(source="prenom", read_only=True)
    last_name = serializers.CharField(source="nom", read_only=True)
    phone = serializers.CharField(source="telephone", read_only=True)

    class Meta:
        model = User
        fields = ["id", "first_name", "last_name", "email", "phone", "date_creation"]
        read_only_fields = fields


class InscriptionSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(source="prenom")
    last_name = serializers.CharField(source="nom")
    phone = serializers.CharField(source="telephone")
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    class Meta:
        model = User
        fields = ["id", "first_name", "last_name", "email", "phone", "password"]
        read_only_fields = ["id"]

    def to_internal_value(self, data):
        # On retire les espaces du numéro de téléphone
        data = data.copy()
        if isinstance(data.get("phone"), str):
            data["phone"] = data["phone"].replace(" ", "")
        return super().to_internal_value(data)

    def validate_email(self, valeur):
        valeur = valeur.strip().lower()
        if User.objects.filter(email__iexact=valeur).exists():
            raise serializers.ValidationError("Cette adresse e-mail est déjà utilisée.")
        return valeur

    def validate(self, donnees):
        # Après "source", les données utilisent les noms du modèle : prenom, nom, telephone.
        user_temporaire = User(
            nom=donnees.get("nom", ""),
            prenom=donnees.get("prenom", ""),
            telephone=donnees.get("telephone", ""),
            email=donnees.get("email", ""),
        )
        validate_password(donnees["password"], user=user_temporaire)
        return donnees

    def create(self, donnees_validees):
        return User.objects.create_user(**donnees_validees)


class ConnexionSerializer(TokenObtainPairSerializer):

# class ConnexionSerializer(serializers.Serializer):
#     # Le frontend se connecte avec l'e-mail, quel que soit USERNAME_FIELD.
#     email = serializers.EmailField(write_only=True)
#     password = serializers.CharField(write_only=True, style={"input_type": "password"})
#     access = serializers.CharField(read_only=True)
#     refresh = serializers.CharField(read_only=True)
#     utilisateur = UserSerializer(read_only=True)

    def validate(self, attrs):
        user = User.objects.filter(email__iexact=attrs["email"].strip()).first()

        if user is None or not user.is_active or not user.check_password(attrs["password"]):
            raise serializers.ValidationError("E-mail ou mot de passe incorrect.")

        refresh = RefreshToken.for_user(user)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "utilisateur": UserSerializer(user).data,
        }