import {
    AlerteRisque,
    IndicateursVolatilite,
    MatriceCorrelation,
    MouvementInhabituel,
    PointVolatilite,
    RendementActif, ResultatAnalyseVolatilite
} from '@/app/models/actif-model';


export const INDICATEURS_VOLATILITE_MOCK: IndicateursVolatilite = {
    volatiliteActuelle: 24.8,
    volatiliteMoyenne: 18.6,
    volatiliteMaximale: 31.4,
    niveauRisque: 'eleve'
};

export const POINTS_VOLATILITE_MOCK: PointVolatilite[] = [
    { date: '2026-10-15', symbol: 'AAPL', volatilite: 15.2, fenetre: 20 },
    { date: '2026-10-16', symbol: 'AAPL', volatilite: 16.1, fenetre: 20 },
    { date: '2026-10-19', symbol: 'AAPL', volatilite: 17.4, fenetre: 20 },
    { date: '2026-10-20', symbol: 'AAPL', volatilite: 19.8, fenetre: 20 },
    { date: '2026-10-21', symbol: 'AAPL', volatilite: 18.6, fenetre: 20 },

    { date: '2026-10-15', symbol: 'BTC-USD', volatilite: 42.5, fenetre: 20 },
    { date: '2026-10-16', symbol: 'BTC-USD', volatilite: 45.1, fenetre: 20 },
    { date: '2026-10-19', symbol: 'BTC-USD', volatilite: 49.7, fenetre: 20 },
    { date: '2026-10-20', symbol: 'BTC-USD', volatilite: 51.2, fenetre: 20 },
    { date: '2026-10-21', symbol: 'BTC-USD', volatilite: 48.9, fenetre: 20 }
];

export const RENDEMENTS_MOCK: RendementActif[] = [
    { date: '2026-10-17', symbol: 'AAPL', rendement: 0.012 },
    { date: '2026-10-18', symbol: 'AAPL', rendement: -0.004 },
    { date: '2026-10-19', symbol: 'AAPL', rendement: -0.008 },
    { date: '2026-10-20', symbol: 'AAPL', rendement: 0.007 },
    { date: '2026-10-21', symbol: 'AAPL', rendement: 0.011 },

    { date: '2026-10-17', symbol: 'BTC-USD', rendement: -0.021 },
    { date: '2026-10-18', symbol: 'BTC-USD', rendement: 0.014 },
    { date: '2026-10-19', symbol: 'BTC-USD', rendement: -0.018 },
    { date: '2026-10-20', symbol: 'BTC-USD', rendement: -0.009 },
    { date: '2026-10-21', symbol: 'BTC-USD', rendement: -0.013 }
];

export const MATRICE_CORRELATION_MOCK: MatriceCorrelation = {
    actifs: ['AAPL', 'MSFT', 'NVDA', 'BTC-USD'],
    matrice: [
        [1.00, 0.68, 0.72, 0.21],
        [0.68, 1.00, 0.64, 0.18],
        [0.72, 0.64, 1.00, 0.25],
        [0.21, 0.18, 0.25, 1.00]
    ]
};

export const MOUVEMENTS_INHABITUELS_MOCK: MouvementInhabituel[] = [
    {
        actif: 'TSLA',
        date: '2026-10-21',
        variation: -3.28,
        type: 'baisse',
        description: 'Baisse journalière supérieure au seuil habituel.'
    },
    {
        actif: 'BTC-USD',
        date: '2026-10-21',
        variation: -2.13,
        type: 'baisse',
        description: 'Variation importante détectée sur la séance.'
    },
    {
        actif: 'NVDA',
        date: '2026-10-20',
        variation: 4.12,
        type: 'hausse',
        description: 'Hausse inhabituelle par rapport à la volatilité récente.'
    }
];

export const RESULTAT_ANALYSE_VOLATILITE_MOCK: ResultatAnalyseVolatilite = {
    donnees: [
        { date: '2026-10-15', cours: 228.10, volatilite: 15.2 },
        { date: '2026-10-16', cours: 229.40, volatilite: 16.1 },
        { date: '2026-10-19', cours: 227.50, volatilite: 17.4 },
        { date: '2026-10-20', cours: 229.20, volatilite: 19.8 },
        { date: '2026-10-21', cours: 231.40, volatilite: 18.6 }
    ],

    indicateurs: INDICATEURS_VOLATILITE_MOCK,

    correlations: [
        { actif1: 'AAPL', actif2: 'MSFT', correlation: 0.68 },
        { actif1: 'AAPL', actif2: 'NVDA', correlation: 0.72 },
        { actif1: 'AAPL', actif2: 'BTC-USD', correlation: 0.21 }
    ],

    covariances: [
        { actif1: 'AAPL', actif2: 'MSFT', covariance: 0.00014 },
        { actif1: 'AAPL', actif2: 'NVDA', covariance: 0.00019 },
        { actif1: 'AAPL', actif2: 'BTC-USD', covariance: 0.00008 }
    ],

    matriceCorrelation: MATRICE_CORRELATION_MOCK,
    mouvementsInhabituels: MOUVEMENTS_INHABITUELS_MOCK
};

export const ALERTES_RISQUE_MOCK: AlerteRisque[] = [
    {
        symbol: 'TSLA',
        date: '2026-10-21',
        niveau: 'eleve',
        message: 'Variation journalière de -3,28 %.'
    },
    {
        symbol: 'BTC-USD',
        date: '2026-10-21',
        niveau: 'critique',
        message: 'Volatilité annualisée élevée sur la période.'
    },
    {
        symbol: 'NVDA',
        date: '2026-10-20',
        niveau: 'modere',
        message: 'Hausse inhabituelle détectée.'
    }
];
