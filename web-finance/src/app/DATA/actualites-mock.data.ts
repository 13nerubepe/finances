import { Actualite, ActualiteResponse } from '@/app/models/actif-model';


export const ACTUALITES_MOCK: Actualite[] = [
    {
        id: 1,
        titre: 'Les valeurs technologiques progressent en séance',
        resume: 'Les grandes capitalisations technologiques évoluent à la hausse dans un marché attentif aux résultats.',
        contenu: 'Contenu fictif destiné à tester le détail des actualités financières. Il ne s’agit pas d’une information de marché vérifiée.',
        source: 'Finance Desk',
        categorie: 'Actions',
        url: 'https://example.com/actualites/technologie',
        datePublication: '2026-10-21T09:30:00'
    },
    {
        id: 2,
        titre: 'Le marché crypto reste volatil',
        resume: 'Les principales cryptomonnaies enregistrent des variations marquées.',
        contenu: 'Contenu de démonstration fictif. Remplacez-le par les données de votre flux RSS ou de votre API.',
        source: 'Crypto Observer',
        categorie: 'Crypto',
        url: 'https://example.com/actualites/crypto',
        datePublication: '2026-10-21T08:15:00'
    },
    {
        id: 3,
        titre: 'Les investisseurs surveillent les indicateurs macroéconomiques',
        resume: 'Les prochaines publications économiques pourraient influencer les anticipations de taux.',
        contenu: 'Article de démonstration pour tester les champs titre, résumé, contenu, source, catégorie, URL et date.',
        source: 'Market Bulletin',
        categorie: 'Économie',
        url: 'https://example.com/actualites/macro',
        datePublication: '2026-10-20T16:45:00'
    }
];

export const ACTUALITES_RESPONSE_MOCK: ActualiteResponse = {
    results: ACTUALITES_MOCK,
    count: ACTUALITES_MOCK.length
};
