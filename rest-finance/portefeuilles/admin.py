from django.contrib import admin

# Register your models here.
from django.contrib import admin

from .models import Portefeuille, PortefeuilleActif


class PortefeuilleActifInline(admin.TabularInline):
    model = PortefeuilleActif
    extra = 0
    autocomplete_fields = ["actif"]
    readonly_fields = ["date_ajout"]


@admin.register(Portefeuille)
class PortefeuilleAdmin(admin.ModelAdmin):
    list_display = ("nom", "proprietaire", "date_creation")
    search_fields = ("nom", "proprietaire__telephone", "proprietaire__nom")
    inlines = [PortefeuilleActifInline]