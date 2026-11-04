
from django.core.management.base import BaseCommand

from synchronisation.services.yahoo import synchroniser_tous_les_actifs


class Command(BaseCommand):

    help = "Synchronise les cours des actifs depuis Yahoo Finance."

    def handle(self, *args, **options):

        self.stdout.write(
            self.style.WARNING("Début de la synchronisation Yahoo Finance...")
        )

        resultat = synchroniser_tous_les_actifs()

        self.stdout.write(
            self.style.SUCCESS(
                f"Synchronisation terminée : "
                f"{resultat['total_actifs']} actifs traités, "
                f"{resultat['total_bougies']} nouvelles bougies."
            )
        )

        for erreur in resultat["erreurs"]:
            self.stdout.write(self.style.ERROR(erreur))
