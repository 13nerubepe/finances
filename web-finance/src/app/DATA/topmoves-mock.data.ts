
import { TopMoversResponse } from '@/app/models/actif-model';

export const TOP_MOVERS_MOCK: TopMoversResponse = {
    gainers: [
        {
            symbol: 'AFB',
            name: 'Afriland First Bank',
            price: 12500,
            change: 975,
            changePercent: 8.46
        },
        {
            symbol: 'PALM',
            name: 'Socapalm',
            price: 28500,
            change: 1800,
            changePercent: 6.74
        },
        {
            symbol: 'SEM',
            name: 'Semc',
            price: 9200,
            change: 425,
            changePercent: 4.84
        },
        {
            symbol: 'SAFA',
            name: 'Safacam',
            price: 18750,
            change: 600,
            changePercent: 3.31
        },
        {
            symbol: 'TRDX',
            name: 'Tradex',
            price: 15000,
            change: 300,
            changePercent: 2.04
        }
    ],

    losers: [
        {
            symbol: 'BEL',
            name: 'Le Belier',
            price: 7400,
            change: -587,
            changePercent: -7.35
        },
        {
            symbol: 'ENEO',
            name: 'Eneo',
            price: 11200,
            change: -666,
            changePercent: -5.61
        },
        {
            symbol: 'SCAR',
            name: 'Socarto',
            price: 6500,
            change: -284,
            changePercent: -4.18
        },
        {
            symbol: 'SGC',
            name: 'Société Générale Cameroun',
            price: 21500,
            change: -605,
            changePercent: -2.74
        },
        {
            symbol: 'CIM',
            name: 'Cimencam',
            price: 9800,
            change: -155,
            changePercent: -1.56
        }
    ]
};
