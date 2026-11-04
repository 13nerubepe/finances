from django.contrib import admin

# Register your models here.
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Portefeuille, Position, User



@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("telephone", "nom", "prenom", "is_staff", "is_active")
    search_fields = ("telephone", "nom", "prenom")
    ordering = ("-date_creation",)

    fieldsets = (
        (None, {"fields": ("telephone", "password")}),
        ("Identité", {"fields": ("nom", "prenom")}),
        (
            "Permissions",
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("telephone", "nom", "prenom", "password1", "password2"),
            },
        ),
    )

class PositionInline(admin.TabularInline):
    model = Position
    extra = 0
    autocomplete_fields = ["actif"]
    readonly_fields = ["date_ajout"]


@admin.register(Portefeuille)
class PortefeuilleAdmin(admin.ModelAdmin):
    list_display = ("nom", "utilisateur", "devise", "date_creation")
    search_fields = ("nom", "utilisateur__telephone", "utilisateur__nom")
    inlines = [PositionInline]
