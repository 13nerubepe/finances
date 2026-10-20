import { HistoricalPrice, MarketAsset } from '@/app/models/model';


export const ACTIFS_MOCK: MarketAsset[] = [
    {
        actifId: 1,
        name: 'Apple Inc.',
        symbol: 'AAPL',
        currentPrice: 245.50,
        previousPrice: 240.20,
        variation: 2.21,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 2,
        name: 'Microsoft Corporation',
        symbol: 'MSFT',
        currentPrice: 512.30,
        previousPrice: 518.60,
        variation: -1.22,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 3,
        name: 'NVIDIA Corporation',
        symbol: 'NVDA',
        currentPrice: 182.75,
        previousPrice: 176.40,
        variation: 3.60,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 4,
        name: 'Tesla Inc.',
        symbol: 'TSLA',
        currentPrice: 348.90,
        previousPrice: 355.00,
        variation: -1.72,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 5,
        name: 'Amazon.com Inc.',
        symbol: 'AMZN',
        currentPrice: 226.40,
        previousPrice: 223.10,
        variation: 1.48,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 6,
        name: 'Alphabet Inc.',
        symbol: 'GOOGL',
        currentPrice: 192.80,
        previousPrice: 190.50,
        variation: 1.21,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 7,
        name: 'Meta Platforms',
        symbol: 'META',
        currentPrice: 685.20,
        previousPrice: 692.40,
        variation: -1.04,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 8,
        name: 'Netflix Inc.',
        symbol: 'NFLX',
        currentPrice: 1185.00,
        previousPrice: 1160.00,
        variation: 2.16,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 9,
        name: 'Berkshire Hathaway',
        symbol: 'BRK.B',
        currentPrice: 485.60,
        previousPrice: 482.30,
        variation: 0.68,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 10,
        name: 'JPMorgan Chase',
        symbol: 'JPM',
        currentPrice: 298.40,
        previousPrice: 301.20,
        variation: -0.93,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 11,
        name: 'Visa Inc.',
        symbol: 'V',
        currentPrice: 355.70,
        previousPrice: 351.20,
        variation: 1.28,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 12,
        name: 'Mastercard Inc.',
        symbol: 'MA',
        currentPrice: 572.80,
        previousPrice: 568.00,
        variation: 0.85,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 13,
        name: 'Coca-Cola Company',
        symbol: 'KO',
        currentPrice: 71.25,
        previousPrice: 70.90,
        variation: 0.49,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 14,
        name: 'PepsiCo Inc.',
        symbol: 'PEP',
        currentPrice: 142.60,
        previousPrice: 144.10,
        variation: -1.04,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 15,
        name: 'Walmart Inc.',
        symbol: 'WMT',
        currentPrice: 103.80,
        previousPrice: 102.40,
        variation: 1.37,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 16,
        name: 'Exxon Mobil',
        symbol: 'XOM',
        currentPrice: 115.40,
        previousPrice: 113.90,
        variation: 1.32,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 17,
        name: 'Chevron Corporation',
        symbol: 'CVX',
        currentPrice: 158.30,
        previousPrice: 160.00,
        variation: -1.06,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 18,
        name: 'Oracle Corporation',
        symbol: 'ORCL',
        currentPrice: 214.50,
        previousPrice: 209.80,
        variation: 2.24,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 19,
        name: 'Adobe Inc.',
        symbol: 'ADBE',
        currentPrice: 385.20,
        previousPrice: 391.50,
        variation: -1.61,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 20,
        name: 'Salesforce Inc.',
        symbol: 'CRM',
        currentPrice: 292.70,
        previousPrice: 288.60,
        variation: 1.42,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 21,
        name: 'Advanced Micro Devices',
        symbol: 'AMD',
        currentPrice: 162.40,
        previousPrice: 158.20,
        variation: 2.65,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 22,
        name: 'Intel Corporation',
        symbol: 'INTC',
        currentPrice: 24.80,
        previousPrice: 25.30,
        variation: -1.98,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 23,
        name: 'Qualcomm Inc.',
        symbol: 'QCOM',
        variation: 1.32,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 24,
        name: 'IBM Corporation',
        symbol: 'IBM',
        previousPrice: 290.40,
        variation: 0.59,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 25,
        name: 'Cisco Systems',
        symbol: 'CSCO',
        currentPrice: 68.45,
        previousPrice: 69.10,
        variation: -0.94,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 26,
        name: 'Airbus SE',
        symbol: 'AIR',
        currentPrice: 172.60,
        previousPrice: 170.20,
        variation: 1.41,
        currency: 'EUR',
        status: 'ACTIVE'
    },
    {
        actifId: 27,
        name: 'LVMH',
        symbol: 'MC',
        currentPrice: 485.30,
        previousPrice: 491.80,
        variation: -1.32,
        currency: 'EUR',
        status: 'ACTIVE'
    },
    {
        actifId: 28,
        name: 'TotalEnergies',
        symbol: 'TTE',
        currentPrice: 54.80,
        previousPrice: 54.10,
        variation: 1.29,
        currency: 'EUR',
        status: 'ACTIVE'
    },
    {
        actifId: 29,
        name: 'Siemens AG',
        symbol: 'SIE',
        currentPrice: 228.40,
        previousPrice: 225.60,
        variation: 1.24,
        currency: 'EUR',
        status: 'ACTIVE'
    },
    {
        actifId: 30,
        name: 'SAP SE',
        symbol: 'SAP',
        currentPrice: 258.70,
        previousPrice: 261.40,
        variation: -1.03,
        currency: 'EUR',
        status: 'ACTIVE'
    },
    {
        actifId: 31,
        name: 'Toyota Motor',
        symbol: 'TM',
        currentPrice: 185.60,
        previousPrice: 183.90,
        variation: 0.92,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 32,
        name: 'Alibaba Group',
        symbol: 'BABA',
        currentPrice: 126.80,
        previousPrice: 123.40,
        variation: 2.76,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 33,
        name: 'Tencent Holdings',
        symbol: '0700.HK',
        currentPrice: 518.00,
        previousPrice: 525.50,
        variation: -1.43,
        currency: 'HKD',
        status: 'ACTIVE'
    },
    {
        actifId: 34,
        name: 'Samsung Electronics',
        symbol: '005930.KS',
        currentPrice: 69500,
        previousPrice: 68800,
        variation: 1.02,
        currency: 'KRW',
        status: 'ACTIVE'
    },
    {
        actifId: 35,
        name: 'Sony Group',
        symbol: 'SONY',
        currentPrice: 25.40,
        previousPrice: 25.10,
        variation: 1.20,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 36,
        name: 'Shopify Inc.',
        symbol: 'SHOP',
        currentPrice: 118.30,
        previousPrice: 120.50,
        variation: -1.83,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 37,
        name: 'Palantir Technologies',
        symbol: 'PLTR',
        currentPrice: 145.70,
        previousPrice: 139.20,
        variation: 4.67,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 38,
        name: 'Uber Technologies',
        symbol: 'UBER',
        currentPrice: 92.60,
        previousPrice: 90.80,
        variation: 1.98,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 39,
        name: 'Spotify Technology',
        symbol: 'SPOT',
        currentPrice: 612.40,
        previousPrice: 620.10,
        variation: -1.24,
        currency: 'USD',
        status: 'ACTIVE'
    },
    {
        actifId: 40,
        name: 'McDonald’s Corporation',
        symbol: 'MCD',
        currentPrice: 309.80,
        previousPrice: 307.50,
        variation: 0.75,
        currency: 'USD',
        status: 'ACTIVE'
    }
];

export const COURS_HISTORIQUES_MOCK: Record<number, HistoricalPrice[]> = {
    1: [
        {
            date: '2026-10-01',
            open: 248,
            high: 253,
            low: 246,
            close: 250,
            volume: 1200000
        },
        {
            date: '2026-10-05',
            open: 250,
            high: 256,
            low: 249,
            close: 254,
            volume: 1350000
        },
        {
            date: '2026-10-09',
            open: 255,
            high: 257,
            low: 249,
            close: 251,
            volume: 1100000
        },
        {
            date: '2026-10-13',
            open: 252,
            high: 260,
            low: 251,
            close: 258,
            volume: 1450000
        },
        {
            date: '2026-10-16',
            open: 258,
            high: 259,
            low: 253,
            close: 255,
            volume: 1250000
        },
        {
            date: '2026-10-20',
            open: 256,
            high: 266,
            low: 254,
            close: 264,
            volume: 1600000
        }
    ]
};
