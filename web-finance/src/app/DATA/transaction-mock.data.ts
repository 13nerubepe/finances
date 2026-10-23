import { Transaction } from '@/app/models/actif-model';


export const TRANSACTIONS_MOCK: Transaction[] = [
    {
        transactionId: 1,
        portefeuilleId: 1,
        actifId: 1,
        symbol: 'AAPL',
        type: 'achat',
        quantite: 20,
        prixUnitaire: 210,
        montantTotal: 4200,
        frais: 4.50,
        dateTransaction: '2026-09-12T10:30:00',
        devise: 'USD'
    },
    {
        transactionId: 2,
        portefeuilleId: 1,
        actifId: 2,
        symbol: 'MSFT',
        type: 'achat',
        quantite: 10,
        prixUnitaire: 410,
        montantTotal: 4100,
        frais: 4.50,
        dateTransaction: '2026-09-15T14:10:00',
        devise: 'USD'
    },
    {
        transactionId: 3,
        portefeuilleId: 1,
        actifId: 3,
        symbol: 'NVDA',
        type: 'achat',
        quantite: 25,
        prixUnitaire: 125,
        montantTotal: 3125,
        frais: 3.95,
        dateTransaction: '2026-09-20T09:45:00',
        devise: 'USD'
    },
    {
        transactionId: 4,
        portefeuilleId: 1,
        actifId: 5,
        symbol: 'BTC-USD',
        type: 'achat',
        quantite: 0.08,
        prixUnitaire: 70000,
        montantTotal: 5600,
        frais: 12,
        dateTransaction: '2026-10-01T16:20:00',
        devise: 'USD'
    },
    {
        transactionId: 5,
        portefeuilleId: 1,
        actifId: 6,
        symbol: 'ETH-USD',
        type: 'achat',
        quantite: 1.5,
        prixUnitaire: 2450,
        montantTotal: 3675,
        frais: 8,
        dateTransaction: '2026-10-08T11:05:00',
        devise: 'USD'
    },
    {
        transactionId: 6,
        portefeuilleId: 1,
        actifId: 1,
        symbol: 'AAPL',
        type: 'vente',
        quantite: 2,
        prixUnitaire: 230,
        montantTotal: 460,
        frais: 2.50,
        dateTransaction: '2026-10-19T13:15:00',
        devise: 'USD'
    }
];
