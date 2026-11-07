import type { Actif, Actualite, PicJournalier, PointVolatilite, VolatiliteResponse } from '@/app/models/actif-model';
import type { PortefeuilleDetail } from '@/app/models/portefeuille-model';
import { analyseEnTexte, choisirIndice, croiserInformations, DonneesAnalyse } from './analyse-croisee.service';

const JOUR = '2026-11-06';

function actif(symbole: string, nom: string, type_actif: Actif['type_actif'], devise = 'USD'): Actif {
    return { id: symbole.length, symbole, nom, type_actif, devise, est_suivi: true } as Actif;
}

/** Série journalière : 40 jours calmes puis le jour analysé avec le rendement et la volatilité donnés. */
function serie(rendementJour: number, volatiliteJour: number, volatiliteCalme = 0.01): VolatiliteResponse {
    const points: PointVolatilite[] = [];
    for (let i = 40; i >= 1; i--) {
        const d = new Date(`${JOUR}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() - i);
        points.push({ horodatage: d.toISOString(), close: 100, rendement: i % 2 ? 0.01 : -0.01, volatilite: volatiliteCalme, amplitude: 0.02 });
    }
    points.push({ horodatage: `${JOUR}T00:00:00Z`, close: 90, rendement: rendementJour, volatilite: volatiliteJour, amplitude: 0.1 });
    return {
        actif: 'X',
        fenetre: 20,
        frequence: '1j',
        debut: '',
        fin: '',
        resume: { nb_points: points.length, volatilite_derniere: volatiliteJour, volatilite_moyenne: null, amplitude_periode: null, rendement_periode: null },
        serie: points
    };
}

function pic(date: string, variation: number, z: number, type_pic: PicJournalier['type_pic'] = 'specifique'): PicJournalier {
    return { id: 1, symbole: 'AAPL', nom: 'Apple Inc.', date, variation, z, z_volume: null, gap: null, volatilite_annuelle: null, type_pic, explication_disponible: false };
}

function donnees(partiel: Partial<DonneesAnalyse>): DonneesAnalyse {
    return {
        symbole: 'AAPL',
        jour: JOUR,
        actif: actif('AAPL', 'Apple Inc.', 'action'),
        volatilite: null,
        indice: null,
        pics: [],
        correlations: null,
        noms: { AAPL: 'Apple Inc.', MSFT: 'Microsoft', 'BTC-USD': 'Bitcoin', '^GSPC': 'S&P 500' },
        actualites: [],
        listes: [],
        explication: null,
        manquants: [],
        ...partiel
    };
}

describe('Analyse croisée', () => {
    it('croise une forte baisse liée au marché, une volatilité élevée, des actualités et une liste concentrée', () => {
        const article: Actualite = {
            id: 1,
            titre: 'Wall Street chute après la Fed',
            lien: 'https://exemple.com/a',
            auteur: '',
            contenu: '',
            date_publication: `${JOUR}T15:00:00Z`,
            themes: [],
            source: 1,
            source_nom: 'Yahoo Finance - AAPL'
        };
        const liste: PortefeuilleDetail = {
            id: 1,
            nom: 'Tech',
            description: '',
            devise: 'USD',
            date_creation: '',
            nb_actifs: 2,
            actifs: [
                { symbole: 'AAPL', nom: 'Apple Inc.', type_actif: 'action', quantite: null, date_ajout: '' },
                { symbole: 'MSFT', nom: 'Microsoft', type_actif: 'action', quantite: null, date_ajout: '' }
            ]
        };

        const a = croiserInformations(
            donnees({
                volatilite: serie(-0.06, 0.025),
                indice: { symbole: '^GSPC', nom: 'S&P 500', volatilite: serie(-0.03, 0.02) },
                pics: [pic(JOUR, -6, -4.2, 'systemique'), pic('2026-10-20', 3, 2.5), pic('2026-09-15', -4, -3)],
                correlations: {
                    actifs: ['AAPL', 'MSFT', 'BTC-USD', '^GSPC'],
                    frequence: '1j',
                    debut: '',
                    fin: '',
                    correlations: { AAPL: { AAPL: 1, MSFT: 0.85, 'BTC-USD': 0.1, '^GSPC': 0.8 } },
                    observations: {}
                },
                actualites: [article],
                listes: [liste]
            })
        );

        expect(a.niveauRisque).toBe('élevé');
        expect(a.chiffres.variationJour).toBe(-6);
        expect(a.chiffres.zJour).toBe(-4.2);
        expect(a.chiffres.rapportVolatilite).toBeGreaterThan(2);
        expect(a.chiffres.variationIndice).toBe(-3);
        expect(a.chiffres.nbPicsRecents).toBe(3);

        const theme = (t: string) => a.constats.find((c) => c.theme === t)!;
        expect(theme('mouvement').niveau).toBe('alerte');
        expect(theme('marche').texte).toContain("l'ensemble du marché");
        expect(theme('correlations').texte).toContain('Microsoft');
        expect(theme('correlations').texte).toContain('Bitcoin');
        expect(theme('actualites').texte).toContain('Wall Street chute');
        expect(theme('exposition').niveau).toBe('attention');

        expect(a.conseils.some((c) => c.includes('S&P 500'))).toBeTrue();
        expect(a.conseils.some((c) => c.includes('diversifie peu'))).toBeTrue();
        expect(a.conseils.some((c) => /achet|vend/i.test(c))).toBeFalse();
        expect(a.articles[0].titre).toBe('Wall Street chute après la Fed');
        expect(analyseEnTexte(a)).toContain('risque élevé');
    });

    it('reste calme sans signal particulier', () => {
        const a = croiserInformations(donnees({ volatilite: serie(0.004, 0.01) }));
        expect(a.niveauRisque).toBe('faible');
        expect(a.constats.find((c) => c.theme === 'mouvement')!.niveau).toBe('info');
        expect(a.conseils[0]).toContain('plage habituelle');
    });

    it("signale un jour sans cotation et les routes manquantes sans planter", () => {
        const a = croiserInformations(donnees({ jour: '2026-11-08', volatilite: serie(0.01, 0.01), manquants: ['corrélations'] }));
        expect(a.chiffres.variationJour).toBeNull();
        expect(a.constats[0].texte).toContain('Aucun cours');
        expect(a.manquants).toEqual(['corrélations']);
    });

    it("choisit le S&P 500 pour une action et aucun indice pour une crypto", () => {
        const panier = [actif('^FCHI', 'CAC 40', 'indice', 'EUR'), actif('^GSPC', 'S&P 500', 'indice')];
        expect(choisirIndice(actif('AAPL', 'Apple', 'action'), panier)?.symbole).toBe('^GSPC');
        expect(choisirIndice(actif('BTC-USD', 'Bitcoin', 'crypto'), panier)).toBeNull();
        expect(choisirIndice(actif('^GSPC', 'S&P 500', 'indice'), panier)).toBeNull();
    });
});
