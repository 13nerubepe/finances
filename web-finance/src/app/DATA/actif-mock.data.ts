import { Actif, ActifOption } from '@/app/models/actif-model';


export const ACTIFS_MOCK: Actif[] = [
    {
        actifId: 1,
        name: 'Apple Inc.',
        symbol: 'AAPL',
        currentPrice: 231.40,
        previousPrice: 228.90,
        variation: 1.09,
        currency: 'USD',
        volume: 42150000,
        trend: 'up'
    },
    {
        actifId: 2,
        name: 'Microsoft Corporation',
        symbol: 'MSFT',
        currentPrice: 425.22,
        previousPrice: 429.10,
        variation: -0.90,
        currency: 'USD',
        volume: 18320000,
        trend: 'down'
    },
    {
        actifId: 3,
        name: 'NVIDIA Corporation',
        symbol: 'NVDA',
        currentPrice: 142.75,
        previousPrice: 139.80,
        variation: 2.11,
        currency: 'USD',
        volume: 51240000,
        trend: 'up'
    },
    {
        actifId: 4,
        name: 'Amazon.com Inc.',
        symbol: 'AMZN',
        currentPrice: 187.83,
        previousPrice: 185.50,
        variation: 1.26,
        currency: 'USD',
        volume: 27610000,
        trend: 'up'
    },
    {
        actifId: 5,
        name: 'Bitcoin',
        symbol: 'BTC-USD',
        currentPrice: 67450,
        previousPrice: 68920,
        variation: -2.13,
        currency: 'USD',
        volume: 29800000000,
        trend: 'down'
    },
    {
        actifId: 6,
        name: 'Ethereum',
        symbol: 'ETH-USD',
        currentPrice: 2625.30,
        previousPrice: 2580,
        variation: 1.76,
        currency: 'USD',
        volume: 12400000000,
        trend: 'up'
    },
    {
        actifId: 7,
        name: 'S&P 500',
        symbol: '^GSPC',
        currentPrice: 5842.47,
        previousPrice: 5812.20,
        variation: 0.52,
        currency: 'USD',
        trend: 'up'
    },
    {
        actifId: 8,
        name: 'Tesla Inc.',
        symbol: 'TSLA',
        currentPrice: 218.30,
        previousPrice: 225.70,
        variation: -3.28,
        currency: 'USD',
        volume: 63400000,
        trend: 'down'
    }
];

export const ACTIFS_OPTIONS_MOCK: ActifOption[] =
    ACTIFS_MOCK.map(({ actifId, symbol, name }) => ({
        actifId,
        symbol,
        name
    }));
