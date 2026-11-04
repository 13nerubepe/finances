from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.schedulers.blocking import BlockingScheduler
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import close_old_connections

COMMANDE_ACTIFS = "charger_actifs"


def executer(commande, *args, **options):
    close_old_connections()
    try:
        call_command(commande, *args, **options)
    except Exception as erreur:
        print(f"Échec de {commande} : {erreur}")
    finally:
        close_old_connections()


def import_journalier():
    executer(COMMANDE_ACTIFS)
    executer("importer_cours", "AAPL", "MSFT", "TSLA", indice="^GSPC")
    executer("importer_cours", "^FCHI", type="indice")
    executer("importer_cours", "BTC-USD", "ETH-USD", type="crypto")
    executer("preparer_actifs_portefeuilles")
    executer("calculer_indicateurs")
    executer("collecter_articles_pics")



def synchronisation():
    executer("synchroniser_yahoo")


def collecte_rss():
    executer("configurer_sources_yahoo")
    executer("collecter_rss")


class Command(BaseCommand):
    help = "Lance automatiquement les imports de données."

    def handle(self, *args, **options):
        planificateur = BlockingScheduler(
            timezone="Africa/Lagos",
            executors={"default": ThreadPoolExecutor(1)},
            job_defaults={
                "coalesce": True,
                "max_instances": 1,
                "misfire_grace_time": 3600,
            },
        )

        import_journalier()
        synchronisation()
        collecte_rss()

        planificateur.add_job(import_journalier, "interval", hours=5)
        planificateur.add_job(synchronisation, "interval", minutes=5)
        planificateur.add_job(collecte_rss, "interval", hours=1)

        self.stdout.write(self.style.SUCCESS("Planificateur démarré."))
        planificateur.start()