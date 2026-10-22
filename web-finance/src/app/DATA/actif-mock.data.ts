import { Actif } from '@/app/models/model';


export const MOCK_ACTIFS: Actif[] = [
    { actifId: 1,  name: 'Apple Inc.',        symbol: 'AAPL',  currentPrice: 229.87,   previousPrice: 226.65,   variation: 1.42,  currency: 'USD', status: 'ACTIVE' },
    { actifId: 2,  name: 'Microsoft Corp.',   symbol: 'MSFT',  currentPrice: 415.3,    previousPrice: 411.8,    variation: 0.85,  currency: 'USD', status: 'ACTIVE' },
    { actifId: 3,  name: 'Tesla Inc.',        symbol: 'TSLA',  currentPrice: 248.5,    previousPrice: 255.2,    variation: -2.63, currency: 'USD', status: 'ACTIVE' },
    { actifId: 4,  name: 'NVIDIA Corp.',      symbol: 'NVDA',  currentPrice: 138.2,    previousPrice: 141.9,    variation: -2.61, currency: 'USD', status: 'ACTIVE' },
    { actifId: 5,  name: 'Amazon.com Inc.',   symbol: 'AMZN',  currentPrice: 186.75,   previousPrice: 185.1,    variation: 0.89,  currency: 'USD', status: 'ACTIVE' },
    { actifId: 6,  name: 'Alphabet Inc.',     symbol: 'GOOGL', currentPrice: 171.4,    previousPrice: 172.3,    variation: -0.52, currency: 'USD', status: 'ACTIVE' },
    { actifId: 7,  name: 'Bitcoin',           symbol: 'BTC',   currentPrice: 67250.5,  previousPrice: 68750,    variation: -2.18, currency: 'USD', status: 'ACTIVE' },
    { actifId: 8,  name: 'Ethereum',          symbol: 'ETH',   currentPrice: 2610.4,   previousPrice: 2575,     variation: 1.37,  currency: 'USD', status: 'ACTIVE' },
    { actifId: 9,  name: 'SPDR S&P 500 ETF',  symbol: 'SPY',   currentPrice: 568.1,    previousPrice: 566,      variation: 0.37,  currency: 'USD', status: 'ACTIVE' },
    { actifId: 10, name: 'Or (once)',         symbol: 'XAU',   currentPrice: 2680,     previousPrice: 2662.5,   variation: 0.66,  currency: 'USD', status: 'ACTIVE' },
    { actifId: 11, name: 'LVMH',              symbol: 'MC',    currentPrice: 612.3,    previousPrice: 618.9,    variation: -1.07, currency: 'EUR', status: 'ACTIVE' },
    { actifId: 12, name: 'Meta Platforms',    symbol: 'META',  currentPrice: 563.2,    previousPrice: 563.2,    variation: 0,     currency: 'USD', status: 'INACTIVE' },
];
