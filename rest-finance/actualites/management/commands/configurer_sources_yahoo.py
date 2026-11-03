from urllib.parse import urlencode

from django.core.management.base import BaseCommand

from actualites.models import Source
from marches.models import Actif


class Command(BaseCommand):
    help = "Configure une source RSS Yahoo Finance par actif suivi"

    def handle(self, *args, **options):
        noms = []

        for actif in Actif.objects.filter(est_suivi=True):
            parametres = urlencode({
                "s": actif.symbole,
                "region": "US",
                "lang": "en-US",
            })
            nom = f"Yahoo Finance - {actif.symbole}"
            noms.append(nom)

            Source.objects.update_or_create(
                nom=nom,
                defaults={
                    "url_flux": f"https://feeds.finance.yahoo.com/rss/2.0/headline?{parametres}",
                    "actif": True,
                },
            )

        desactivees = (
            Source.objects.filter(nom__startswith="Yahoo Finance - ", actif=True)
            .exclude(nom__in=noms)
            .update(actif=False)
        )

        self.stdout.write(
            f"{len(noms)} sources actives, {desactivees} anciennes désactivées."
        )