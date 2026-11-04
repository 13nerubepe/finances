
from urllib.parse import urlencode

from django.core.management.base import BaseCommand

from actualites.models import Source


SYMBOLES = {
    "Yahoo Finance - Apple": "AAPL",
    "Yahoo Finance - Microsoft": "MSFT",
    "Yahoo Finance - Nvidia": "NVDA",
    "Yahoo Finance - Tesla": "TSLA",
    "Yahoo Finance - Amazon": "AMZN",
    "Yahoo Finance - S&P 500": "^GSPC",
    "Yahoo Finance - Nasdaq": "^IXIC",
    "Yahoo Finance - Bitcoin": "BTC-USD",
}


class Command(BaseCommand):
    help = "Configure les sources RSS Yahoo Finance"

    def handle(self, *args, **options):
        for nom, symbole in SYMBOLES.items():
            parametres = urlencode({
                "s": symbole,
                "region": "US",
                "lang": "en-US",
            })

            url = (
                "https://feeds.finance.yahoo.com/rss/2.0/headline?"
                + parametres
            )

            source, cree = Source.objects.update_or_create(
                nom=nom,
                defaults={
                    "url_flux": url,
                    "actif": True,
                },
            )

            action = "Créée" if cree else "Actualisée"
            self.stdout.write(f"{action} : {source.nom}")
