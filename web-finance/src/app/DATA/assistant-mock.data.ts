import { MessageAssistantIA, ReponseAssistantIA, SourceAssistantIA } from '@/app/models/actif-model';

export const HISTORIQUE_ASSISTANT_IA_MOCK: MessageAssistantIA[] = [
    {
        id: 1,
        role: 'user',
        contenu: 'Quel est le niveau de risque du portefeuille principal ?',
        dateCreation: '2026-10-21T10:00:00'
    },
    {
        id: 2,
        role: 'assistant',
        contenu: 'Dans ces données fictives, le risque est élevé, notamment en raison de l’exposition aux cryptomonnaies. Vérifiez les données réelles avant toute décision.',
        dateCreation: '2026-10-21T10:00:03'
    },
    {
        id: 3,
        role: 'user',
        contenu: 'Quels actifs présentent une variation inhabituelle ?',
        dateCreation: '2026-10-21T10:05:00'
    },
    {
        id: 4,
        role: 'assistant',
        contenu: 'Dans ce jeu de démonstration, TSLA et BTC-USD présentent les variations les plus marquées.',
        dateCreation: '2026-10-21T10:05:03'
    }
];

export const SOURCES_ASSISTANT_IA_MOCK: SourceAssistantIA[] = [
    {
        titre: 'Historique des cours simulé',
        url: 'https://example.com/donnees-marche',
        type: 'donnee_marche'
    },
    {
        titre: 'Analyse de volatilité simulée',
        url: 'https://example.com/analyse-volatilite',
        type: 'analyse'
    }
];

export const REPONSE_ASSISTANT_IA_MOCK: ReponseAssistantIA = {
    reponse: 'Selon les données fictives chargées, la volatilité du portefeuille est supérieure à sa moyenne récente. Ceci est une démonstration et ne constitue pas un conseil financier.',
    dateCreation: '2026-10-21T10:10:00',
    sources: SOURCES_ASSISTANT_IA_MOCK
};
