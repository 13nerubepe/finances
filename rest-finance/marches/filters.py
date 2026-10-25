import django_filters as filters

from .models import CoursHistorique


class CoursFilter(filters.FilterSet):
    actif = filters.CharFilter(
        field_name="actif__symbole", lookup_expr="iexact", help_text="Symbole, ex. AAPL ou BTC-USD."
    )
    debut = filters.IsoDateTimeFilter(
        field_name="horodatage", lookup_expr="gte", help_text="Début de période (UTC), inclus."
    )
    fin = filters.IsoDateTimeFilter(
        field_name="horodatage", lookup_expr="lte", help_text="Fin de période (UTC), incluse."
    )
    ordre = filters.OrderingFilter(
        fields=(("horodatage", "horodatage"),),
        help_text="'horodatage' (ancien vers récent) ou '-horodatage' (récent vers ancien).",
    )

    class Meta:
        model = CoursHistorique
        fields = []