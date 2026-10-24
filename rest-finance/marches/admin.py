from django.contrib import admin

# Register your models here.
from .models import Actif, CoursHistorique


@admin.register(Actif)
class ActifAdmin(admin.ModelAdmin):
    list_display = ("symbole", "nom", "type_actif", "devise", "est_suivi")
    list_editable = ("est_suivi",)
    list_filter = ("type_actif", "est_suivi")
    search_fields = ("symbole", "nom")


@admin.register(CoursHistorique)
class CoursHistoriqueAdmin(admin.ModelAdmin):
    list_display = ("actif", "horodatage", "open", "high", "low", "close", "volume")
    list_filter = ("actif",)
    date_hierarchy = "horodatage"
    ordering = ("-horodatage",)
    list_select_related = ("actif",)
    show_full_result_count = False