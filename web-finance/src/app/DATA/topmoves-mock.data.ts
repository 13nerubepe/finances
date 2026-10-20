
import { TopMoversResponse } from '@/app/models/model';

export const TOP_MOVERS_MOCK: TopMoversResponse = {
    topGagnants: [
        {
            actifId: 1,
            name: 'Afriland First Bank',
            symbol: 'AFB',
            currentPrice: 12500,
            previousPrice: 11525,
            variation: 8.46
        },
        {
            actifId: 2,
            name: 'Socapalm',
            symbol: 'PALM',
            currentPrice: 28500,
            previousPrice: 26700,
            variation: 6.74
        },
        {
            actifId: 3,
            name: 'Semc',
            symbol: 'SEM',
            currentPrice: 9200,
            previousPrice: 8775,
            variation: 4.84
        },
        {
            actifId: 4,
            name: 'Safacam',
            symbol: 'SAFA',
            currentPrice: 18750,
            previousPrice: 18150,
            variation: 3.31
        },
        {
            actifId: 5,
            name: 'Tradex',
            symbol: 'TRDX',
            currentPrice: 15000,
            previousPrice: 14700,
            variation: 2.04
        }
    ],

    topPerdants: [
        {
            actifId: 6,
            name: 'Le Belier',
            symbol: 'BEL',
            currentPrice: 7400,
            previousPrice: 7987,
            variation: -7.35
        },
        {
            actifId: 7,
            name: 'Eneo',
            symbol: 'ENEO',
            currentPrice: 11200,
            previousPrice: 11866,
            variation: -5.61
        },
        {
            actifId: 8,
            name: 'Socarto',
            symbol: 'SCAR',
            currentPrice: 6500,
            previousPrice: 6784,
            variation: -4.18
        },
        {
            actifId: 9,
            name: 'Société Générale Cameroun',
            symbol: 'SGC',
            currentPrice: 21500,
            previousPrice: 22105,
            variation: -2.74
        },
        {
            actifId: 10,
            name: 'Cimencam',
            symbol: 'CIM',
            currentPrice: 9800,
            previousPrice: 9955,
            variation: -1.56
        }
    ]
};
