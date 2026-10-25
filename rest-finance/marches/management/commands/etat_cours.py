from django.core.management.base import BaseCommand
from django.db.models import Count, Max, Min

from marches.models import Actif


def _format(date):
    return date.strftime("%Y-%m-%d %H:%M UTC") if date else "-"


class Command(BaseCommand):
    help = "Affiche, pour chaque actif, le nombre de bougies en base et la période couverte."

    def handle(self, *args, **options):
        actifs = Actif.objects.annotate(
            nb=Count("cours"), premiere=Min("cours__horodatage"), derniere=Max("cours__horodatage")
        ).order_by("symbole")

        self.stdout.write(f"{'SYMBOLE':<10} {'BOUGIES':>8}  {'PREMIÈRE':<20}  {'DERNIÈRE':<20}")
        for a in actifs:
            self.stdout.write(
                f"{a.symbole:<10} {a.nb:>8}  {_format(a.premiere):<20}  {_format(a.derniere):<20}"
            )