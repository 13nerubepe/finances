from rest_framework import serializers

from .indicateurs import FREQUENCES
from .models import Actif, CoursHistorique


class ActifSerializer(serializers.ModelSerializer):
    prix_actuel = serializers.SerializerMethodField()
    variation = serializers.SerializerMethodField()
    trend = serializers.SerializerMethodField()

    class Meta:
        model = Actif
        fields = ["id","symbole","nom","type_actif","devise","est_suivi","prix_actuel","variation","trend",]

#     def get_dernieres_bougies(self, obj):
#         if not hasattr(obj, "_dernieres_bougies_cache"):
#             obj._dernieres_bougies_cache = list(
#                 CoursHistorique.objects.filter(actif=obj)
#                 .order_by("-horodatage")[:2]
#             )
#         return obj._dernieres_bougies_cache

    def get_prix_actuel(self, obj):
        prix = obj.prix_actuel_db

        return float(prix) if prix is not None else None


    def get_variation(self, obj):
        dernier = obj.prix_actuel_db
        precedent = obj.prix_precedent_db

        if dernier is None or precedent is None or precedent == 0:
            return None

        variation = ((dernier - precedent) / precedent) * 100

        return round(float(variation), 2)


    def get_trend(self, obj):
        variation = self.get_variation(obj)

        if variation is None or variation == 0:
            return "stable"

        return "up" if variation > 0 else "down"


class CoursSerializer(serializers.ModelSerializer):
    actif = serializers.CharField(source="actif.symbole", read_only=True)

    class Meta:
        model = CoursHistorique
        fields = ["actif", "horodatage", "open", "high", "low", "close", "volume"]


# ---------- Paramètres de requête (validation) ----------
class PeriodeSerializer(serializers.Serializer):
    frequence = serializers.ChoiceField(
        choices=list(FREQUENCES),
        default="5min",
        help_text="Taille des bougies : 5min, 15min, 1h ou 1j.",
    )
    debut = serializers.DateTimeField(
        required=False,
        help_text="Début (UTC). Par défaut : 7 jours avant 'fin'. '2026-10-23' = 2026-10-23 à 00:00 UTC.",
    )
    fin = serializers.DateTimeField(
        required=False, help_text="Fin (UTC). Par défaut : dernière bougie disponible."
    )

    def validate(self, donnees):
        debut, fin = donnees.get("debut"), donnees.get("fin")
        if debut and fin and debut >= fin:
            raise serializers.ValidationError({"fin": "'fin' doit être postérieure à 'debut'."})
        return donnees


class ParametresVolatiliteSerializer(PeriodeSerializer):
    fenetre = serializers.IntegerField(
        min_value=2,
        max_value=500,
        default=20,
        help_text="Nombre de bougies utilisées pour l'écart-type glissant.",
    )


class ParametresPicsSerializer(ParametresVolatiliteSerializer):
    seuil = serializers.FloatField(
        min_value=0.5,
        max_value=10,
        default=2.0,
        help_text="Un pic = volatilité > moyenne + seuil x écart-type.",
    )


class ParametresCorrelationsSerializer(PeriodeSerializer):
    actifs = serializers.CharField(
        help_text="Entre 2 et 10 symboles séparés par des virgules, ex. AAPL,MSFT,BTC-USD."
    )

    def validate_actifs(self, valeur):
        symboles = []
        for morceau in valeur.split(","):
            symbole = morceau.strip().upper()
            if symbole and symbole not in symboles:
                symboles.append(symbole)
        if not 2 <= len(symboles) <= 10:
            raise serializers.ValidationError("Indique entre 2 et 10 symboles distincts.")
        return symboles


# ---------- Formes des réponses (servent uniquement à la documentation Swagger) ----------
class PointVolatiliteSerializer(serializers.Serializer):
    horodatage = serializers.DateTimeField()
    close = serializers.FloatField(allow_null=True)
    rendement = serializers.FloatField(allow_null=True)
    volatilite = serializers.FloatField(allow_null=True)
    amplitude = serializers.FloatField(allow_null=True)


class ResumeVolatiliteSerializer(serializers.Serializer):
    nb_points = serializers.IntegerField()
    volatilite_derniere = serializers.FloatField(allow_null=True)
    volatilite_moyenne = serializers.FloatField(allow_null=True)
    amplitude_periode = serializers.FloatField(allow_null=True)
    rendement_periode = serializers.FloatField(allow_null=True)


class VolatiliteReponseSerializer(serializers.Serializer):
    actif = serializers.CharField()
    fenetre = serializers.IntegerField()
    frequence = serializers.CharField()
    debut = serializers.DateTimeField(allow_null=True)
    fin = serializers.DateTimeField(allow_null=True)
    resume = ResumeVolatiliteSerializer()
    serie = PointVolatiliteSerializer(many=True)


class PicSerializer(serializers.Serializer):
    debut = serializers.DateTimeField()
    fin = serializers.DateTimeField()
    nb_points = serializers.IntegerField()
    horodatage_max = serializers.DateTimeField()
    volatilite_max = serializers.FloatField()
    score_max = serializers.FloatField()
    variation_prix = serializers.FloatField(allow_null=True)


class PicsReponseSerializer(serializers.Serializer):
    actif = serializers.CharField()
    fenetre = serializers.IntegerField()
    frequence = serializers.CharField()
    seuil = serializers.FloatField()
    debut = serializers.DateTimeField(allow_null=True)
    fin = serializers.DateTimeField(allow_null=True)
    moyenne = serializers.FloatField(allow_null=True)
    ecart_type = serializers.FloatField(allow_null=True)
    limite = serializers.FloatField(allow_null=True)
    pics = PicSerializer(many=True)


class CorrelationsReponseSerializer(serializers.Serializer):
    actifs = serializers.ListField(child=serializers.CharField())
    frequence = serializers.CharField()
    debut = serializers.DateTimeField(allow_null=True)
    fin = serializers.DateTimeField(allow_null=True)
    correlations = serializers.DictField(
        child=serializers.DictField(child=serializers.FloatField(allow_null=True))
    )
    observations = serializers.DictField(child=serializers.DictField(child=serializers.IntegerField()))