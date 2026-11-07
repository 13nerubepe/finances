from django.core.management.base import BaseCommand
from marches.models import Actif
from marches.journalier import importer_cours

class Command(BaseCommand):
    help = 'Importe les cours journaliers depuis Yahoo Finance. Ex. : importer_cours AAPL NVDA --indice "^GSPC"'

    def add_arguments(self, parser):
        parser.add_argument("tickers",nargs="+")
        parser.add_argument("--type", default=Actif.TypeActif.ACTION,choices=Actif.TypeActif.values)
        parser.add_argument("--indice",help="Indice de reference importe avant les actifs")
        parser.add_argument("--periode",default="1y")

    def handle(self, *args, **options):
        indice = None
        if options["indice"]:
            symbole = options["indice"].upper()
            indice, _ = Actif.objects.get_or_create(
                symbole=symbole,
                defaults={"nom": symbole, "type_actif": Actif.TypeActif.INDICE},
            )
            self.importer(indice, options["periode"])

        for ticker in options["tickers"]:
            symbole = ticker.upper()
            actif, _ = Actif.objects.get_or_create(
                symbole=symbole,
                defaults={"nom": symbole, "type_actif": options["type"]},
            )
            if indice:
                actif.indice_reference = indice
                actif.save()
            self.importer(actif, options["periode"])

    def importer(self, actif, periode):
        nombre = importer_cours(actif, periode)
        if nombre == 0:
            self.stderr.write(f"{actif.symbole} : aucune donnée reçue (ticker invalide ?)")
        else:
            self.stdout.write(self.style.SUCCESS(f"{actif.symbole} : {nombre} jours reçus"))
