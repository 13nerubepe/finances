import pandas as pd
from django.conf import settings
from django.core.management.base import BaseCommand
from marches.indicateurs_journaliers import calculer_indicateurs
from marches.models import Actif, IndicateurJournalier

COLONNES = [
     "rendement", "volatilite", "volatilite_annuelle", "parkinson", "z",
    "z_volume", "gap", "beta", "rendement_anormal", "z_anormal",
]
def nombre(valeur):
    if pd.isna(valeur):
        return None
    return float(valeur)

def charger_cours(actif):
    lignes = list(actif.cours_journaliers.values("date","open","high","low","close","volume"))
    if not lignes:
        return None
    return pd.DataFrame(lignes).set_index("date")

class Command(BaseCommand):
    help = "Calcule et enregistre les indicateurs journaliers. Ex. : calculer_indicateurs AAPL NVDA"

    def add_arguments(self, parser):
        parser.add_argument("tickers",nargs="*", help="Par défaut : tous les actifs qui ont des cours journaliers")

    def handle(self, *args, **options):
        tickers = []
        if options["tickers"]:
            for t in options["tickers"]:
                tickers.append(t.upper())

        for actif in Actif.objects.all():

            if not actif.cours_journaliers.exists():
                continue
            if tickers and actif.symbole not in tickers:
                continue
            self.calculer(actif)

    def calculer(self,actif):
        cours = charger_cours(actif)

        rendement_indice = None

        if actif.indice_reference:
            cours_indice = charger_cours(actif.indice_reference)
            if cours_indice is not None:
                rendement_indice = calculer_indicateurs(cours_indice)["rendement"]

        jours_par_an = 365 if actif.type_actif == Actif.TypeActif.CRYPTO else 252
        indique = calculer_indicateurs(cours,rendement_indice, settings.SEUIL_PIC, jours_par_an)

        objets = []

        for jour, ligne in indique.iterrows():

            if isinstance(ligne["type_pic"],str) :
                type_pic = ligne["type_pic"]
            else:
                type_pic = ""

                objet = IndicateurJournalier(
                actif=actif,
                date=jour,
                rendement=nombre(ligne["rendement"]),
                volatilite=nombre(ligne["volatilite"]),
                volatilite_annuelle=nombre(ligne["volatilite_annuelle"]),
                parkinson=nombre(ligne["parkinson"]),
                z=nombre(ligne["z"]),
                z_volume=nombre(ligne["z_volume"]),
                gap=nombre(ligne["gap"]),
                beta=nombre(ligne["beta"]),
                rendement_anormal=nombre(ligne["rendement_anormal"]),
                z_anormal=nombre(ligne["z_anormal"]),
                est_pic=bool(ligne["est_pic"]),
                type_pic=type_pic,
            )


            objets.append(objet)

        champs_a_mettre_a_jour = COLONNES + ["est_pic","type_pic"]
        IndicateurJournalier.objects.bulk_create(
            objets,
            update_conflicts=True,
            unique_fields=["actif","date"],
            update_fields=champs_a_mettre_a_jour,
        )

        nbr_pics = 0

        for objet in objets:
            if objet.est_pic:
                nbr_pics = nbr_pics + 1

        nbr_jours = len(objets)
        message = f"{actif.symbole} : {nbr_jours} jours calcules, {nbr_pics} pics"
        self.stdout.write(self.style.SUCCESS(message))

    
        