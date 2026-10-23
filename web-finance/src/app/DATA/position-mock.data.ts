import { PositionPortefeuille } from '@/app/models/actif-model';


export const POSITIONS_PORTEFEUILLE_MOCK: PositionPortefeuille[] = [
    {
        positionId: 1,
        portefeuilleId: 1,
        actifId: 1,
        symbol: 'AAPL',
        nom: 'Apple Inc.',
        quantite: 20,
        prixAchat: 210,
        prixActuel: 231.40,
        valeurTotale: 4628,
        rendement: 10.19,
        poids: 18.16
    },
    {
        positionId: 2,
        portefeuilleId: 1,
        actifId: 2,
        symbol: 'MSFT',
        nom: 'Microsoft Corporation',
        quantite: 10,
        prixAchat: 410,
        prixActuel: 425.22,
        valeurTotale: 4252.20,
        rendement: 3.71,
        poids: 16.69
    },
    {
        positionId: 3,
        portefeuilleId: 1,
        actifId: 3,
        symbol: 'NVDA',
        nom: 'NVIDIA Corporation',
        quantite: 25,
        prixAchat: 125,
        prixActuel: 142.75,
        valeurTotale: 3568.75,
        rendement: 14.20,
        poids: 14
    },
    {
        positionId: 4,
        portefeuilleId: 1,
        actifId: 5,
        symbol: 'BTC-USD',
        nom: 'Bitcoin',
        quantite: 0.08,
        prixAchat: 70000,
        prixActuel: 67450,
        valeurTotale: 5396,
        rendement: -3.64,
        poids: 21.18
    },
    {
        positionId: 5,
        portefeuilleId: 1,
        actifId: 6,
        symbol: 'ETH-USD',
        nom: 'Ethereum',
        quantite: 1.5,
        prixAchat: 2450,
        prixActuel: 2625.30,
        valeurTotale: 3937.95,
        rendement: 7.16,
        poids: 15.45
    }
];
