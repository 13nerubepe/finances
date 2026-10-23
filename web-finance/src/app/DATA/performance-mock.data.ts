import { PerformancePortefeuille } from '@/app/models/actif-model';


export const PERFORMANCES_PORTEFEUILLE_MOCK: PerformancePortefeuille[] = [
    {
        portefeuilleId: 1,
        valeurInitiale: 22000,
        valeurActuelle: 25480.75,
        gainsPertes: 3480.75,
        rendementPourcentage: 15.82,
        variationJournaliere: 1.84,
        dateDebut: '2026-01-15',
        dateFin: '2026-10-21',
        devise: 'USD'
    },
    {
        portefeuilleId: 2,
        valeurInitiale: 13000,
        valeurActuelle: 12850.20,
        gainsPertes: -149.80,
        rendementPourcentage: -1.15,
        variationJournaliere: -0.62,
        dateDebut: '2026-03-02',
        dateFin: '2026-10-21',
        devise: 'USD'
    },
    {
        portefeuilleId: 3,
        valeurInitiale: 9000,
        valeurActuelle: 8420,
        gainsPertes: -580,
        rendementPourcentage: -6.44,
        variationJournaliere: -2.13,
        dateDebut: '2026-05-20',
        dateFin: '2026-10-21',
        devise: 'USD'
    }
];
