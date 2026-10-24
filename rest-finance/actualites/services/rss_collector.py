
from datetime import datetime, timezone as dt_timezone

import feedparser

from django.utils import timezone
from django.utils.html import strip_tags

from ..models import Article, Source
from ..themes_auto import attribuer_themes


def _date_entree(entry):
    parsed = (
        entry.get("published_parsed")
        or entry.get("updated_parsed")
    )

    if not parsed:
        return None

    return datetime(*parsed[:6], tzinfo=dt_timezone.utc)


def _contenu_entree(entry):
    contenus = entry.get("content", [])

    if contenus:
        contenu = contenus[0].get("value", "")
    else:
        contenu = entry.get("summary", "")

    return strip_tags(contenu).strip()


def collecter_source(source):
    flux = feedparser.parse(source.url_flux)

    if flux.bozo and not flux.entries:
        raise RuntimeError(
            f"Flux illisible : {flux.bozo_exception}"
        )

    nouveaux = 0

    for entry in flux.entries:
        lien = entry.get("link")
        titre = entry.get("title")

        if not lien or not titre:
            continue

        article, cree = Article.objects.get_or_create(
            lien=lien[:1000],
            defaults={
                "source": source,
                "titre": titre[:500],
                "auteur": entry.get("author", "")[:200],
                "contenu": _contenu_entree(entry),
                "date_publication": _date_entree(entry),
            },
        )

        if cree:
            attribuer_themes(article)
            nouveaux += 1

    source.derniere_collecte = timezone.now()
    source.save(update_fields=["derniere_collecte"])

    return nouveaux


def collecter_toutes_les_sources():
    bilan = {}

    for source in Source.objects.filter(actif=True):
        try:
            bilan[source.nom] = collecter_source(source)
        except Exception as exc:
            bilan[source.nom] = f"Erreur : {exc}"

    return bilan
