import django_filters as filters

from .models import CoursHistorique, IndicateurJournalier


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
class PicJournalierFilter(filters.FilterSet):
    symbole = filters.CharFilter(
        field_name="actif__symbole", lookup_expr="iexact", help_text="Symbole, ex. AAPL ou BTC-USD."
    )
    debut = filters.DateFilter(field_name="date", lookup_expr="gte", help_text="Date de début (AAAA-MM-JJ), incluse.")
    fin = filters.DateFilter(field_name="date", lookup_expr="lte", help_text="Date de fin (AAAA-MM-JJ), incluse.")

    class Meta:
        model = IndicateurJournalier
        fields = ["type_pic"]
