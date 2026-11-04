
from django.core.management.base import BaseCommand

from actualites.services.rss_collector import (
    collecter_toutes_les_sources,
)


class Command(BaseCommand):
    help = "Collecte les actualités financières RSS"

    def handle(self, *args, **options):
        bilan = collecter_toutes_les_sources()
        total = 0

        for source, resultat in bilan.items():
            self.stdout.write(f"{source} : {resultat}")

            if isinstance(resultat, int):
                total += resultat

        self.stdout.write(
            self.style.SUCCESS(
                f"Collecte terminée : {total} nouvel(aux) article(s)."
            )
        )
