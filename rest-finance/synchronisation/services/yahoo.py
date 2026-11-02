
import yfinance as yf

from django.utils import timezone

from marches.models import Actif
from marches.ingestion import ingerer_actif
from synchronisation.models import SynchronisationYahoo


# Plusieurs recherches permettent d'élargir progressivement le catalogue.
RECHERCHES = {
    "action": [
        "technology",
        "bank",
        "healthcare",
        "energy",
        "semiconductor",
        "retail",
        "automotive",
        "finance",
    ],
    "indice": [
        "S&P 500",
        "Nasdaq",
        "Dow Jones",
        "Russell 2000",
        "FTSE 100",
        "DAX",
        "CAC 40",
        "Nikkei 225",
    ],
    "crypto": [
        "Bitcoin",
        "Ethereum",
        "Solana",
        "XRP",
        "Dogecoin",
        "Cardano",
        "BNB",
        "Tether",
        "Avalanche",
        "Polkadot",
    ],
}

# Correspondances indicatives des places boursières.
DEVISES_PAR_BOURSE = {
    "NMS": "USD",
    "NAS": "USD",
    "NYQ": "USD",
    "ASE": "USD",
    "TOR": "CAD",
    "TSX": "CAD",
    "GER": "EUR",
    "FRA": "EUR",
    "PAR": "EUR",
    "LSE": "GBP",
    "TYO": "JPY",
    "HKG": "HKD",
    "ASX": "AUD",
}


def rechercher_actifs(terme, categorie, methode):
    """
    Recherche des actifs sur Yahoo Finance pour une catégorie donnée.
    Retourne une liste de dictionnaires.
    """
    resultat = yf.Lookup(terme)

    if methode == "action":
        df = resultat.get_stock(count=50)
    elif methode == "indice":
        df = resultat.get_index(count=50)
    elif methode == "crypto":
        df = resultat.get_cryptocurrency(count=50)
    else:
        return []

    if df is None or df.empty:
        return []

    # Le symbole Yahoo se trouve dans l'index du DataFrame.
    df = df.reset_index()

    actifs = []

    for _, ligne in df.iterrows():
        symbole = str(ligne.get("symbol", "")).strip()

        if not symbole or symbole.lower() == "nan":
            continue

        nom = ligne.get("shortName")

        if nom is None or str(nom).lower() == "nan":
            nom = ligne.get("longName")

        if nom is None or str(nom).lower() == "nan":
            nom = symbole

        bourse = str(ligne.get("exchange", "")).upper()

        if categorie == "crypto":
            devise = (
                symbole.rsplit("-", 1)[-1]
                if "-" in symbole
                else "USD"
            )
        else:
            devise = DEVISES_PAR_BOURSE.get(bourse, "USD")

        actifs.append({
            "symbole": symbole,
            "nom": str(nom).strip(),
            "type_actif": categorie,
            "devise": devise,
        })

    return actifs


def decouvrir_actifs_yahoo():
    """
    Recherche les actions, indices et cryptomonnaies
    puis enregistre les nouveaux actifs dans la base.
    """
    actifs_decouverts = {}

    erreurs = []

    methodes = {
        "action": "action",
        "indice": "indice",
        "crypto": "crypto",
    }

    for categorie, termes in RECHERCHES.items():

        for terme in termes:

            try:
                resultats = rechercher_actifs(
                    terme,
                    categorie,
                    methodes[categorie],
                )

                for actif in resultats:
                    actifs_decouverts[actif["symbole"]] = actif

            except Exception as erreur:
                message = (
                    f"Découverte {categorie} ({terme}) : {erreur}"
                )
                erreurs.append(message)

    nombre_crees = 0

    for actif_data in actifs_decouverts.values():

        _, cree = Actif.objects.get_or_create(
            symbole=actif_data["symbole"],
            defaults={
                "nom": actif_data["nom"],
                "type_actif": actif_data["type_actif"],
                "devise": actif_data["devise"],
                "est_suivi": True,
            },
        )

        if cree:
            nombre_crees += 1

    return {
        "total_decouverts": len(actifs_decouverts),
        "total_crees": nombre_crees,
        "erreurs": erreurs,
    }


def synchroniser_tous_les_actifs():
    """
    1. Découvre de nouveaux actifs.
    2. Les enregistre dans PostgreSQL.
    3. Récupère les cours des actifs suivis.
    4. Enregistre le résultat de la synchronisation.
    """

    synchronisation = SynchronisationYahoo.objects.create(
        categorie="toutes",
        marche="Yahoo Finance",
        statut=SynchronisationYahoo.Statut.EN_COURS,
    )

    total_actifs = 0
    total_bougies = 0
    erreurs = []

    try:
        # Première étape : découverte automatique.
        decouverte = decouvrir_actifs_yahoo()

        erreurs.extend(decouverte["erreurs"])

        # Deuxième étape : récupération des cours.
        actifs = Actif.objects.filter(est_suivi=True)

        for actif in actifs:

            try:
                nombre_bougies, nouvelles_bougies = ingerer_actif(actif)

                total_actifs += 1
                total_bougies += nouvelles_bougies

            except Exception as erreur:
                erreurs.append(
                    f"{actif.symbole} : {erreur}"
                )

        synchronisation.actifs_decouverts = (
            decouverte["total_decouverts"]
        )

        synchronisation.actifs_crees = decouverte["total_crees"]

        synchronisation.actifs_actualises = total_actifs

        synchronisation.date_fin = timezone.now()

        if erreurs and total_actifs > 0:
            synchronisation.statut = (
                SynchronisationYahoo.Statut.PARTIEL
            )

        elif erreurs:
            synchronisation.statut = (
                SynchronisationYahoo.Statut.ECHEC
            )

        else:
            synchronisation.statut = (
                SynchronisationYahoo.Statut.TERMINE
            )

        synchronisation.erreur = "\n".join(erreurs)
        synchronisation.save()

        return {
            "total_decouverts": decouverte["total_decouverts"],
            "total_crees": decouverte["total_crees"],
            "total_actifs": total_actifs,
            "total_bougies": total_bougies,
            "erreurs": erreurs,
        }

    except Exception as erreur:

        synchronisation.statut = (
            SynchronisationYahoo.Statut.ECHEC
        )

        synchronisation.erreur = str(erreur)
        synchronisation.date_fin = timezone.now()
        synchronisation.save()

        raise
