from decimal import Decimal

from django.contrib.auth.password_validation import validate_password
from django.db import IntegrityError
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from marches.models import Actif

from .models import Portefeuille, Position, User, normaliser_telephone, validateur_telephone


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
    phone = serializers.CharField(source="telephone", validators=[validateur_telephone])
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    class Meta:
        model = User
        fields = ["id", "first_name", "last_name", "email", "phone", "password"]
        read_only_fields = ["id"]

    def to_internal_value(self, data):
        # On ramène le numéro au format +2376XXXXXXXX
        data = data.copy()
        if isinstance(data.get("phone"), str):
            data["phone"] = normaliser_telephone(data["phone"])
        return super().to_internal_value(data)

    def validate_email(self, valeur):
        valeur = valeur.strip().lower()
        if User.objects.filter(email__iexact=valeur).exists():
            raise serializers.ValidationError("Cette adresse e-mail est déjà utilisée.")
        return valeur

    def validate_phone(self, valeur):
        if User.objects.filter(telephone=valeur).exists():
            raise serializers.ValidationError("Ce numéro de téléphone est déjà utilisé.")
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


class ConnexionSerializer(serializers.Serializer):
    # Le frontend se connecte avec l'e-mail, quel que soit USERNAME_FIELD.
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    access = serializers.CharField(read_only=True)
    refresh = serializers.CharField(read_only=True)
    utilisateur = UserSerializer(read_only=True)

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


class ModifierProfilSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(source="prenom", required=False)
    last_name = serializers.CharField(source="nom", required=False)
    phone = serializers.CharField(source="telephone", required=False, validators=[validateur_telephone])
    email = serializers.EmailField(required=False)

    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "phone"]

    def to_internal_value(self, data):
        data = data.copy()
        if isinstance(data.get("phone"), str):
            data["phone"] = normaliser_telephone(data["phone"])
        return super().to_internal_value(data)

    def validate_email(self, valeur):
        valeur = valeur.strip().lower()
        if User.objects.filter(email__iexact=valeur).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("Cette adresse e-mail est déjà utilisée.")
        return valeur

    def validate_phone(self, valeur):
        if User.objects.filter(telephone=valeur).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("Ce numéro de téléphone est déjà utilisé.")
        return valeur


class ChangerMotDePasseSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_current_password(self, valeur):
        if not self.context["request"].user.check_password(valeur):
            raise serializers.ValidationError("Le mot de passe actuel est incorrect.")
        return valeur

    def validate_new_password(self, valeur):
        validate_password(valeur, user=self.context["request"].user)
        return valeur


class PositionSerializer(serializers.ModelSerializer):
    """Un actif dans un portefeuille. Seule la quantité peut être modifiée."""

    symbole = serializers.CharField(source="actif.symbole", read_only=True)
    nom = serializers.CharField(source="actif.nom", read_only=True)
    type_actif = serializers.CharField(source="actif.type_actif", read_only=True)

    class Meta:
        model = Position
        fields = ["symbole", "nom", "type_actif", "quantite", "date_ajout"]
        read_only_fields = ["date_ajout"]
        extra_kwargs = {"quantite": {"coerce_to_string": False}}


class PortefeuilleSerializer(serializers.ModelSerializer):
    nb_actifs = serializers.SerializerMethodField()

    class Meta:
        model = Portefeuille
        fields = ["id", "nom", "description", "devise", "date_creation", "nb_actifs"]
        read_only_fields = ["id", "date_creation"]

    def get_nb_actifs(self, portefeuille) -> int:
        # La liste fournit déjà le nombre (annotation) ; sinon on le compte.
        nombre = getattr(portefeuille, "nb_actifs", None)
        return nombre if nombre is not None else portefeuille.positions.count()

    def validate_nom(self, nom):
        utilisateur = self.context["request"].user
        doublons = Portefeuille.objects.filter(utilisateur=utilisateur, nom__iexact=nom)
        if self.instance:
            doublons = doublons.exclude(pk=self.instance.pk)
        if doublons.exists():
            raise serializers.ValidationError("Tu as déjà un portefeuille avec ce nom.")
        return nom


class PortefeuilleDetailSerializer(PortefeuilleSerializer):
    actifs = PositionSerializer(source="positions", many=True, read_only=True)

    class Meta(PortefeuilleSerializer.Meta):
        fields = PortefeuilleSerializer.Meta.fields + ["actifs"]


class AjoutActifSerializer(serializers.Serializer):
    symbole = serializers.CharField(help_text="Symbole de l'actif, ex. AAPL ou BTC-USD.")
    quantite = serializers.DecimalField(
        max_digits=20,
        decimal_places=8,
        min_value=Decimal("0.00000001"),
        required=False,
        allow_null=True,
        help_text="Quantité détenue (facultatif).",
    )

    def validate_symbole(self, symbole):
        try:
            return Actif.objects.get(symbole__iexact=symbole.strip())
        except Actif.DoesNotExist:
            raise serializers.ValidationError(f"Actif inconnu : {symbole}.")

    def validate(self, donnees):
        portefeuille = self.context["portefeuille"]
        if portefeuille.positions.filter(actif=donnees["symbole"]).exists():
            raise serializers.ValidationError({"symbole": "Cet actif est déjà dans le portefeuille."})
        return donnees

    def create(self, donnees_validees):
        try:
            return Position.objects.create(
                portefeuille=self.context["portefeuille"],
                actif=donnees_validees["symbole"],
                quantite=donnees_validees.get("quantite"),
            )
        except IntegrityError:
            raise serializers.ValidationError({"symbole": "Cet actif est déjà dans le portefeuille."})
