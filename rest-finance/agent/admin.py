from django.contrib import admin

from .models import Explication


@admin.register(Explication)
class ExplicationAdmin(admin.ModelAdmin):
    list_display = ("pic__actif__symbole", "pic__date", "modele", "date_creation")
    readonly_fields = ("pic",)
