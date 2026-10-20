export const ACTIFS_MOCK = [
    { label: 'Apple', value: 'AAPL' },
    { label: 'Microsoft', value: 'MSFT' },
    { label: 'NVIDIA', value: 'NVDA' },
    { label: 'Tesla', value: 'TSLA' }
];

export const INDICATEURS_MOCK = {
    volatilite: 24.5,
    volatiliteMoyenne: 18.2,
    minimum: 12.4,
    maximum: 35.8
};

export const CORRELATIONS_MOCK = [
    { actif1: 'AAPL', actif2: 'MSFT', correlation: 0.78 },
    { actif1: 'AAPL', actif2: 'NVDA', correlation: 0.65 },
    { actif1: 'MSFT', actif2: 'NVDA', correlation: 0.82 }
];

export const MOUVEMENTS_INHABITUELS_MOCK = [
    {
        actif: 'NVDA',
        variation: 8.4,
        type: 'HAUSSE',
        date: '2026-10-19'
    },
    {
        actif: 'TSLA',
        variation: -6.2,
        type: 'BAISSE',
        date: '2026-10-18'
    }
];
