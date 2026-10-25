import yfinance as yf

from django.core.management.base import BaseCommand
from marches.models import Actif, CoursJournalier

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
        df = yf.Ticker(actif.symbole).history(period=periode, interval="1d", auto_adjust=True)
        df = df.dropna(subset=["Close"])
        if df.empty:
            self.stderr.write(f"{actif.symbole} : aucune donnée reçue (ticker invalide ?)")
            return

        cours = [
            CoursJournalier(
                actif=actif,
                date=jour.date(),
                open=ligne["Open"],
                high=ligne["High"],
                low=ligne["Low"],
                close=ligne["Close"],
                volume=int(ligne["Volume"] or 0),
            )
            for jour, ligne in df.iterrows()
        ]
        avant = actif.cours_journaliers.count()
        CoursJournalier.objects.bulk_create(
            cours,
            update_conflicts=True,
            unique_fields=["actif", "date"],
            update_fields=["open", "high", "low", "close", "volume"],
        )
        nouveaux = actif.cours_journaliers.count() - avant
        self.stdout.write(self.style.SUCCESS(f"{actif.symbole} : {len(cours)} jours reçus, {nouveaux} nouveaux"))