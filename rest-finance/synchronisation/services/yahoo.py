
from django.utils import timezone

from marches.models import Actif
from marches.services.ingestion import ingerer_actif

from synchronisation.models import SynchronisationYahoo


def synchroniser_tous_les_actifs():

    synchronisation = SynchronisationYahoo.objects.create(
        categorie="toutes",
        marche="Yahoo Finance",
        statut=SynchronisationYahoo.Statut.EN_COURS,
    )

    total_actifs = 0
    total_bougies = 0
    erreurs = []

    actifs = Actif.objects.filter(est_suivi=True)

    try:
        for actif in actifs:

            try:
                nombre_bougies, nombre_nouvelles = ingerer_actif(actif)

                total_actifs += 1
                total_bougies += nombre_nouvelles

            except Exception as erreur:
                erreurs.append(f"{actif.symbole} : {erreur}")

        synchronisation.actifs_decouverts = actifs.count()
        synchronisation.actifs_actualises = total_actifs
        synchronisation.date_fin = timezone.now()

        if erreurs:
            synchronisation.statut = SynchronisationYahoo.Statut.ECHEC
            synchronisation.erreur = "\n".join(erreurs)
        else:
            synchronisation.statut = SynchronisationYahoo.Statut.TERMINE

        synchronisation.save()

        return {
            "total_actifs": total_actifs,
            "total_bougies": total_bougies,
            "erreurs": erreurs,
        }

    except Exception as erreur:

        synchronisation.statut = SynchronisationYahoo.Statut.ECHEC
        synchronisation.erreur = str(erreur)
        synchronisation.date_fin = timezone.now()
        synchronisation.save()

        raise
