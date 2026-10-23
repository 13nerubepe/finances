import { Portefeuille } from '@/app/models/actif-model';


export const PORTEFEUILLES_MOCK: Portefeuille[] = [
    {
        portefeuilleId: 1,
        nom: 'Portefeuille principal',
        devise: 'USD',
        valeurTotale: 25480.75,
        variation: 1.84,
        dateCreation: '2026-01-15'
    },
    {
        portefeuilleId: 2,
        nom: 'Portefeuille croissance',
        devise: 'USD',
        valeurTotale: 12850.20,
        variation: -0.62,
        dateCreation: '2026-03-02'
    },
    {
        portefeuilleId: 3,
        nom: 'Portefeuille crypto',
        devise: 'USD',
        valeurTotale: 8420,
        variation: -2.13,
        dateCreation: '2026-05-20'
    }
];
