import time

from django.core.management.base import BaseCommand

from actualites.services.rss_collector import collecter_pour_pic
from marches.models import IndicateurJournalier

PAUSE = 2  # secondes entre deux requêtes, pour ne pas être bloqué par Google News


class Command(BaseCommand):
    help = "Collecte sur Google News les articles des pics qui n'en ont pas encore"

    def handle(self, *args, **options):
        pics = IndicateurJournalier.objects.filter(est_pic=True, articles__isnull=True).select_related("actif")
        for pic in pics:
            try:
                nouveaux = collecter_pour_pic(pic)
            except OSError as erreur:
                self.stderr.write(f"{pic.actif.symbole} {pic.date} : échec ({erreur}), pic suivant")
                continue
            self.stdout.write(f"{pic.actif.symbole} {pic.date} : {nouveaux} article(s)")
            time.sleep(PAUSE)
        self.stdout.write(self.style.SUCCESS(f"{len(pics)} pic(s) traité(s)."))
