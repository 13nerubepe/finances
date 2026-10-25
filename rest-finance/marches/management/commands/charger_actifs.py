from django.core.management.base import BaseCommand

from marches.models import Actif

PANIER_DE_DEPART = [
    ("AAPL", "Apple Inc.", Actif.TypeActif.ACTION, "USD"),
    ("MSFT", "Microsoft Corporation", Actif.TypeActif.ACTION, "USD"),
    ("TSLA", "Tesla, Inc.", Actif.TypeActif.ACTION, "USD"),
    ("^GSPC", "S&P 500", Actif.TypeActif.INDICE, "USD"),
    ("^FCHI", "CAC 40", Actif.TypeActif.INDICE, "EUR"),
    ("BTC-USD", "Bitcoin", Actif.TypeActif.CRYPTO, "USD"),
    ("ETH-USD", "Ethereum", Actif.TypeActif.CRYPTO, "USD"),
]


class Command(BaseCommand):
    help = "Insère le panier d'actifs de départ"

    def handle(self, *args, **options):
        crees = 0
        for symbole, nom, type_actif, devise in PANIER_DE_DEPART:
            _, cree = Actif.objects.get_or_create(
                symbole=symbole,
                defaults={"nom": nom, "type_actif": type_actif, "devise": devise},
            )
            crees += int(cree)
        self.stdout.write(
            self.style.SUCCESS(
                f"{crees} actif(s) crée(s), {len(PANIER_DE_DEPART) - crees} deja present(s)."
            )
        )