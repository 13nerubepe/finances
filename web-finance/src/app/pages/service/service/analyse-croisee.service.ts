import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, switchMap } from 'rxjs';

import type { Actif, Actualite, CorrelationsResponse, ExplicationPic, PicJournalier, PointVolatilite, VolatiliteResponse } from '@/app/models/actif-model';
import type { PortefeuilleDetail } from '@/app/models/portefeuille-model';
import { ActifService } from '@/app/pages/service/service/actif-service';
import { PortefeuilleService } from '@/app/pages/service/service/portefeuille-service';

/* ---------------------------------------------------------------------------
 * Analyse croisée d'un actif pour un jour donné, calculée dans le navigateur
 * à partir des routes existantes de l'API (aucune route ajoutée au backend).
 * ------------------------------------------------------------------------- */

/** Jours d'historique utilisés pour la volatilité moyenne, les pics récents et les corrélations. */
export const JOURS_HISTORIQUE = 90;
/** Fenêtre de l'écart-type glissant, en jours (comme le reste de l'application). */
export const FENETRE_VOLATILITE = 20;
/** Jours avant et après le jour analysé pour rattacher les actualités. */
export const JOURS_ACTUALITES = 3;

/** Seuils de lecture (score Z, rapport de volatilité, corrélation). */
export const SEUILS = {
    zInhabituel: 2,
    zFort: 3,
    volatiliteElevee: 1.5,
    volatiliteFaible: 0.7,
    correlationForte: 0.7,
    correlationOpposee: -0.3,
    correlationFaible: 0.3
};

export type Niveau = 'info' | 'attention' | 'alerte';
export type NiveauRisque = 'faible' | 'modéré' | 'élevé';

/** Tout ce qui a été lu dans l'API pour l'actif et le jour demandés. */
export interface DonneesAnalyse {
    symbole: string;
    jour: string;
    actif: Actif | null;
    /** Volatilité journalière de l'actif sur la période (ratios en fraction : 0,02 = 2 %). */
    volatilite: VolatiliteResponse | null;
    /** Volatilité journalière de l'indice de marché, pour séparer marché et actif. */
    indice: { symbole: string; nom: string; volatilite: VolatiliteResponse | null } | null;
    /** Pics journaliers enregistrés sur la période (variation déjà en %). */
    pics: PicJournalier[];
    correlations: CorrelationsResponse | null;
    /** Noms des actifs, pour rendre les corrélations lisibles. */
    noms: Record<string, string>;
    actualites: Actualite[];
    /** Listes de l'utilisateur, avec leurs actifs. */
    listes: PortefeuilleDetail[];
    explication: ExplicationPic | null;
    /** Routes qui n'ont pas pu être lues : l'analyse reste possible sans elles. */
    manquants: string[];
}

export interface Constat {
    theme: 'mouvement' | 'volatilite' | 'pics' | 'marche' | 'correlations' | 'actualites' | 'exposition';
    titre: string;
    texte: string;
    niveau: Niveau;
}

export interface AnalyseCroisee {
    symbole: string;
    nom: string;
    jour: string;
    niveauRisque: NiveauRisque;
    /** Synthèse en quelques phrases. */
    resume: string;
    constats: Constat[];
    /** Conseils de lecture du risque : jamais d'achat ni de vente. */
    conseils: string[];
    articles: { titre: string; lien: string; source: string; date: string | null }[];
    explicationIA: ExplicationPic | null;
    chiffres: {
        variationJour: number | null;
        zJour: number | null;
        volatiliteJour: number | null;
        volatiliteMoyenne: number | null;
        rapportVolatilite: number | null;
        variationIndice: number | null;
        correlationIndice: number | null;
        nbPicsRecents: number;
    };
    manquants: string[];
    avertissement: string;
}

export const AVERTISSEMENT =
    "Analyse automatique à but d'information, calculée à partir des données de l'application. Ce n'est pas un conseil en investissement : elle ne recommande ni d'acheter ni de vendre.";

/* ---------------------------------- Outils ---------------------------------- */

const ROUTES = {
    actif: "fiche de l'actif",
    volatilite: 'volatilité',
    indice: "volatilité de l'indice",
    pics: 'pics journaliers',
    correlations: 'corrélations',
    actualites: 'actualités',
    listes: 'listes',
    explication: "explication de l'IA"
} as const;

function decalerJour(jour: string, jours: number): string {
    const d = new Date(`${jour}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + jours);
    return d.toISOString().slice(0, 10);
}

function pourcent(n: number | null, decimales = 2, signe = false): string {
    if (n === null || !Number.isFinite(n)) return '—';
    const texte = n.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
    return `${signe && n > 0 ? '+' : ''}${texte} %`;
}

/** AAAA-MM-JJ -> JJ/MM/AAAA, sans conversion de fuseau horaire. */
function dateFr(jour: string): string {
    return jour.split('-').reverse().join('/');
}

/** Accorde un mot avec un nombre : pluriel(2, 'pic') -> '2 pics'. */
function pluriel(n: number, singulier: string, plurielForme = `${singulier}s`): string {
    return `${n} ${n > 1 ? plurielForme : singulier}`;
}

/** Évite « Apple Inc.. » quand un nom se termine déjà par un point. */
function sansDoublePoint(texte: string): string {
    return texte.replace(/\.\.(?!\.)/g, '.');
}

function moyenne(valeurs: number[]): number | null {
    return valeurs.length ? valeurs.reduce((s, v) => s + v, 0) / valeurs.length : null;
}

function ecartType(valeurs: number[]): number | null {
    const m = moyenne(valeurs);
    if (m === null || valeurs.length < 2) return null;
    return Math.sqrt(valeurs.reduce((s, v) => s + (v - m) ** 2, 0) / (valeurs.length - 1));
}

/** Point de la série du jour demandé (ou, à défaut, le dernier point avant ce jour). */
function pointDuJour(serie: PointVolatilite[], jour: string): PointVolatilite | null {
    const avant = serie.filter((p) => p.horodatage.slice(0, 10) <= jour);
    return avant.length ? avant[avant.length - 1] : null;
}

function enPourcent(fraction: number | null | undefined): number | null {
    return fraction === null || fraction === undefined || !Number.isFinite(fraction) ? null : fraction * 100;
}

function arrondi(n: number | null, decimales = 2): number | null {
    return n === null ? null : Number(n.toFixed(decimales));
}

/** Choisit l'indice de marché qui sert de référence à l'actif. */
export function choisirIndice(actif: Actif | null, panier: Actif[]): Actif | null {
    if (!actif || actif.type_actif === 'indice') return null;
    const indices = panier.filter((a) => a.type_actif === 'indice');
    if (actif.type_actif === 'crypto') return null; // aucun indice crypto dans le panier : le marché crypto se lit via les corrélations
    return indices.find((a) => a.symbole === '^GSPC') ?? indices.find((a) => a.devise === actif.devise) ?? indices[0] ?? null;
}

/* ------------------------- Fonction de croisement ------------------------- */

/** Croise mouvement du jour, volatilité, pics, marché, corrélations, actualités et exposition. */
export function croiserInformations(d: DonneesAnalyse): AnalyseCroisee {
    const nom = d.actif?.nom ?? d.symbole;
    const constats: Constat[] = [];
    const conseils: string[] = [];
    let pointsRisque = 0;

    /* --- Mouvement du jour et volatilité --- */
    const serie = d.volatilite?.serie ?? [];
    const point = pointDuJour(serie, d.jour);
    const jourExact = point?.horodatage.slice(0, 10) === d.jour;
    const variationJour = jourExact ? enPourcent(point?.rendement) : null;
    const volatiliteJour = enPourcent(point?.volatilite);
    const volatilites = serie.map((p) => p.volatilite).filter((v): v is number => v !== null && Number.isFinite(v));
    const volatiliteMoyenne = enPourcent(moyenne(volatilites));
    // Arrondi une seule fois, pour que le texte et les étiquettes affichent la même valeur.
    const rapportVolatilite = arrondi(volatiliteJour !== null && volatiliteMoyenne ? volatiliteJour / volatiliteMoyenne : null, 1);

    // Score Z : celui du pic s'il est enregistré, sinon variation du jour / écart-type des rendements de la période.
    const picDuJour = d.pics.find((p) => p.date === d.jour) ?? null;
    const rendements = serie.map((p) => p.rendement).filter((r): r is number => r !== null && Number.isFinite(r));
    const ecart = ecartType(rendements);
    const zCalcule = variationJour !== null && ecart ? variationJour / 100 / ecart : null;
    const zJour = arrondi(picDuJour?.z ?? zCalcule, 1);
    const variationRetenue = picDuJour?.variation ?? variationJour;

    if (variationRetenue === null) {
        constats.push({
            theme: 'mouvement',
            titre: 'Mouvement du jour',
            texte: `Aucun cours pour ${nom} le ${dateFr(d.jour)} (week-end, jour férié ou données non importées).`,
            niveau: 'info'
        });
    } else {
        const fort = zJour !== null && Math.abs(zJour) >= SEUILS.zFort;
        const inhabituel = zJour !== null && Math.abs(zJour) >= SEUILS.zInhabituel;
        if (fort) pointsRisque += 2;
        else if (inhabituel) pointsRisque += 1;
        const lecture = zJour === null ? '' : fort ? ', un mouvement exceptionnel' : inhabituel ? ', un mouvement inhabituel' : ', un mouvement dans la norme';
        constats.push({
            theme: 'mouvement',
            titre: 'Mouvement du jour',
            texte: `${nom} a varié de ${pourcent(variationRetenue, 2, true)} le ${dateFr(d.jour)}${zJour !== null ? ` (score Z ${zJour.toLocaleString('fr-FR')})` : ''}${lecture}.`,
            niveau: fort ? 'alerte' : inhabituel ? 'attention' : 'info'
        });
    }

    if (volatiliteJour !== null && volatiliteMoyenne !== null && rapportVolatilite !== null) {
        const elevee = rapportVolatilite >= SEUILS.volatiliteElevee;
        const faible = rapportVolatilite <= SEUILS.volatiliteFaible;
        if (elevee) pointsRisque += 1;
        constats.push({
            theme: 'volatilite',
            titre: 'Volatilité',
            texte: `Écart-type glissant sur ${FENETRE_VOLATILITE} jours : ${pourcent(volatiliteJour)}, soit ${rapportVolatilite.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} fois sa moyenne des ${JOURS_HISTORIQUE} derniers jours (${pourcent(volatiliteMoyenne)}). ${
                elevee ? 'La volatilité est nettement au-dessus de son niveau habituel.' : faible ? 'La volatilité est inférieure à son niveau habituel.' : 'La volatilité reste proche de son niveau habituel.'
            }`,
            niveau: elevee ? 'attention' : 'info'
        });
        if (elevee) conseils.push("Volatilité au-dessus de la normale : attendez-vous à des écarts de prix plus larges que d'habitude dans les prochains jours.");
    }

    /* --- Pics récents --- */
    const debutPics = decalerJour(d.jour, -JOURS_HISTORIQUE);
    const picsRecents = d.pics.filter((p) => p.date >= debutPics && p.date <= d.jour).sort((a, b) => b.date.localeCompare(a.date));
    if (picsRecents.length >= 3) pointsRisque += 1;
    if (picsRecents.length) {
        const dernier = picsRecents[0];
        const systemiques = picsRecents.filter((p) => p.type_pic === 'systemique').length;
        constats.push({
            theme: 'pics',
            titre: 'Pics récents',
            texte: `${pluriel(picsRecents.length, 'pic')} de volatilité en ${JOURS_HISTORIQUE} jours, dont ${pluriel(systemiques, 'lié', 'liés')} au marché. Dernier : ${dateFr(dernier.date)} (${pourcent(dernier.variation, 2, true)}${dernier.z !== null ? `, Z ${dernier.z.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}` : ''}).`,
            niveau: picsRecents.length >= 3 ? 'attention' : 'info'
        });
    } else {
        constats.push({ theme: 'pics', titre: 'Pics récents', texte: `Aucun pic de volatilité enregistré sur les ${JOURS_HISTORIQUE} jours précédents.`, niveau: 'info' });
    }

    /* --- Lien avec le marché --- */
    let variationIndice: number | null = null;
    let correlationIndice: number | null = null;
    if (d.indice) {
        const pointIndice = pointDuJour(d.indice.volatilite?.serie ?? [], d.jour);
        variationIndice = pointIndice?.horodatage.slice(0, 10) === d.jour ? enPourcent(pointIndice.rendement) : null;
        correlationIndice = d.correlations?.correlations?.[d.symbole]?.[d.indice.symbole] ?? null;
        const parts: string[] = [];
        if (variationIndice !== null) parts.push(`${d.indice.nom} a varié de ${pourcent(variationIndice, 2, true)} le même jour`);
        if (correlationIndice !== null) parts.push(`la corrélation avec cet indice est de ${correlationIndice.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} sur ${JOURS_HISTORIQUE} jours`);

        let lecture = '';
        const memeSens = variationIndice !== null && variationRetenue !== null && Math.sign(variationIndice) === Math.sign(variationRetenue);
        if (picDuJour?.type_pic === 'systemique' || (memeSens && variationIndice !== null && Math.abs(variationIndice) >= 1 && (correlationIndice ?? 0) >= 0.5)) {
            lecture = " Le mouvement semble surtout porté par l'ensemble du marché.";
            conseils.push(`Mouvement lié au marché : suivez ${d.indice.nom} et l'actualité macroéconomique (taux, inflation, banques centrales) plutôt que les seules nouvelles de ${nom}.`);
        } else if (picDuJour?.type_pic === 'specifique' || (variationRetenue !== null && Math.abs(variationRetenue) >= 2 && (variationIndice === null || Math.abs(variationIndice) < 0.5))) {
            lecture = ` Le marché a peu bougé : le mouvement semble propre à ${nom}.`;
            conseils.push(`Mouvement propre à l'actif : cherchez la cause dans les nouvelles de ${nom} (résultats, annonces, notation) avant de tirer une conclusion.`);
        }
        if (parts.length || lecture) {
            constats.push({ theme: 'marche', titre: 'Lien avec le marché', texte: `${parts.length ? parts.join(' ; ') + '.' : ''}${lecture}`.trim(), niveau: 'info' });
        }
    }

    /* --- Corrélations avec le reste du panier --- */
    const ligne = d.correlations?.correlations?.[d.symbole] ?? {};
    const partenaires = Object.entries(ligne)
        .filter(([autre, c]) => autre !== d.symbole && c !== null && Number.isFinite(c))
        .map(([autre, c]) => ({ symbole: autre, nom: d.noms[autre] ?? autre, c: c as number }));
    if (partenaires.length) {
        const fortes = partenaires.filter((p) => p.c >= SEUILS.correlationForte).sort((a, b) => b.c - a.c);
        const opposees = partenaires.filter((p) => p.c <= SEUILS.correlationOpposee).sort((a, b) => a.c - b.c);
        const independantes = partenaires.filter((p) => Math.abs(p.c) < SEUILS.correlationFaible);
        const liste = (ps: typeof partenaires) => ps.map((p) => `${p.nom} (${p.c.toLocaleString('fr-FR', { maximumFractionDigits: 2 })})`).join(', ');
        const phrases: string[] = [];
        if (fortes.length) phrases.push(`Évolue dans le même sens que ${liste(fortes)}`);
        if (opposees.length) phrases.push(`en sens opposé à ${liste(opposees)}`);
        if (independantes.length) phrases.push(`presque indépendamment de ${liste(independantes)}`);
        constats.push({
            theme: 'correlations',
            titre: 'Corrélations',
            texte: phrases.length ? phrases.join(' ; ') + '.' : 'Liens modérés avec les autres actifs du panier.',
            niveau: 'info'
        });
        if (fortes.length) conseils.push(`${nom} et ${fortes.map((p) => p.nom).join(', ')} bougent ensemble : les détenir ensemble diversifie peu le risque.`);
        if (opposees.length || independantes.length) {
            const diversifiants = [...opposees, ...independantes].map((p) => p.nom);
            conseils.push(
                diversifiants.length > 1
                    ? `${diversifiants.join(', ')} réagissent différemment : ce sont eux qui diversifient le mieux un panier contenant ${nom}.`
                    : `${diversifiants[0]} réagit différemment : c'est l'actif qui diversifie le mieux un panier contenant ${nom}.`
            );
        }
    }

    /* --- Actualités autour du jour --- */
    const debutNews = decalerJour(d.jour, -JOURS_ACTUALITES);
    const finNews = decalerJour(d.jour, 1);
    // Articles de la période, du plus proche au plus éloigné du jour analysé.
    const ecartAuJour = (a: Actualite) => Math.abs(Date.parse(a.date_publication!) - Date.parse(`${d.jour}T12:00:00Z`));
    const autourDuJour = d.actualites
        .filter((a) => a.date_publication && a.date_publication.slice(0, 10) >= debutNews && a.date_publication.slice(0, 10) <= finNews)
        .sort((a, b) => ecartAuJour(a) - ecartAuJour(b));
    const articles = (autourDuJour.length ? autourDuJour : d.actualites).slice(0, 5).map((a) => ({
        titre: a.titre,
        lien: a.lien,
        source: a.source_nom,
        date: a.date_publication
    }));
    if (autourDuJour.length) {
        constats.push({
            theme: 'actualites',
            titre: 'Actualités de la période',
            texte: `${pluriel(autourDuJour.length, 'article')} sur ${nom} entre le ${dateFr(debutNews)} et le ${dateFr(finNews)}. Le plus proche du jour : « ${autourDuJour[0].titre} ».`,
            niveau: 'info'
        });
    } else {
        constats.push({
            theme: 'actualites',
            titre: 'Actualités de la période',
            texte: d.actualites.length
                ? `Aucun article sur ${nom} autour du ${dateFr(d.jour)} ; voici les plus récents disponibles.`
                : `Aucun article sur ${nom} dans les flux RSS collectés.`,
            niveau: 'info'
        });
        if (variationRetenue !== null && zJour !== null && Math.abs(zJour) >= SEUILS.zInhabituel) {
            conseils.push("Mouvement inhabituel sans actualité collectée : vérifiez une source d'information externe, l'explication n'est peut-être pas encore dans les flux RSS.");
        }
    }

    /* --- Exposition de l'utilisateur --- */
    const listesConcernees = d.listes.filter((l) => l.actifs.some((p) => p.symbole.toUpperCase() === d.symbole.toUpperCase()));
    if (listesConcernees.length) {
        const parts = listesConcernees.map((l) => `« ${l.nom} » (1 actif sur ${l.actifs.length})`);
        const concentrees = listesConcernees.filter((l) => l.actifs.length <= 2);
        constats.push({
            theme: 'exposition',
            titre: 'Vos listes',
            texte: `${nom} figure dans ${parts.join(', ')}.`,
            niveau: concentrees.length ? 'attention' : 'info'
        });
        if (concentrees.length) {
            const noms = concentrees.map((l) => `« ${l.nom} »`).join(', ');
            conseils.push(`${noms} ${concentrees.length > 1 ? 'contiennent' : 'contient'} très peu d'actifs : un mouvement de ${nom} y pèse fortement.`);
        }
    } else if (d.listes.length) {
        constats.push({ theme: 'exposition', titre: 'Vos listes', texte: `${nom} ne figure dans aucune de vos listes.`, niveau: 'info' });
    }

    /* --- Synthèse --- */
    const niveauRisque: NiveauRisque = pointsRisque >= 3 ? 'élevé' : pointsRisque >= 1 ? 'modéré' : 'faible';
    if (!conseils.length) conseils.push(`Aucun signal particulier : ${nom} évolue dans sa plage habituelle sur la période.`);
    conseils.push('Comparez toujours plusieurs jours : une seule séance ne suffit pas à juger une tendance.');

    const resume = [
        variationRetenue !== null ? `Le ${dateFr(d.jour)}, ${nom} a varié de ${pourcent(variationRetenue, 2, true)}.` : `Pas de cotation de ${nom} le ${dateFr(d.jour)}.`,
        rapportVolatilite !== null ? `Sa volatilité est à ${rapportVolatilite.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} fois sa moyenne.` : '',
        picsRecents.length ? `${pluriel(picsRecents.length, 'pic')} en ${JOURS_HISTORIQUE} jours.` : '',
        `Niveau de risque estimé : ${niveauRisque}.`
    ]
        .filter(Boolean)
        .join(' ');

    return {
        symbole: d.symbole,
        nom,
        jour: d.jour,
        niveauRisque,
        resume: sansDoublePoint(resume),
        constats: constats.map((c) => ({ ...c, texte: sansDoublePoint(c.texte) })),
        conseils: conseils.map(sansDoublePoint),
        articles,
        explicationIA: d.explication,
        chiffres: {
            variationJour: arrondi(variationRetenue),
            zJour,
            volatiliteJour: arrondi(volatiliteJour),
            volatiliteMoyenne: arrondi(volatiliteMoyenne),
            rapportVolatilite,
            variationIndice: arrondi(variationIndice),
            correlationIndice: arrondi(correlationIndice),
            nbPicsRecents: picsRecents.length
        },
        manquants: d.manquants,
        avertissement: AVERTISSEMENT
    };
}

/** Texte complet de l'analyse, pour l'envoyer à l'assistant ou le copier. */
export function analyseEnTexte(a: AnalyseCroisee): string {
    return [
        `Analyse croisée de ${a.nom} (${a.symbole}) le ${dateFr(a.jour)} — risque ${a.niveauRisque}.`,
        a.resume,
        ...a.constats.map((c) => `- ${c.titre} : ${c.texte}`),
        'Conseils :',
        ...a.conseils.map((c) => `- ${c}`),
        a.articles.length ? 'Articles :' : '',
        ...a.articles.map((x) => `- ${x.titre} (${x.source})`)
    ]
        .filter(Boolean)
        .join('\n');
}

/* --------------------------------- Service -------------------------------- */

export interface OptionsAnalyse {
    /** Demande aussi l'explication rédigée par l'IA (appel à Gemini, plus lent). */
    avecExplicationIA?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AnalyseCroiseeService {
    private readonly actifService = inject(ActifService);
    private readonly portefeuilleService = inject(PortefeuilleService);

    /** Récupère toutes les données d'un actif pour un jour (AAAA-MM-JJ, UTC) puis les croise. */
    analyser(symbole: string, jour: string, options: OptionsAnalyse = {}): Observable<AnalyseCroisee> {
        return this.collecter(symbole, jour, options).pipe(map((donnees) => croiserInformations(donnees)));
    }

    /** Lit les routes existantes ; une route en échec est signalée dans `manquants` sans bloquer l'analyse. */
    collecter(symbole: string, jour: string, options: OptionsAnalyse = {}): Observable<DonneesAnalyse> {
        const manquants: string[] = [];
        const sur = <T>(source: Observable<T>, nom: string, vide: T): Observable<T> =>
            source.pipe(
                catchError(() => {
                    manquants.push(nom);
                    return of(vide);
                })
            );

        const debut = `${decalerJour(jour, -JOURS_HISTORIQUE)}T00:00:00Z`;
        const fin = `${jour}T23:59:59Z`;

        return forkJoin({
            actif: sur(this.actifService.getAssetBySymbole(symbole), ROUTES.actif, null as Actif | null),
            panier: sur(this.actifService.getAssets(), ROUTES.actif, [] as Actif[])
        }).pipe(
            switchMap(({ actif, panier }) => {
                const indice = choisirIndice(actif, panier);
                const autres = panier.filter((a) => a.symbole !== symbole).slice(0, 9);
                const noms = Object.fromEntries(panier.map((a) => [a.symbole, a.nom]));

                return forkJoin({
                    volatilite: sur(this.actifService.getVolatilite(symbole, '1j', FENETRE_VOLATILITE, debut, fin), ROUTES.volatilite, null as VolatiliteResponse | null),
                    volIndice: indice
                        ? sur(this.actifService.getVolatilite(indice.symbole, '1j', FENETRE_VOLATILITE, debut, fin), ROUTES.indice, null as VolatiliteResponse | null)
                        : of(null),
                    pics: sur(this.actifService.getPicsJournaliers({ symbole, debut: decalerJour(jour, -JOURS_HISTORIQUE), fin: jour }), ROUTES.pics, [] as PicJournalier[]),
                    correlations: autres.length
                        ? sur(this.actifService.getCorrelations([symbole, ...autres.map((a) => a.symbole)], '1j', debut, fin), ROUTES.correlations, null as CorrelationsResponse | null)
                        : of(null),
                    actualites: sur(this.actifService.getActualites(symbole), ROUTES.actualites, [] as Actualite[]),
                    listes: sur(this.lireListes(), ROUTES.listes, [] as PortefeuilleDetail[]),
                    explication: options.avecExplicationIA
                        ? sur(this.actifService.getExplicationPic(symbole, jour), ROUTES.explication, null as ExplicationPic | null)
                        : of(null)
                }).pipe(
                    map(
                        (r): DonneesAnalyse => ({
                            symbole,
                            jour,
                            actif,
                            volatilite: r.volatilite,
                            indice: indice ? { symbole: indice.symbole, nom: indice.nom, volatilite: r.volIndice } : null,
                            pics: r.pics,
                            correlations: r.correlations,
                            noms,
                            actualites: r.actualites,
                            listes: r.listes,
                            explication: r.explication,
                            manquants: [...new Set(manquants)]
                        })
                    )
                );
            })
        );
    }

    /** Listes de l'utilisateur avec leurs actifs (une requête par liste). */
    private lireListes(): Observable<PortefeuilleDetail[]> {
        return this.portefeuilleService.getPortefeuilles().pipe(
            switchMap((listes) => (listes.length ? forkJoin(listes.map((l) => this.portefeuilleService.getPortefeuille(l.id))) : of([])))
        );
    }
}
