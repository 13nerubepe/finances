import time

from django.core.management.base import BaseCommand
from django.utils import timezone

from marches.ingestion import ingerer_actif
from marches.models import Actif


class Command(BaseCommand):
    help = "Télécharge les cours toutes les 5 minutes des actifs suivis."

    def add_arguments(self, parser):
        parser.add_argument(
            "--symbole", nargs="+", help="Limiter à certains symboles"
        )
        parser.add_argument(
            "--depuis-jours",
            type=int,
            help="Nombre de jours à télécharger (max 59). Par défaut : calculé automatiquement.",
        )
        parser.add_argument(
            "--boucle", action="store_true", help="Relance l'ingestion en continu."
        )
        parser.add_argument(
            "--pause", type=int, default=300, help="Secondes entre deux passes (défaut : 300)."
        )

    def handle(self, *args, **options):
        symboles = options["symbole"]
        jours = options["depuis_jours"]

        if not options["boucle"]:
            self._passe(symboles, jours)
            return

        try:
            while True:
                self._passe(symboles, jours)
                self.stdout.write(f"Prochaine passe dans {options['pause']} s (Ctrl+C pour arrêter)")
                time.sleep(options["pause"])
        except KeyboardInterrupt:
            self.stdout.write("Arrêt demandé, fin de l'ingestion.")

    def _passe(self, symboles, jours):
        actifs = Actif.objects.filter(est_suivi=True)
        if symboles:
            actifs = actifs.filter(symbole__in=symboles)

        if not actifs.exists():
            self.stdout.write(
                self.style.WARNING("Aucun actif à traiter. Lance d'abord : python manage.py charger_actifs")
            )
            return

        self.stdout.write(f"--- Ingestion {timezone.now():%Y-%m-%d %H:%M:%S} UTC ---")
        for actif in actifs:
            try:
                recues, nouvelles = ingerer_actif(actif, jours)
            except Exception as erreur:
                self.stderr.write(self.style.ERROR(f"{actif.symbole} : erreur ({erreur})"))
                continue

            if recues == 0:
                self.stdout.write(
                    self.style.WARNING(
                        f"{actif.symbole} : aucune donnée reçue "
                        "(marché fermé, symbole invalide ou problème réseau)."
                    )
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"{actif.symbole} : {recues} bougies reçues, {nouvelles} nouvelles."
                    )
                )