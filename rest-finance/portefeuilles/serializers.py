from decimal import Decimal

from django.db import IntegrityError
from rest_framework import serializers

from marches.models import Actif

from .models import Portefeuille, PortefeuilleActif


class LigneSerializer(serializers.ModelSerializer):
    "Un actif dans un portefeuille. Seule la quantité peut être modifiée"

    symbole = serializers.CharField(source="actif.symbole", read_only=True)
    nom = serializers.CharField(source="actif.nom", read_only=True)
    type_actif = serializers.CharField(source="actif.type_actif", read_only=True)

    class Meta:
        model = PortefeuilleActif
        fields = ["symbole", "nom", "type_actif", "quantite", "date_ajout"]
        read_only_fields = ["date_ajout"]
        extra_kwargs = {"quantite": {"coerce_to_string": False}}


class PortefeuilleSerializer(serializers.ModelSerializer):
    nb_actifs = serializers.SerializerMethodField()

    class Meta:
        model = Portefeuille
        fields = ["id", "nom", "date_creation", "nb_actifs"]
        read_only_fields = ["date_creation"]

    def get_nb_actifs(self, portefeuille) -> int:
        # La liste fournit déjà le nombre (annotation) ; sinon on le compte.
        nombre = getattr(portefeuille, "nb_actifs", None)
        return nombre if nombre is not None else portefeuille.lignes.count()

    def validate_nom(self, nom):
        utilisateur = self.context["request"].user
        doublons = Portefeuille.objects.filter(proprietaire=utilisateur, nom__iexact=nom)
        if self.instance:
            doublons = doublons.exclude(pk=self.instance.pk)
        if doublons.exists():
            raise serializers.ValidationError("Tu as déjà un portefeuille avec ce nom.")
        return nom


class PortefeuilleDetailSerializer(PortefeuilleSerializer):
    actifs = LigneSerializer(source="lignes", many=True, read_only=True)

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
        if portefeuille.lignes.filter(actif=donnees["symbole"]).exists():
            raise serializers.ValidationError(
                {"symbole": "Cet actif est déjà dans le portefeuille."}
            )
        return donnees

    def create(self, donnees_validees):
        try:
            return PortefeuilleActif.objects.create(
                portefeuille=self.context["portefeuille"],
                actif=donnees_validees["symbole"],
                quantite=donnees_validees.get("quantite"),
            )
        except IntegrityError:
            raise serializers.ValidationError(
                {"symbole": "Cet actif est déjà dans le portefeuille."}
            )