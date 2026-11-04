from django.core.management.base import BaseCommand

from marches.journalier import calculer
from marches.models import Actif


class Command(BaseCommand):
    help = "Calcule et enregistre les indicateurs journaliers. Ex. : calculer_indicateurs AAPL NVDA"

    def add_arguments(self, parser):
        parser.add_argument("tickers", nargs="*", help="Par défaut : tous les actifs qui ont des cours journaliers")

    def handle(self, *args, **options):
        tickers = []
        for t in options["tickers"]:
            tickers.append(t.upper())

        for actif in Actif.objects.all():
            if not actif.cours_journaliers.exists():
                continue
            if tickers and actif.symbole not in tickers:
                continue
            nbr_jours, nbr_pics = calculer(actif)
            self.stdout.write(self.style.SUCCESS(f"{actif.symbole} : {nbr_jours} jours calcules, {nbr_pics} pics"))
