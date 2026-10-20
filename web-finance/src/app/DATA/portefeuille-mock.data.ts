import { PortfolioDistributionResponse } from '@/app/models/model';

export const PORTEFEUILLE_MOCK: PortfolioDistributionResponse = {
    totalValue: 780000,

    distribution: [
        {
            actifId: 1,
            name: 'Apple',
            symbol: 'AAPL',
            quantity: 10,
            unitPrice: 25000,
            totalValue: 250000
        },
        {
            actifId: 2,
            name: 'Microsoft',
            symbol: 'MSFT',
            quantity: 6,
            unitPrice: 30000,
            totalValue: 180000
        },
        {
            actifId: 3,
            name: 'NVIDIA',
            symbol: 'NVDA',
            quantity: 5,
            unitPrice: 30000,
            totalValue: 150000
        },
        {
            actifId: 4,
            name: 'Amazon',
            symbol: 'AMZN',
            quantity: 4,
            unitPrice: 30000,
            totalValue: 120000
        },
        {
            actifId: 5,
            name: 'Tesla',
            symbol: 'TSLA',
            quantity: 4,
            unitPrice: 20000,
            totalValue: 80000
        }
    ]
};
