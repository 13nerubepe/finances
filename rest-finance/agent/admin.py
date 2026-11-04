from django.contrib import admin

from .models import Explication,Message


@admin.register(Explication)
class ExplicationAdmin(admin.ModelAdmin):
    list_display = ("pic__actif__symbole", "pic__date", "modele", "date_creation")
    readonly_fields = ("pic",)

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("utilisateur", "role", "date_creation")
    list_filter = ("role",)
    search_fields = ("contenu",)

