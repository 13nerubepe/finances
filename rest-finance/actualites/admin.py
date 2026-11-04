from django.contrib import admin

from .models import Article, Source


@admin.register(Source)
class SourceAdmin(admin.ModelAdmin):
    list_display = ("nom", "actif", "derniere_collecte")
    list_filter = ("actif",)
    search_fields = ("nom",)


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = (
        "titre",
        "source",
        "date_publication",
    )
    list_filter = ("source",)
    search_fields = ("titre", "contenu")
    readonly_fields = ("date_creation","pics") #On ne veut pas que l'utilisateur modifie la date de création de l'article, ni les pics associés
    date_hierarchy = "date_publication"
